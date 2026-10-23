// 楽譜の PDF を、読める大きさの画像にする（macOS の PDFKit を使う）
//   swiftc -O tsukurikata/tools/pdfcrop.swift -o /tmp/pdfcrop
//   /tmp/pdfcrop <pdf> <ページ(1〜)> <dpi> [左 上 右 下（ページに対する割合 0〜1）] <出力png>
//   例：ページ全体を200dpiで → /tmp/pdfcrop score.pdf 3 200 p3.png
//       右上の4分の1を400dpiで → /tmp/pdfcrop score.pdf 3 400 0.5 0 1 0.5 p3_ru.png
import Foundation
import PDFKit
import AppKit

let a = CommandLine.arguments
guard a.count == 5 || a.count == 9, let doc = PDFDocument(url: URL(fileURLWithPath: a[1])), let page = doc.page(at: (Int(a[2]) ?? 1) - 1) else {
  print("使い方: pdfcrop <pdf> <ページ> <dpi> [左 上 右 下] <出力png>"); exit(1)
}
let dpi = Double(a[3])!
let (l, t, r, b) = a.count == 9 ? (Double(a[4])!, Double(a[5])!, Double(a[6])!, Double(a[7])!) : (0.0, 0.0, 1.0, 1.0)
let box = page.bounds(for: .mediaBox), s = dpi / 72.0
let w = Int(box.width * (r - l) * s), h = Int(box.height * (b - t) * s)
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                           isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
let ctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.current = ctx
let cg = ctx.cgContext
cg.setFillColor(NSColor.white.cgColor); cg.fill(CGRect(x: 0, y: 0, width: w, height: h))
cg.scaleBy(x: s, y: s)
cg.translateBy(x: -box.width * l, y: -box.height * (1 - b))
page.draw(with: .mediaBox, to: cg)
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[a.count - 1]))
print("\(doc.pageCount)ページ中 \(a[2])ページ目 → \(w)x\(h)")
