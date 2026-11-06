import CoreText
import Foundation
import ImageIO
import SwiftUI
import UniformTypeIdentifiers
#if canImport(WidgetKit)
import WidgetKit
#endif

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
    /// Chemin dans le bucket `illustrations` (image_path), pour que le widget la télécharge lui-même.
    var remoteImagePath: String?

    /// Aucune nouvelle validée pour aujourd'hui : promesse sur une illustration de secours du thème.
    static func waiting(themeId: String, themeLabel: String, palette: WidgetPalette) -> WidgetStory {
        WidgetStory(id: nil, themeId: themeId, themeLabel: themeLabel, titleMain: "Ta bonne nouvelle", titleAccent: "arrive demain matin.", source: nil, palette: palette, imagePath: nil, remoteImagePath: nil)
    }

    var isWaiting: Bool { id == nil }

    /// Lien profond vers la nouvelle dans l'app (schéma `eclaircie`).
    var deepLink: URL? {
        guard let id else { return URL(string: "eclaircie://") }
        return URL(string: "eclaircie://story/\(id)")
    }
}

/// Nom du média seul, sans la rubrique accolée après un tiret ou une barre (« Phys.org — Biology » → « Phys.org »).
/// Même règle que `sourceLabel` dans l'app.
func sourceLabel(_ name: String) -> String {
    let parts = name.components(separatedBy: CharacterSet(charactersIn: "—–|"))
    let media = (parts.first ?? name).trimmingCharacters(in: .whitespaces)
    return media.isEmpty ? name.trimmingCharacters(in: .whitespaces) : media
}

/// Typographie française à l'affichage, même règle que `frenchTypography` dans l'app : fine insécable
/// (U+202F) dans les groupes de chiffres, avant ; ? ! » et après « ; insécable (U+00A0) avant : et les unités.
func frenchTypography(_ text: String) -> String {
    let thin = "\u{202F}", nbsp = "\u{00A0}", sp = "[ \u{00A0}\u{202F}]"
    var t = text
    func sub(_ pattern: String, _ template: String, repeat count: Int = 1) {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return }
        for _ in 0..<count { t = re.stringByReplacingMatches(in: t, range: NSRange(t.startIndex..., in: t), withTemplate: template) }
    }
    sub("(\\d)\(sp)(?=\\d{3}(?!\\d))", "$1\(thin)", repeat: 2)
    sub("(\\S)\(sp)*([;?!»])", "$1\(thin)$2")
    sub("(«)\(sp)*", "$1\(thin)")
    sub("(\\S)\(sp)*:(?![/\\d])", "$1\(nbsp):")
    sub("(\\d)\(sp)(°C|°F|km/h|km|kg|cm|mm|mg|ha|min|ms|Mo|Go|ko|kW|MW|m|g|h|s|L|l|W)(?![\\p{L}\\d])", "$1\(nbsp)$2")
    sub("(\\d)\(sp)?(%|°|€)", "$1\(nbsp)$2")
    return t
}

// MARK: - Mode « teinté » d'iOS 18

/// En mode teinté, iOS rend tout en monochrome sauf les images déclarées `fullColor`. Deux groupes :
/// « accent » (couleur de teinte) et « par défaut » (blanc). Pas de mode de fusion ni de flou dans ce mode :
/// ils aplatissent la composition et peuvent faire disparaître l'illustration.
/// Repli possible si `fullColor` restait ignoré sur un appareil : `.accentedDesaturated` (monochrome teinté).
enum AccentPolicy {
    static let illustrationFullColor = true
    /// Opacité du fond de la pastille (groupe accent) en mode teinté : texte et point blancs lisibles dessus.
    static let pillBackground = 0.25
}

/// Illustration gardée en pleine couleur quand iOS teinte le widget. Appliqué DIRECTEMENT sur l'Image.
@ViewBuilder
func accentedFullColor(_ image: Image) -> some View {
    #if canImport(WidgetKit) && os(iOS)
    if #available(iOS 18.0, *) {
        if AccentPolicy.illustrationFullColor {
            image.widgetAccentedRenderingMode(.fullColor)
        } else {
            image.widgetAccentedRenderingMode(.accentedDesaturated)
        }
    } else {
        image
    }
    #else
    image
    #endif
}

extension View {
    /// Groupe « accent » du mode teinté : la vue prend la couleur de teinte, le texte (groupe par défaut,
    /// blanc) reste lisible dessus. Sans effet en rendu normal.
    @ViewBuilder
    func accentGroup() -> some View {
        #if canImport(WidgetKit)
        self.widgetAccentable()
        #else
        self
        #endif
    }
}

/// Vrai quand le widget est rendu en mode teinté (iOS 18). Faux hors WidgetKit.
struct RenderingModeReader<Content: View>: View {
    @ViewBuilder let content: (Bool) -> Content
    #if canImport(WidgetKit)
    @Environment(\.widgetRenderingMode) private var mode
    var body: some View { content(mode == .accented) }
    #else
    var body: some View { content(false) }
    #endif
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
    static let veilMax = 0.8
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

/// Même hachage FNV-1a que `pickFallbackImage` du pipeline : l'app et le widget choisissent la même image.
func fnv1a(_ text: String) -> UInt32 {
    var hash: UInt32 = 2_166_136_261
    for unit in text.utf16 {
        hash ^= UInt32(unit)
        hash = hash &* 16_777_619
    }
    return hash
}

/// Illustration de secours embarquée d'un thème (fichiers `fallback__<thème>__<nom>.webp`, mêmes noms que le
/// bucket) : choix déterministe par la graine (id de la nouvelle, ou thème pour la promesse du lendemain).
func fallbackImageURL(themeId: String, seed: String, bundle: Bundle = .main) -> URL? {
    let prefix = "fallback__\(themeId)__"
    let urls = ((bundle.urls(forResourcesWithExtension: "webp", subdirectory: nil) ?? [])
        + (bundle.urls(forResourcesWithExtension: "webp", subdirectory: "assets") ?? []))
        .filter { $0.lastPathComponent.hasPrefix(prefix) }
        .sorted { $0.lastPathComponent < $1.lastPathComponent }
    guard !urls.isEmpty else { return nil }
    return urls[Int(fnv1a(seed) % UInt32(urls.count))]
}

/// Illustration d'une nouvelle : son fichier local (App Group), sinon l'illustration de secours embarquée.
func illustrationImage(for story: WidgetStory, bundle: Bundle = .main) -> Image? {
    if let path = story.imagePath, let image = Image(platformFile: path) { return image }
    guard let url = fallbackImageURL(themeId: story.themeId, seed: story.id ?? story.themeId, bundle: bundle) else { return nil }
    return Image(platformFile: url.path)
}

/// Réduction d'une image (données brutes) à `maxSide` points de côté, en JPEG, via ImageIO : peu de mémoire.
func downsampledJPEG(_ data: Data, maxSide: Int, quality: CGFloat = 0.85) -> Data? {
    let options: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: maxSide,
                                    kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceShouldCacheImmediately: true]
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
    let out = NSMutableData()
    guard let dest = CGImageDestinationCreateWithData(out, "public.jpeg" as CFString, 1, nil) else { return nil }
    CGImageDestinationAddImage(dest, cg, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    return CGImageDestinationFinalize(dest) ? out as Data : nil
}

func paperGrainImage(bundle: Bundle = .main) -> Image? {
    guard let url = resourceURL("paper-noise", "png", bundle: bundle) else { return nil }
    return Image(platformFile: url.path)
}
