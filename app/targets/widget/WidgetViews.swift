import SwiftUI

/// Formats rendus (indépendant de WidgetKit pour pouvoir être compilé par le banc de capture macOS).
enum WidgetLayout {
    case small, medium, accessory
}

/// Tailles de texte par format.
private struct Metrics {
    let title: CGFloat
    let titleLines: Int
    let source: CGFloat
    let pill: CGFloat
    static func of(_ layout: WidgetLayout) -> Metrics {
        switch layout {
        case .small: return Metrics(title: 15, titleLines: 3, source: 11, pill: 9.5)
        case .medium: return Metrics(title: 18, titleLines: 3, source: 12, pill: 10)
        case .accessory: return Metrics(title: 14, titleLines: 2, source: 11, pill: 10)
        }
    }
}

/// Titre en deux parties : principale en Fraunces semi-gras, accent en Fraunces italique, même corps.
struct StoryTitle: View {
    let story: WidgetStory
    let size: CGFloat
    let lines: Int
    let color: Color

    var body: some View {
        (Text(story.titleMain).font(.custom(WidgetFonts.title, size: size))
            + Text(story.titleAccent.map { " \($0)" } ?? "").font(.custom(WidgetFonts.titleAccent, size: size)))
            .foregroundStyle(color)
            .lineSpacing(size * 0.12)
            .lineLimit(lines)
            .truncationMode(.tail)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Pastille du thème : point d'accent + libellé en capitales, sur crème translucide.
struct ThemePill: View {
    let label: String
    let accent: String
    let size: CGFloat

    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(Color(hex: accent)).frame(width: size * 0.7, height: size * 0.7)
            Text(label.uppercased())
                .font(.custom(WidgetFonts.bodyBold, size: size))
                .tracking(1.2)
                .foregroundStyle(Color(hex: WidgetTokens.ink))
        }
        .padding(.horizontal, size * 0.9)
        .padding(.vertical, size * 0.5)
        .background { Capsule().fill(Color(hex: WidgetTokens.paper).opacity(0.88)).accentGroup() }
    }
}

/// Fond du petit format : illustration bord à bord à pleine saturation, voile court seulement en bas
/// (sous le texte, accent assombri, jamais un aplat noir), grain papier en multiply. `focus` : part de la
/// hauteur de l'illustration (3:4) placée au centre du cadre, pour garder soleil et collines.
struct StoryBackground: View {
    let story: WidgetStory
    var bundle: Bundle = .main
    var focus: CGFloat = 0.6
    private let aspect: CGFloat = 3.0 / 4.0
    /// Début du voile (part de la hauteur) : juste au-dessus du titre.
    static let veilStart: CGFloat = 0.38
    /// Courbe du voile : < 2 pour monter plus vite sous la première ligne du titre.
    static let veilPower: Double = 1.2

    var body: some View {
        let veil = mixHex(story.palette.accent, WidgetTokens.ink, WidgetTokens.veilInk)
        GeometryReader { geo in
            let w = geo.size.width
            let h = max(w / aspect, geo.size.height)
            ZStack(alignment: .top) {
                Color(hex: story.palette.skyBottom)
                if let image = illustrationImage(for: story, bundle: bundle) {
                    accentedFullColor(image.resizable()).aspectRatio(aspect, contentMode: .fill)
                        .frame(width: w, height: h)
                        .offset(y: min(0, max(geo.size.height - h, geo.size.height / 2 - h * focus)))
                }
                // Courbe douce (quadratique) sur la moitié basse : aucune cassure visible, aucun aplat.
                LinearGradient(stops: (0...8).map { i in
                    let t = CGFloat(i) / 8
                    return .init(color: veil.opacity(WidgetTokens.veilMax * pow(Double(t), Self.veilPower)), location: Self.veilStart + (1 - Self.veilStart) * t)
                }, startPoint: .top, endPoint: .bottom)
                .accentGroup()
                if let grain = paperGrainImage(bundle: bundle) {
                    grain.resizable().aspectRatio(contentMode: .fill)
                        .frame(width: geo.size.width, height: geo.size.height)
                        .blendMode(.multiply).opacity(WidgetTokens.grainOpacity)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipped()
        }
    }
}

/// Contenu du petit format (sur `StoryBackground`) : pastille en haut, titre héros en bas.
struct StoryContent: View {
    let story: WidgetStory
    let layout: WidgetLayout

    var body: some View {
        let m = Metrics.of(layout)
        let cream = Color(hex: WidgetTokens.paper)
        VStack(alignment: .leading, spacing: 0) {
            ThemePill(label: story.themeLabel, accent: story.palette.accent, size: m.pill)
            Spacer(minLength: 6)
            StoryTitle(story: story, size: m.title, lines: m.titleLines, color: cream)
                .shadow(color: Color.black.opacity(0.4), radius: 3, x: 0, y: 1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

/// Écran verrouillé (accessoryRectangular) : thème + titre, texte seul, rendu vibrant par le système.
struct AccessoryContent: View {
    let story: WidgetStory

    var body: some View {
        let m = Metrics.of(.accessory)
        VStack(alignment: .leading, spacing: 2) {
            Text(story.themeLabel.uppercased())
                .font(.custom(WidgetFonts.bodyBold, size: m.pill))
                .tracking(1.2)
                .opacity(0.75)
            StoryTitle(story: story, size: m.title, lines: m.titleLines, color: .primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}
