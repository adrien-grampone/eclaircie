// Banc de capture macOS des vues du widget (SwiftUI + ImageRenderer), hors WidgetKit : mêmes fichiers
// Swift que la cible (targets/widget/WidgetModel.swift, WidgetViews.swift), données d'exemple.
// Usage : design/widget/snapshot.sh  →  PNG dans design/widget/out/
import AppKit
import SwiftUI

let args = CommandLine.arguments
let assetsDir = args[1]
let outDir = args[2]
let bundle = Bundle(path: assetsDir)!
WidgetFonts.register(bundle: bundle)
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

func palette(_ a: String, _ st: String, _ sb: String, _ sun: String, _ hl: String, _ hm: String) -> WidgetPalette {
    WidgetPalette(accent: a, skyTop: st, skyBottom: sb, sun: sun, hillLight: hl, hillMid: hm)
}
let samples: [(String, WidgetStory)] = [
    ("animaux", WidgetStory(id: "a", themeId: "animaux", themeLabel: "Animaux", titleMain: "Pour les chiens,", titleAccent: "des plaquettes gardées trois semaines.", source: "Phys.org",
        palette: palette("#7A4E14", "#F2C08E", "#F8E6CC", "#FFF1DA", "#E3B07A", "#C08040"), imagePath: nil, remoteImagePath: nil)),
    ("science", WidgetStory(id: "s", themeId: "science", themeLabel: "Science", titleMain: "Les cinq « lettres » de la vie", titleAccent: "ont été trouvées dans un astéroïde.", source: "Science Daily",
        palette: palette("#2F5D50", "#CFE3D6", "#F1F5EC", "#F4C27A", "#BFD9C8", "#7FAE96"), imagePath: nil, remoteImagePath: nil)),
    ("culture", WidgetStory.waiting(themeId: "culture", themeLabel: "Culture",
        palette: palette("#5E2D60", "#DDB8E0", "#F5E6F3", "#F09A4E", "#D9B5DB", "#AD70AF"))),
]

/// Gabarits iPhone 6,7" : petit 170×170, moyen 364×170, rectangulaire verrouillé ≈ 172×76.
let sizes: [(WidgetLayout, String, CGSize)] = [(.small, "small", CGSize(width: 170, height: 170)), (.medium, "medium", CGSize(width: 364, height: 170)), (.accessory, "accessory", CGSize(width: 172, height: 76))]

@MainActor
func render<V: View>(_ view: V, size: CGSize, name: String) {
    let renderer = ImageRenderer(content: view.frame(width: size.width, height: size.height))
    renderer.scale = 3
    guard let image = renderer.nsImage, let tiff = image.tiffRepresentation,
          let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) else { print("échec \(name)"); return }
    try! png.write(to: URL(fileURLWithPath: "\(outDir)/\(name).png"))
}

@MainActor
func main() {
    for (theme, story) in samples {
        for (layout, label, size) in sizes {
            for dark in [false, true] {
                let scheme: ColorScheme = dark ? .dark : .light
                let name = "\(theme)-\(label)-\(dark ? "dark" : "light")"
                if layout == .accessory {
                    // Écran verrouillé : texte vibrant (blanc) sur le fond d'écran ; simulé par un fond uni assombri.
                    let view = ZStack {
                        RoundedRectangle(cornerRadius: 14).fill(Color.white.opacity(dark ? 0.16 : 0.22))
                        AccessoryContent(story: story).foregroundStyle(.white).padding(.horizontal, 10).padding(.vertical, 6)
                    }
                    .padding(10)
                    .background(dark ? Color(hex: "#1E2A3A") : Color(hex: "#6D7E9B"))
                    .environment(\.colorScheme, scheme)
                    render(view, size: CGSize(width: size.width + 20, height: size.height + 20), name: name)
                } else {
                    // Écran d'accueil : coins 22 pt et marges de contenu 16 pt comme containerBackground d'iOS 17.
                    let view = ZStack {
                        if layout == .medium {
                            MediumBackground(story: story, bundle: bundle)
                            MediumContent(story: story).padding(16)
                        } else {
                            StoryBackground(story: story, bundle: bundle)
                            StoryContent(story: story, layout: layout).padding(16)
                        }
                    }
                    .frame(width: size.width, height: size.height)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .padding(14)
                    .background(dark ? Color(hex: "#15181E") : Color(hex: "#E9E4DA"))
                    .environment(\.colorScheme, scheme)
                    render(view, size: CGSize(width: size.width + 28, height: size.height + 28), name: name)
                }
            }
        }
    }
    print("ok")
}
MainActor.assumeIsolated { main() }
