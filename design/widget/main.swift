// Banc de capture macOS des vues du widget (SwiftUI + ImageRenderer), hors WidgetKit : mêmes fichiers
// Swift que la cible, données réelles (palettes des 7 thèmes, titre le plus long de chaque thème).
// Usage : design/widget/snapshot.sh  →  PNG dans design/widget/out/
import AppKit
import SwiftUI
import WidgetKit

let args = CommandLine.arguments
let assetsDir = args[1]
let outDir = args[2]
let bundle = Bundle(path: assetsDir)!

func palette(_ a: String, _ st: String, _ sb: String, _ sun: String, _ hl: String, _ hm: String) -> WidgetPalette {
    WidgetPalette(accent: a, skyTop: st, skyBottom: sb, sun: sun, hillLight: hl, hillMid: hm)
}
func story(_ theme: String, _ label: String, _ p: WidgetPalette, _ main: String, _ accent: String?, _ source: String?) -> WidgetStory {
    WidgetStory(id: theme, themeId: theme, themeLabel: label, titleMain: main, titleAccent: accent, source: source, palette: p, imagePath: nil, remoteImagePath: nil)
}
/// Palettes et titres tels qu'en base (2026-11-05), source déjà réduite au média.
let samples: [WidgetStory] = [
    story("planete", "Planète", palette("#2F6B5E", "#EFB98A", "#F4E5CC", "#EE8F48", "#B9D3B5", "#6FA48A"), "Les « polluants éternels »", "cèdent à plus basse chaleur.", "Phys.org"),
    story("animaux", "Animaux", palette("#7A4E14", "#F2C08E", "#F8E6CC", "#FFF1DA", "#E3B07A", "#C08040"), "Pour les chiens,", "des plaquettes gardées trois semaines.", "Phys.org"),
    story("science", "Science", palette("#3E3880", "#B9B2EC", "#ECE6F6", "#F6B877", "#B3ADE6", "#7F77CF"), "Les cinq « lettres » de la vie", "ont été trouvées dans un astéroïde.", "Science Daily"),
    story("sante", "Santé", palette("#8E3535", "#F1B9B0", "#FAE6DF", "#FFF2E4", "#EDB0A6", "#D27A70"), "Test HPV et IA :", "un dépistage plus efficace.", "Medical Xpress"),
    story("solidarite", "Solidarité", palette("#6B4F00", "#F3CF73", "#FBEFCB", "#EB8440", "#EDCF77", "#D2A22B"), "Un donneur de sang rare", "fait le tour de l'Australie.", "Good News Network"),
    story("inventions", "Inventions", palette("#24506F", "#A9CBE6", "#E6F0F7", "#F6B877", "#B5D0E6", "#6E9CC4"), "Des bactéries calculent", "plusieurs pistes à la fois.", "TechXplore"),
    WidgetStory.waiting(themeId: "culture", themeLabel: "Culture", palette: palette("#5E2D60", "#DDB8E0", "#F5E6F3", "#F09A4E", "#D9B5DB", "#AD70AF")),
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
    WidgetFonts.register(bundle: bundle)
    try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
    for story in samples {
        for (layout, label, size) in sizes {
            for variant in ["light", "dark", "accented"] {
                let dark = variant == "dark"
                let accented = variant == "accented"
                let scheme: ColorScheme = dark ? .dark : .light
                let name = "\(story.themeId)-\(label)-\(variant)"
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
                    let view = Group {
                        if layout == .medium { MediumWidgetBody(story: story, bundle: bundle) } else { SmallWidgetBody(story: story, bundle: bundle) }
                    }
                    .frame(width: size.width, height: size.height)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .padding(14)
                    .background(dark ? Color(hex: "#15181E") : Color(hex: "#E9E4DA"))
                    .environment(\.colorScheme, scheme)
                    .environment(\.widgetRenderingMode, accented ? .accented : .fullColor)
                    render(view, size: CGSize(width: size.width + 28, height: size.height + 28), name: name)
                }
            }
        }
    }
    print("ok")
}
MainActor.assumeIsolated { main() }
