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
        case .small: return Metrics(title: 15, titleLines: 4, source: 11, pill: 9.5)
        case .medium: return Metrics(title: 18, titleLines: 3, source: 12, pill: 10)
        case .accessory: return Metrics(title: 13, titleLines: 3, source: 11, pill: 9)
        }
    }
}

/// Variantes d'un titre, de la plus fidèle à la plus courte : taille pleine, réduite (jusqu'à `minScale`),
/// puis coupée mot par mot (accent d'abord, puis principal) avec « … » après un mot entier. Jamais une coupe
/// au milieu d'un mot.
struct TitleCandidate: Hashable {
    let main: String
    let accent: String?
    let scale: CGFloat
}

func titleCandidates(main: String, accent: String?, minScale: CGFloat = 0.8) -> [TitleCandidate] {
    var out = [TitleCandidate(main: main, accent: accent, scale: 1), TitleCandidate(main: main, accent: accent, scale: 0.9),
               TitleCandidate(main: main, accent: accent, scale: minScale)]
    var mainWords = main.split(separator: " ").map(String.init)
    var accentWords = (accent ?? "").split(separator: " ").map(String.init)
    let ellipsis = "…"
    while mainWords.count + accentWords.count > 2 {
        if !accentWords.isEmpty { accentWords.removeLast() } else { mainWords.removeLast() }
        let cutMain = accentWords.isEmpty ? mainWords.joined(separator: " ") + ellipsis : mainWords.joined(separator: " ")
        let cutAccent = accentWords.isEmpty ? nil : accentWords.joined(separator: " ") + ellipsis
        out.append(TitleCandidate(main: cutMain, accent: cutAccent, scale: minScale))
    }
    return out
}

/// Titre en deux parties : principale en Fraunces semi-gras, accent en Fraunces italique, même corps.
/// `ViewThatFits` retient la première variante qui tient ENTIÈRE dans `lines` lignes et la hauteur disponible :
/// aucune variante n'a de lineLimit (SwiftUI couperait lui-même, au milieu d'un mot) ; `LineCap` refuse celles qui
/// dépassent `lines` lignes, mesurées sur un texte de référence. Seule la dernière (deux mots + « … ») garde un lineLimit, en filet de sécurité.
struct StoryTitle: View {
    let story: WidgetStory
    let size: CGFloat
    let lines: Int
    let color: Color

    var body: some View {
        let candidates = titleCandidates(main: story.titleMain, accent: story.titleAccent)
        ViewThatFits(in: .vertical) {
            ForEach(Array(candidates.enumerated()), id: \.offset) { index, c in
                let pt = size * c.scale
                if index == candidates.count - 1 {
                    titleText(c.main, c.accent, pt).lineLimit(lines)
                } else {
                    LineCap {
                        titleText(c.main, c.accent, pt)
                        titleText(Array(repeating: "Ég", count: lines).joined(separator: "\n"), "g", pt).hidden()
                    }
                }
            }
        }
    }

    private func titleText(_ main: String, _ accent: String?, _ pt: CGFloat) -> some View {
        (Text(main).font(.custom(WidgetFonts.title, size: pt))
            + Text(accent.map { " \($0)" } ?? "").font(.custom(WidgetFonts.titleAccent, size: pt)))
            .foregroundStyle(color)
            .lineSpacing(pt * 0.12)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Mesure son premier enfant (le titre) à la largeur proposée et le compare au second (un texte de référence de
/// `lines` lignes, même style, caché) : si le titre est plus haut, annonce une hauteur infinie pour que
/// `ViewThatFits` passe à la variante suivante.
struct LineCap: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard subviews.count == 2 else { return .zero }
        let free = ProposedViewSize(width: proposal.width, height: nil)
        let size = subviews[0].sizeThatFits(free)
        let limit = subviews[1].sizeThatFits(free).height
        return size.height > limit + 0.5 ? CGSize(width: size.width, height: .greatestFiniteMagnitude) : size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        subviews.first?.place(at: bounds.origin, proposal: ProposedViewSize(width: bounds.width, height: nil))
        // La référence, cachée, est posée sans taille.
        if subviews.count == 2 { subviews[1].place(at: bounds.origin, proposal: .zero) }
    }
}

/// Pastille du thème : point d'accent + libellé en capitales, sur crème translucide. En mode teinté : fond
/// dans le groupe accent, atténué, texte et point dans le groupe par défaut (blanc) pour un vrai contraste.
struct ThemePill: View {
    let label: String
    let accent: String
    let size: CGFloat
    /// Mode teinté sans fond (petit format, posée sur la zone claire de l'image) : point et texte blancs, ombre légère.
    var bareWhenAccented = false

