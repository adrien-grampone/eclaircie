import SwiftUI
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Marges de contenu du système (iOS 17) ; 16 pt hors WidgetKit (banc de capture) ou si elles sont nulles.
private struct ContentMargins<Content: View>: View {
    @ViewBuilder let content: (EdgeInsets) -> Content
    #if canImport(WidgetKit)
    @Environment(\.widgetContentMargins) private var margins
    #else
    private let margins = EdgeInsets()
    #endif
    var body: some View {
        let m = margins.top > 0 ? margins : EdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16)
        content(m)
    }
}

/*
 * Corps des formats illustrés. L'illustration, le voile, le grain et le panneau papier sont dessinés DANS le
 * contenu du widget (premier plan, bord à bord grâce à contentMarginsDisabled), pas dans containerBackground :
 * en mode teinté, iOS supprime le containerBackground entier, image `fullColor` comprise. Le containerBackground
 * ne porte plus qu'un aplat papier. Le rendu normal est identique : mêmes calques, même ordre, mêmes marges.
 */
struct SmallWidgetBody: View {
    let story: WidgetStory
    var bundle: Bundle = .main

    var body: some View {
        ContentMargins { m in
            ZStack {
                StoryBackground(story: story, bundle: bundle)
                StoryContent(story: story, layout: .small).padding(m)
            }
        }
    }
}

struct MediumWidgetBody: View {
    let story: WidgetStory
    var bundle: Bundle = .main

    var body: some View {
        ContentMargins { m in
            ZStack {
                MediumBackground(story: story, bundle: bundle)
                MediumContent(story: story).padding(m)
            }
        }
    }
}
