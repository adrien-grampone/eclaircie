import ExpoModulesCore
import ImageIO
import UniformTypeIdentifiers
import WidgetKit

/// Pont app → widget : charge utile dans les UserDefaults de l'App Group, illustration du jour réduite
/// (côté max `maxSide`, JPEG : les widgets ont ~30 Mo de mémoire) dans le conteneur partagé, rechargement.
public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    /// Écrit la charge utile JSON lue par le widget (WidgetStore.swift).
    Function("writePayload") { (key: String, json: String, appGroup: String) in
      UserDefaults(suiteName: appGroup)?.set(json, forKey: key)
    }

    /// Demande à iOS de recalculer la timeline du widget.
    Function("reload") { (kind: String) in
      WidgetCenter.shared.reloadTimelines(ofKind: kind)
    }

    /// Renvoie le chemin du fichier écrit, ou lève si le conteneur ou l'image sont indisponibles.
    AsyncFunction("store") { (sourcePath: String, appGroup: String, maxSide: Int) throws -> String in
      guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
        throw Exception(name: "NoAppGroup", description: "conteneur \(appGroup) indisponible")
      }
      let dir = base.appendingPathComponent("widget-app", isDirectory: true)
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      let data = try Data(contentsOf: URL(fileURLWithPath: sourcePath.replacingOccurrences(of: "file://", with: "")))
      let options: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: maxSide,
                                      kCGImageSourceCreateThumbnailWithTransform: true]
      guard let source = CGImageSourceCreateWithData(data as CFData, nil),
            let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
        throw Exception(name: "BadImage", description: "image illisible : \(sourcePath)")
      }
      let out = NSMutableData()
      guard let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else {
        throw Exception(name: "Encode", description: "encodage JPEG impossible")
      }
      CGImageDestinationAddImage(dest, cg, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
      CGImageDestinationFinalize(dest)
      let target = dir.appendingPathComponent("illustration.jpg")
      try (out as Data).write(to: target, options: .atomic)
      return target.path
    }
  }
}
