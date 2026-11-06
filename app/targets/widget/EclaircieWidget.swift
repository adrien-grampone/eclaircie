import SwiftUI
import WidgetKit

/// Identifiant de la timeline (utilisé par `ExtensionStorage.reloadWidget` côté app).
let widgetKind = "EclaircieWidget"
/// App Group partagé avec l'app.
let appGroup = "group.app.eclaircie"

struct StoryEntry: TimelineEntry {
    let date: Date
    let story: WidgetStory
}

/// Aperçu dans la galerie de widgets et placeholder avant la première donnée.
enum SampleStories {
    static let planete = WidgetPalette(accent: "#2F6B5E", skyTop: "#EFB98A", skyBottom: "#F4E5CC", sun: "#EE8F48", hillLight: "#B9D3B5", hillMid: "#6FA48A")
    static let preview = WidgetStory(
        id: "preview", themeId: "planete", themeLabel: "Planète",
        titleMain: "Les « polluants éternels »", titleAccent: "cèdent à plus basse chaleur.", source: "Phys.org — Earth",
        palette: planete, imagePath: nil, remoteImagePath: nil)
    static let waiting = WidgetStory.waiting(themeId: "planete", themeLabel: "Planète", palette: planete)
}

/// Source des entrées :
///  1. ce que l'app a écrit à sa dernière ouverture (App Group) : nouvelle du jour, illustration réduite ;
///  2. le matin, si cette nouvelle n'est pas celle d'aujourd'hui (Europe/Paris) : RPC publique `daily_stories`
///     avec la clé anon, même rotation que l'app, illustration téléchargée et réduite, résultat réécrit dans
///     l'App Group pour les rendus suivants hors ligne ;
///  3. réseau en échec : dernière nouvelle connue ; aucune nouvelle : promesse du lendemain sur une
///     illustration de secours du thème du jour. Jamais un widget vide.
struct StoryProvider: TimelineProvider {
    func placeholder(in context: Context) -> StoryEntry {
        WidgetFonts.register()
        return StoryEntry(date: .now, story: SampleStories.preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (StoryEntry) -> Void) {
        WidgetFonts.register()
        if context.isPreview { completion(StoryEntry(date: .now, story: SampleStories.preview)); return }
        completion(StoryEntry(date: .now, story: WidgetStore.read()?.story ?? SampleStories.preview))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StoryEntry>) -> Void) {
        WidgetFonts.register()
        Task {
            let story = await resolveStory()
            let refresh = story.isWaiting ? Date.now.addingTimeInterval(3600) : WidgetStore.nextMorning()
            completion(Timeline(entries: [StoryEntry(date: .now, story: story)], policy: .after(min(refresh, WidgetStore.nextMorning()))))
        }
    }

    private func resolveStory() async -> WidgetStory {
        guard var payload = WidgetStore.read() else { return SampleStories.waiting }
        let today = WidgetStore.isoDate()
        if let story = payload.story, payload.storyDate == today { return story }
        do {
            let stories = try await WidgetStore.fetchToday(payload: payload)
            if var picked = WidgetStore.pick(from: stories, themes: payload.themes, signupDate: payload.signupDate, day: today) {
                picked.imagePath = await WidgetStore.cacheImage(for: picked, payload: payload)
                payload.story = picked
                payload.storyDate = today
                WidgetStore.write(payload)
                return picked
            }
        } catch {
            // Réseau en échec : on garde la dernière nouvelle connue, même datée d'hier.
            if let story = payload.story { return story }
        }
        return waiting(payload, today: today)
    }

    private func waiting(_ payload: WidgetPayload, today: String) -> WidgetStory {
        let themeId = WidgetStore.themeOfTheDay(themes: payload.themes, signupDate: payload.signupDate, day: today) ?? "planete"
        let info = payload.themeInfo[themeId]
        return WidgetStory.waiting(themeId: themeId, themeLabel: info?.label ?? themeId.capitalized, palette: info?.palette ?? SampleStories.planete)
    }
}

struct EclaircieWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: StoryEntry

    /// Aplat papier du conteneur en rendu normal. En mode teinté, iOS ne supprime pas le containerBackground :
    /// il le repeint d'une couleur unie (texte clair invisible dessus). On ne lui donne alors rien : fond système sombre.
    private var paperBackground: some View {
        RenderingModeReader { accented in
            if accented { Color.clear } else { Color(hex: entry.story.palette.skyBottom) }
        }
    }

    var body: some View {
        switch family {
        case .accessoryRectangular:
            AccessoryContent(story: entry.story)
                .widgetAccentable()
                .containerBackground(for: .widget) { Color.clear }
                .widgetURL(entry.story.deepLink)
        case .systemMedium:
            MediumWidgetBody(story: entry.story)
                .containerBackground(for: .widget) { paperBackground }
                .widgetURL(entry.story.deepLink)
        default:
            SmallWidgetBody(story: entry.story)
                .containerBackground(for: .widget) { paperBackground }
                .widgetURL(entry.story.deepLink)
        }
    }
}

struct EclaircieWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: widgetKind, provider: StoryProvider()) { entry in
            EclaircieWidgetView(entry: entry)
        }
        .configurationDisplayName("Nouvelle du jour")
        .description("Ta bonne nouvelle du matin, vérifiée et sourcée.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
        // Les calques illustrés sont dans le contenu : ils vont jusqu'aux bords, les textes reprennent les marges système.
        .contentMarginsDisabled()
    }
}

@main
struct EclaircieWidgetBundle: WidgetBundle {
    var body: some Widget {
        EclaircieWidget()
    }
}

// Aperçus Xcode : dans le canevas, le sélecteur de rendu propose « Teinté » (iOS 18) pour vérifier les groupes.
#Preview("Moyen", as: .systemMedium) { EclaircieWidget() } timeline: { StoryEntry(date: .now, story: SampleStories.preview) }
#Preview("Petit", as: .systemSmall) { EclaircieWidget() } timeline: { StoryEntry(date: .now, story: SampleStories.preview) }
#Preview("Verrouillé", as: .accessoryRectangular) { EclaircieWidget() } timeline: { StoryEntry(date: .now, story: SampleStories.preview) }