    var body: some View {
        RenderingModeReader { accented in
            HStack(spacing: 5) {
                Circle().fill(accented ? Color.white : Color(hex: accent)).frame(width: size * 0.7, height: size * 0.7)
                Text(label.uppercased())
                    .font(.custom(WidgetFonts.bodyBold, size: size))
                    .tracking(1.2)
                    .foregroundStyle(accented ? Color.white : Color(hex: WidgetTokens.ink))
            }
            .shadow(color: Color.black.opacity(accented && bareWhenAccented ? 0.45 : 0), radius: 2, x: 0, y: 1)
            .padding(.horizontal, size * 0.9)
            .padding(.vertical, size * 0.5)
            .background {
                if accented {
                    if !bareWhenAccented { Capsule().fill(Color.white).opacity(AccentPolicy.pillBackground).accentGroup() }
                } else {
                    Capsule().fill(Color(hex: WidgetTokens.paper).opacity(0.88))
                }
            }
        }
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
    static let veilStart: CGFloat = 0.34
    /// Courbe du voile : < 2 pour monter plus vite sous la première ligne du titre.
    static let veilPower: Double = 1.15
    /// Mode teinté : l'image est opaque jusqu'à 40 % de la hauteur et s'efface jusqu'à 70 %.
    static let accentedMaskFrom: CGFloat = 0.4
    static let accentedMaskTo: CGFloat = 0.7

    var body: some View {
        let veil = mixHex(story.palette.accent, WidgetTokens.ink, WidgetTokens.veilInk)
        RenderingModeReader { accented in
        GeometryReader { geo in
            let w = geo.size.width
            let h = max(w / aspect, geo.size.height)
            ZStack(alignment: .top) {
                // Couche de base ciel : jamais en mode teinté (iOS la rendrait en aplat uni).
                if !accented { Color(hex: story.palette.skyBottom) }
                if let image = illustrationImage(for: story, bundle: bundle) {
                    // L'image (plus haute que le cadre) ne dicte jamais la taille de la pile : cadre fixe + clip.
                    let framed = accentedFullColor(image.resizable()).aspectRatio(aspect, contentMode: .fill)
                        .frame(width: w, height: h)
                        .offset(y: min(0, max(geo.size.height - h, geo.size.height / 2 - h * focus)))
                        .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
                        .clipped()
                    if accented {
                        // Mode teinté : le bas de l'image s'efface (masque, aucune forme ajoutée) et laisse le fond
                        // système sombre derrière le titre.
                        framed.mask {
                            LinearGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: Self.accentedMaskFrom),
                                                   .init(color: .clear, location: Self.accentedMaskTo), .init(color: .clear, location: 1)],
                                           startPoint: .top, endPoint: .bottom)
                        }
                    } else {
                        framed
                    }
                }
                // Courbe douce (quadratique) sur la moitié basse : aucune cassure visible, aucun aplat.
                // Mode teinté : aucun voile (il serait rendu en aplat accent) ; texte clair avec son ombre, direct sur l'image.
                if !accented {
                    LinearGradient(stops: (0...8).map { i in
                        let t = CGFloat(i) / 8
                        return .init(color: veil.opacity(WidgetTokens.veilMax * pow(Double(t), Self.veilPower)), location: Self.veilStart + (1 - Self.veilStart) * t)
                    }, startPoint: .top, endPoint: .bottom)
                }
                // Grain en multiply : jamais en mode teinté (le mode de fusion aplatit la composition).
                if !accented, let grain = paperGrainImage(bundle: bundle) {
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
}

/// Contenu du petit format (sur `StoryBackground`) : pastille en haut, titre héros en bas.
struct StoryContent: View {
    let story: WidgetStory
    let layout: WidgetLayout

    var body: some View {
        let m = Metrics.of(layout)
        let cream = Color(hex: WidgetTokens.paper)
        VStack(alignment: .leading, spacing: 0) {
            ThemePill(label: story.themeLabel, accent: story.palette.accent, size: m.pill, bareWhenAccented: true)
            Spacer(minLength: 6)
            StoryTitle(story: story, size: m.title, lines: m.titleLines, color: cream)
                .shadow(color: Color.black.opacity(0.4), radius: 3, x: 0, y: 1)
                // Halo flou de la couleur du voile, derrière le bloc de titre seulement : lisible sur une
                // illustration claire sans ternir le haut de l'image.
                .background {
                    RenderingModeReader { accented in
                        if !accented {
                            Rectangle().fill(mixHex(story.palette.accent, WidgetTokens.ink, WidgetTokens.veilInk).opacity(0.5))
                                .blur(radius: 18).padding(.horizontal, -18).padding(.vertical, -14)
                        }
                    }
                }
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
                .opacity(0.55)
            StoryTitle(story: story, size: m.title, lines: m.titleLines, color: .primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}
