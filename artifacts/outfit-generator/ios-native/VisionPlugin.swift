import Foundation
import Capacitor
import Vision
import UIKit

/**
 * VisionPlugin — native iOS image analysis for search indexing.
 *
 * Runs VNClassifyImageRequest (confidence ≥ 0.3) and VNRecognizeTextRequest
 * (accurate mode) on a background queue. Returns labels and recognised text
 * to the web layer. Falls back silently to empty arrays on any error.
 */
@objc(VisionPlugin)
public class VisionPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier    = "VisionPlugin"
    public let jsName        = "VisionPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "analyze", returnType: CAPPluginReturnPromise)
    ]

    @objc func analyze(_ call: CAPPluginCall) {
        guard
            let dataUrl  = call.getString("dataUrl"),
            let commaIdx = dataUrl.firstIndex(of: ",")
        else {
            call.resolve(["labels": [], "text": []])
            return
        }

        let b64 = String(dataUrl[dataUrl.index(after: commaIdx)...])
        guard
            let imageData = Data(base64Encoded: b64, options: .ignoreUnknownCharacters),
            let uiImage   = UIImage(data: imageData),
            let cgImage   = uiImage.cgImage
        else {
            call.resolve(["labels": [], "text": []])
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            var labels: [String] = []
            var texts:  [String] = []
            let group = DispatchGroup()

            // ── Classification ──────────────────────────────────────────────
            group.enter()
            let classifyReq = VNClassifyImageRequest { req, _ in
                labels = (req.results as? [VNClassificationObservation] ?? [])
                    .filter { $0.confidence >= 0.3 }
                    .map    { $0.identifier }
                group.leave()
            }

            // ── Text recognition ────────────────────────────────────────────
            group.enter()
            let textReq = VNRecognizeTextRequest { req, _ in
                texts = (req.results as? [VNRecognizedTextObservation] ?? [])
                    .compactMap { $0.topCandidates(1).first?.string }
                group.leave()
            }
            textReq.recognitionLevel = .accurate

            do {
                try handler.perform([classifyReq, textReq])
            } catch {
                // leave both groups so wait() returns
                group.leave()
                group.leave()
            }

            group.wait()
            call.resolve(["labels": labels, "text": texts])
        }
    }
}
