// 自作SVGをmacOS標準の描画でPNGへ書き出す。通信は行わない。
import AppKit
import Foundation
let args = CommandLine.arguments
for path in args.dropFirst() {
    let url = URL(fileURLWithPath: path)
    guard let image = NSImage(contentsOf: url) else { fatalError("SVGを開けません：\(path)") }
    let size = 1024
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSGraphicsContext.current?.imageInterpolation = .high
    image.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
    NSGraphicsContext.restoreGraphicsState()
    try rep.representation(using: .png, properties: [:])!.write(to: url.deletingPathExtension().appendingPathExtension("png"))
    print("書き出し：\(url.lastPathComponent)")
}
