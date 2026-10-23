import SwiftUI
import AVFoundation

/// 吹奏楽部のつくりかた：ゲーム本体（../tsukurikata のHTML・JavaScript・録音）をアプリに同梱して、画面いっぱいに動かす
@main
struct TsukurikataApp: App {
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
