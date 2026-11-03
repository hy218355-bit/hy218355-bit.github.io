import Foundation
import Vision
import AppKit

// 撮影済みの実画面を文字認識し、OS通知や英語版の日本語本文を確認する。
let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let folder = root.appendingPathComponent("screenshots")
let urls = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil).filter { $0.pathExtension == "png" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
var results: [[String: Any]] = []
var failures = 0
for url in urls {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = url.lastPathComponent.hasPrefix("en-") ? ["en-US"] : ["ja-JP", "en-US"]
    try VNImageRequestHandler(url: url).perform([request])
    let observations = request.results ?? []
    let body = observations.filter { $0.boundingBox.maxY < 0.965 }.compactMap { $0.topCandidates(1).first?.string }
    let notification = body.filter { $0.contains("Apple Intelligence") || $0.contains("パーソナルインテリジェンス") }
    let untranslated = url.lastPathComponent.hasPrefix("en-") ? body.filter { $0.range(of: "[ぁ-んァ-ヶ一-龯]", options: .regularExpression) != nil } : []
    if !notification.isEmpty || !untranslated.isEmpty { failures += 1 }
    results.append(["file": url.lastPathComponent, "recognizedLines": body.count, "notification": notification, "untranslated": untranslated])
}
let record: [String: Any] = ["images": results.count, "failures": failures, "results": results]
try JSONSerialization.data(withJSONObject: record, options: [.prettyPrinted, .sortedKeys]).write(to: root.appendingPathComponent("ocr-checks.json"))
print("確認した実画面: \(results.count)、要確認: \(failures)")
