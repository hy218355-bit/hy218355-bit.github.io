import UIKit
import WebKit
import AVFoundation

/// ゲームを動かす画面。ページからの知らせ（セーブ・再生中かどうか・エラー）を受けて、アプリ側の処理をする
final class GameViewController: UIViewController {
    private var webView: WKWebView!
    private let saves = SaveStore()
    /// CIの動作確認用：起動引数 -selftest のとき、ページの中で数秒ぶんの演奏を書き出して結果を出力し、終了する
    private let selfTest = ProcessInfo.processInfo.arguments.contains("-selftest")
    private let tapFeedback = UIImpactFeedbackGenerator(style: .light)
    private let resultFeedback = UINotificationFeedbackGenerator()
    /// 録音の保存：ページから少しずつ届く WAV をためておく
    private var incoming: (id: String, url: URL, handle: FileHandle)?

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(folder: "Game/tsukurikata"), forURLScheme: BundleSchemeHandler.scheme)
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true

        let content = config.userContentController
        content.addUserScript(WKUserScript(source: saves.restoreScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.addUserScript(WKUserScript(source: Self.errorReporter, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.addUserScript(WKUserScript(source: Self.launchScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        if selfTest, let url = Bundle.main.url(forResource: "selftest", withExtension: "js"),
           let js = try? String(contentsOf: url, encoding: .utf8) {
            content.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        content.add(MessageProxy(self), name: "native")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.scrollView.delegate = self
        // ノッチやホームバーの余白はページ側（CSSの safe-area）で取る
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(named: "Paper")
        webView.scrollView.backgroundColor = UIColor(named: "Paper")
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }   // MacのSafariの「開発」メニューから中身を調べられる
        #endif
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: BundleSchemeHandler.startURL))
        if selfTest {
            DispatchQueue.main.asyncAfter(deadline: .now() + 240) { Self.finishSelfTest(ok: false, detail: "timeout") }
        }
    }

    fileprivate func receive(_ body: Any) {
        guard let msg = body as? [String: Any], let type = msg["type"] as? String else { return }
        switch type {
        case "save":
            if let items = msg["data"] as? [String: String] { saves.save(items) }
        case "playing":
            // 演奏を聴いているあいだは画面を暗くしない（画面がロックされると音が止まるため）
            UIApplication.shared.isIdleTimerDisabled = (msg["on"] as? Bool) == true
        case "haptic":
            switch msg["kind"] as? String {
            case "success": resultFeedback.notificationOccurred(.success)
            case "warning": resultFeedback.notificationOccurred(.warning)
            default: tapFeedback.impactOccurred()
            }
        case "file":
            receiveFile(msg)
        case "log":
            Self.output("[web] \(msg["msg"] ?? "")")
        case "selftest":
            Self.finishSelfTest(ok: (msg["ok"] as? Bool) == true, detail: "\(msg["detail"] ?? "")")
        default:
            break
        }
    }

    // MARK: 録音の保存（WAV を受け取り、m4a にして共有シートを出す）

    private func receiveFile(_ msg: [String: Any]) {
        guard let id = msg["id"] as? String, let i = msg["i"] as? Int, let n = msg["n"] as? Int,
              let name = msg["name"] as? String, let b64 = msg["data"] as? String,
              let data = Data(base64Encoded: b64) else { return }
        if i == 0 {
            if let old = incoming { try? old.handle.close() }
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("recordings", isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let safe = name.replacingOccurrences(of: "/", with: "_")
            let url = dir.appendingPathComponent(safe)
            try? FileManager.default.removeItem(at: url)
            FileManager.default.createFile(atPath: url.path, contents: nil)
            guard let handle = try? FileHandle(forWritingTo: url) else { fileDone(false); return }
            incoming = (id, url, handle)
        }
        guard let file = incoming, file.id == id else { return }
        file.handle.write(data)
        guard i == n - 1 else { return }
        try? file.handle.close()
        incoming = nil
        exportM4A(wav: file.url, title: msg["title"] as? String, artist: msg["artist"] as? String, album: msg["album"] as? String)
    }

    /// AAC（m4a）にすると WAV の5分の1ほどの大きさになる。題名・学校名・年度も書き込む
    private func exportM4A(wav: URL, title: String?, artist: String?, album: String?) {
        let out = wav.deletingPathExtension().appendingPathExtension("m4a")
        try? FileManager.default.removeItem(at: out)
        guard let session = AVAssetExportSession(asset: AVURLAsset(url: wav), presetName: AVAssetExportPresetAppleM4A) else {
            deliver(wav); return
        }
        session.outputURL = out
        session.outputFileType = .m4a
        let tags: [(AVMetadataIdentifier, String?)] = [(.commonIdentifierTitle, title), (.commonIdentifierArtist, artist), (.commonIdentifierAlbumName, album)]
        session.metadata = tags.compactMap { key, value in
            guard let value else { return nil }
            let item = AVMutableMetadataItem()
            item.identifier = key
            item.value = value as NSString
            item.extendedLanguageTag = "und"
            return item
        }
        session.exportAsynchronously { [weak self] in
            let ok = session.status == .completed
            DispatchQueue.main.async {
                if ok { try? FileManager.default.removeItem(at: wav) }
                self?.deliver(ok ? out : wav)
            }
        }
    }

    private func deliver(_ url: URL) {
        if selfTest {
            // 動作確認：共有シートは出さず、できたファイルの大きさを記録する
            let size = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
            Self.output("FILE \(url.pathExtension) \(size) bytes")
            fileDone(size > 0)
            return
        }
        let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        if let pop = share.popoverPresentationController {
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 120, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        share.completionWithItemsHandler = { [weak self] _, _, _, _ in self?.fileDone(true) }
        present(share, animated: true)
    }

    private func fileDone(_ ok: Bool) {
        webView.evaluateJavaScript("window.onNativeFileDone && window.onNativeFileDone(\(ok))", completionHandler: nil)
    }

    private static func output(_ line: String) {
        print(line)
        fflush(stdout)
        // 動作確認のときは、CIから読めるようにアプリの書類フォルダにも書く
        if ProcessInfo.processInfo.arguments.contains("-selftest"),
           let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
            let file = dir.appendingPathComponent("selftest.txt")
            let old = (try? String(contentsOf: file, encoding: .utf8)) ?? ""
            try? (old + line + "\n").write(to: file, atomically: true, encoding: .utf8)
        }
    }

    private static func finishSelfTest(ok: Bool, detail: String) {
        output("SELFTEST \(ok ? "OK" : "FAIL") \(detail)")
        exit(ok ? 0 : 1)
    }

    /// アプリの中で動いていることと、起動引数（-tab play など。スクリーンショット用）をページに伝える
    private static func launchScript() -> String {
        let tab = UserDefaults.standard.string(forKey: "tab") ?? ""
        let safe = tab.filter { $0.isLetter }
        return "window.TSUKURIKATA_NATIVE = true; window.TSUKURIKATA_LAUNCH = {tab: '\(safe)'};"
    }

    /// ページで起きたエラーをアプリのログに出す
    private static let errorReporter = """
    (function(){
      var post = function(m){ try{ webkit.messageHandlers.native.postMessage({type: 'log', msg: m}); }catch(e){} };
      window.addEventListener('error', function(e){ post('error: ' + e.message + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ')'); });
      window.addEventListener('unhandledrejection', function(e){ var r = e.reason; post('rejection: ' + (r && r.message ? r.message : String(r))); });
    })();
    """
}

extension GameViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // ゲームの外へのリンクはSafariで開く
        if let url = action.request.url, url.scheme != BundleSchemeHandler.scheme, url.scheme != "about" {
            if action.navigationType == .linkActivated { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // メモリ不足などでページの処理が落ちたら読み直す（セーブは残っている）
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}

extension GameViewController: UIScrollViewDelegate {
    // ピンチやダブルタップで画面が拡大されないようにする
    func viewForZooming(in scrollView: UIScrollView) -> UIView? { nil }
}

/// WKUserContentController は登録した相手を強く持つので、画面を弱く参照する中継役をはさむ
private final class MessageProxy: NSObject, WKScriptMessageHandler {
    weak var target: GameViewController?

    init(_ target: GameViewController) { self.target = target }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.receive(message.body)
    }
}
