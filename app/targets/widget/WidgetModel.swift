import CoreText
import Foundation
import SwiftUI

/// Palette du thème du jour, telle que stockée dans `themes.palette` (hex 6 chiffres).
struct WidgetPalette: Codable, Equatable {
    var accent: String
    var skyTop: String
    var skyBottom: String
    var sun: String
    var hillLight: String
    var hillMid: String

    enum CodingKeys: String, CodingKey {
        case accent, sun
        case skyTop = "sky_top"
        case skyBottom = "sky_bottom"
        case hillLight = "hill_light"
        case hillMid = "hill_mid"
    }
}

/// Nouvelle affichée par le widget. `imagePath` : fichier local (App Group) ou illustration de secours
/// embarquée (`fallback-<thème>`), jamais une URL distante : le widget ne charge rien au rendu.
struct WidgetStory: Codable, Equatable {
    var id: String?
    var themeId: String
    var themeLabel: String
    var titleMain: String
    var titleAccent: String?
    var source: String?
    var palette: WidgetPalette
    var imagePath: String?

    /// Aucune nouvelle validée pour aujourd'hui : promesse sur une illustration de secours du thème.
    static func waiting(themeId: String, themeLabel: String, palette: WidgetPalette) -> WidgetStory {
        WidgetStory(id: nil, themeId: themeId, themeLabel: themeLabel, titleMain: "Ta bonne nouvelle", titleAccent: "arrive demain matin.", source: nil, palette: palette, imagePath: nil)
    }

    var isWaiting: Bool { id == nil }

    /// Lien profond vers la nouvelle dans l'app (schéma `eclaircie`).
    var deepLink: URL? {
        guard let id else { return URL(string: "eclaircie://") }
        return URL(string: "eclaircie://story/\(id)")
    }
}

// MARK: - Couleurs

extension Color {
    /// `#RRGGBB` → Color sRGB. Noir si la chaîne est invalide.
    init(hex: String) {
        var value: UInt64 = 0
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        Scanner(string: cleaned).scanHexInt64(&value)
        self.init(.sRGB, red: Double((value >> 16) & 0xFF) / 255, green: Double((value >> 8) & 0xFF) / 255, blue: Double(value & 0xFF) / 255, opacity: 1)
    }
}

/// Mélange linéaire de deux hex (0 = a, 1 = b), composantes sRGB.
func mixHex(_ a: String, _ b: String, _ t: Double) -> Color {
    func rgb(_ hex: String) -> (Double, Double, Double) {
        var v: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)).scanHexInt64(&v)
        return (Double((v >> 16) & 0xFF) / 255, Double((v >> 8) & 0xFF) / 255, Double(v & 0xFF) / 255)
    }
    let (r1, g1, b1) = rgb(a)
    let (r2, g2, b2) = rgb(b)
    return Color(.sRGB, red: r1 + (r2 - r1) * t, green: g1 + (g2 - g1) * t, blue: b1 + (b2 - b1) * t, opacity: 1)
}

/// Jetons partagés avec l'app (`app/src/theme/tokens.ts`).
enum WidgetTokens {
    static let paper = "#F5EFE4"
    static let ink = "#1F1B16"
    /// Voile : part d'encre mélangée à l'accent, opacité maximale en bas.
    static let veilInk = 0.55
    static let veilMax = 0.74
    static let grainOpacity = 0.10
}

// MARK: - Polices

/// Polices embarquées dans l'extension (dossier `assets`), enregistrées une fois au premier rendu.
enum WidgetFonts {
    static let title = "Fraunces-SemiBold"
    static let titleAccent = "Fraunces-Italic"
    static let body = "DMSans-Regular"
    static let bodyBold = "DMSans-SemiBold"
    private static let files = ["Fraunces-SemiBold", "Fraunces-Italic", "DMSans-Regular", "DMSans-SemiBold"]
    private static var registered = false

    static func register(bundle: Bundle = .main) {
        guard !registered else { return }
        registered = true
        for file in files {
            guard let url = resourceURL(file, "ttf", bundle: bundle) else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}

/// Ressource de `assets/`, à plat dans le bundle (groupe synchronisé Xcode) ou dans un sous-dossier `assets`.
func resourceURL(_ name: String, _ ext: String, bundle: Bundle = .main) -> URL? {
    bundle.url(forResource: name, withExtension: ext) ?? bundle.url(forResource: name, withExtension: ext, subdirectory: "assets")
}

// MARK: - Images

#if canImport(UIKit)
import UIKit
typealias PlatformImage = UIImage
#elseif canImport(AppKit)
import AppKit
typealias PlatformImage = NSImage
#endif

extension Image {
    init?(platformFile path: String) {
        #if canImport(UIKit)
        guard let image = UIImage(contentsOfFile: path) else { return nil }
        self.init(uiImage: image)
        #else
        guard let image = NSImage(contentsOfFile: path) else { return nil }
        self.init(nsImage: image)
        #endif
    }
}

/// Illustration d'une nouvelle : son fichier local, sinon l'illustration de secours embarquée du thème.
func illustrationImage(for story: WidgetStory, bundle: Bundle = .main) -> Image? {
    if let path = story.imagePath, let image = Image(platformFile: path) { return image }
    guard let url = resourceURL("fallback-\(story.themeId)", "webp", bundle: bundle) else { return nil }
    return Image(platformFile: url.path)
}

func paperGrainImage(bundle: Bundle = .main) -> Image? {
    guard let url = resourceURL("paper-noise", "png", bundle: bundle) else { return nil }
    return Image(platformFile: url.path)
}
