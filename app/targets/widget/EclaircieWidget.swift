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

/// Données provisoires : aperçus et placeholders. Le câblage App Group + Supabase vient ensuite.
enum SampleStories {
    static let animaux = WidgetStory(
        id: "sample", themeId: "animaux", themeLabel: "Animaux",
        titleMain: "Pour les chiens,", titleAccent: "des plaquettes gardées trois semaines.", source: "Phys.org — Biology",
        palette: WidgetPalette(accent: "#7A4E14", skyTop: "#F2C08E", skyBottom: "#F8E6CC", sun: "#FFF1DA", hillLight: "#E3B07A", hillMid: "#C08040"),
        imagePath: nil)
}

struct StoryProvider: TimelineProvider {
    func placeholder(in context: Context) -> StoryEntry {
        WidgetFonts.register()
        return StoryEntry(date: .now, story: SampleStories.animaux)
    }

    func getSnapshot(in context: Context, completion: @escaping (StoryEntry) -> Void) {
        WidgetFonts.register()
        completion(StoryEntry(date: .now, story: SampleStories.animaux))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StoryEntry>) -> Void) {
        WidgetFonts.register()
        let entry = StoryEntry(date: .now, story: SampleStories.animaux)
        completion(Timeline(entries: [entry], policy: .after(Calendar.current.date(byAdding: .hour, value: 1, to: .now) ?? .now)))
    }
}

struct EclaircieWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: StoryEntry

    var body: some View {
        switch family {
        case .accessoryRectangular:
            AccessoryContent(story: entry.story)
                .widgetAccentable()
                .containerBackground(for: .widget) { Color.clear }
                .widgetURL(entry.story.deepLink)
        default:
            StoryContent(story: entry.story, layout: family == .systemMedium ? .medium : .small)
                .containerBackground(for: .widget) { StoryBackground(story: entry.story, focus: family == .systemMedium ? 0.5 : 0.6) }
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
    }
}

@main
struct EclaircieWidgetBundle: WidgetBundle {
    var body: some Widget {
        EclaircieWidget()
    }
}
