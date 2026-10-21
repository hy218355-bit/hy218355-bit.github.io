import SwiftUI
import AVFoundation

/// 吹部日誌：ゲーム本体（../suibu のHTML・JavaScript・録音）をアプリに同梱して、画面いっぱいに動かす
@main
struct SuibuApp: App {
    init() {
        // 音楽を聴くゲームなので、消音スイッチ（マナーモード）が入っていても音を出す
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
    }

    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .background(Color("Paper").ignoresSafeArea())
        }
    }
}

struct GameView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> GameViewController { GameViewController() }
    func updateUIViewController(_ controller: GameViewController, context: Context) {}
}
