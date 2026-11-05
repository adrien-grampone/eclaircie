import SwiftUI
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Format moyen, mise en page divisée : à gauche (~55 %) un panneau papier dans la couleur claire de la
/// palette, avec grain, pastille, titre à l'encre foncée du thème et média ; à droite l'illustration en
/// pleine couleur, sans voile, recadrée en portrait. La jonction est un bord irrégulier façon gouache.
enum MediumLayout {
    /// Part de la largeur occupée par le panneau papier (au milieu de son bord irrégulier).
    static let panelShare: CGFloat = 0.55
    /// Amplitude du bord gouache, en points.
    static let edgeAmplitude: CGFloat = 7
    /// Part de la hauteur de l'illustration placée au centre de la fenêtre portrait (soleil et sujet).
    static let focus: CGFloat = 0.5
}

/// Bord gauche → droite : rectangle dont le côté droit ondule (quelques courbes, amplitude fixe,
/// déterministe) comme une touche de gouache séchée ; `share` est la position moyenne du bord.
struct GouacheEdge: Shape {
    var share: CGFloat
    var amplitude: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let x = rect.minX + rect.width * share
        let h = rect.height
        // Points de contrôle : décalages pseudo-aléatoires mais stables (sinus de fréquences différentes).
        func dx(_ t: CGFloat) -> CGFloat { amplitude * (0.6 * sin(t * 9.4 + 0.8) + 0.4 * sin(t * 23.1 + 2.3)) }
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: x + dx(0) + amplitude * 0.5, y: rect.minY))
        let steps = 6
        for i in 1...steps {
            let t1 = CGFloat(i) / CGFloat(steps)
            let t0 = CGFloat(i - 1) / CGFloat(steps)
            let p1 = CGPoint(x: x + dx(t1), y: rect.minY + h * t1)
            let c1 = CGPoint(x: x + dx(t0 + 0.12) + amplitude * 0.8, y: rect.minY + h * (t0 + 0.33 / CGFloat(steps)))
            let c2 = CGPoint(x: x + dx(t1 - 0.12) - amplitude * 0.8, y: rect.minY + h * (t1 - 0.33 / CGFloat(steps)))
            path.addCurve(to: p1, control1: c1, control2: c2)
        }
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

/// Fond du format moyen : papier + illustration à droite + panneau gouache (le grain couvre tout).
struct MediumBackground: View {
    let story: WidgetStory
    var bundle: Bundle = .main
    private let aspect: CGFloat = 3.0 / 4.0

    var body: some View {
        GeometryReader { geo in
            let paper = Color(hex: story.palette.skyBottom)
            let panelWidth = geo.size.width * MediumLayout.panelShare
            let window = geo.size.width - panelWidth + MediumLayout.edgeAmplitude * 2
            let imageHeight = max(window / aspect, geo.size.height)
            ZStack(alignment: .topTrailing) {
                paper
                if let image = illustrationImage(for: story, bundle: bundle) {
                    accentedFullColor(image.resizable()).aspectRatio(aspect, contentMode: .fill)
                        .frame(width: window, height: imageHeight)
                        .offset(y: min(0, max(geo.size.height - imageHeight, geo.size.height / 2 - imageHeight * MediumLayout.focus)))
                        .frame(width: window, height: geo.size.height, alignment: .top)
                        .clipped()
                }
                GouacheEdge(share: MediumLayout.panelShare, amplitude: MediumLayout.edgeAmplitude)
                    .fill(paper)
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

/// Contenu du format moyen, dans le panneau : pastille, titre à l'encre du thème, média.
struct MediumContent: View {
    let story: WidgetStory

    var body: some View {
        let ink = mixHex(story.palette.accent, WidgetTokens.ink, 0.45)
        let caption = mixHex(story.palette.accent, WidgetTokens.ink, 0.2)
        GeometryReader { geo in
            VStack(alignment: .leading, spacing: 0) {
                ThemePill(label: story.themeLabel, accent: story.palette.accent, size: 10)
                Spacer(minLength: 6)
                StoryTitle(story: story, size: 17, lines: 3, color: ink)
                if let source = story.source, !story.isWaiting {
                    Text(source)
                        .font(.custom(WidgetFonts.titleAccent, size: 12))
                        .foregroundStyle(caption.opacity(0.85))
                        .lineLimit(1)
                        .padding(.top, 5)
                }
            }
            // Le panneau fait 55 % du widget, marges système comprises : le texte reste à l'écart du bord gouache.
            .frame(width: (geo.size.width + 32) * MediumLayout.panelShare - 32 - MediumLayout.edgeAmplitude, alignment: .leading)
            .frame(maxHeight: .infinity, alignment: .leading)
        }
    }
}
