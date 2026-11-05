import Foundation

/// Données partagées par l'app via l'App Group (UserDefaults, clé `eclaircie.widget`), écrites à chaque
/// ouverture. `supabaseUrl` et `anonKey` (publique) permettent au widget de se rafraîchir seul le matin
/// avec la RPC `daily_stories` ; aucune clé service_role n'approche le widget.
struct WidgetPayload: Codable, Equatable {
    var version: Int = 1
    var supabaseUrl: String
    var anonKey: String
    /// Thèmes choisis (identifiants) et leur libellé + palette.
    var themes: [String]
    var themeInfo: [String: ThemeInfo]
    /// Date d'inscription (AAAA-MM-JJ) : base de la rotation, même règle que l'app et le pipeline.
    var signupDate: String
    /// Dernière nouvelle connue et sa date (AAAA-MM-JJ, Europe/Paris).
    var story: WidgetStory?
    var storyDate: String?

    struct ThemeInfo: Codable, Equatable {
        var label: String
        var palette: WidgetPalette
    }
}

enum WidgetStore {
    static let key = "eclaircie.widget"
    static let timeZone = TimeZone(identifier: "Europe/Paris") ?? .current

    static func read() -> WidgetPayload? {
        guard let data = UserDefaults(suiteName: appGroup)?.string(forKey: key)?.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetPayload.self, from: data)
    }

    static func write(_ payload: WidgetPayload) {
        guard let data = try? JSONEncoder().encode(payload), let json = String(data: data, encoding: .utf8) else { return }
        UserDefaults(suiteName: appGroup)?.set(json, forKey: key)
    }

    /// Dossier du conteneur partagé où le widget garde l'illustration du jour qu'il a téléchargée lui-même.
    static func cacheDirectory() -> URL? {
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
        let dir = base.appendingPathComponent("widget-cache", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    // MARK: Dates (Europe/Paris, format AAAA-MM-JJ)

    static func isoDate(_ date: Date = .now) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Jours calendaires entre deux dates ISO (même règle que `daysBetween` du pipeline : calcul en UTC).
    static func daysBetween(_ from: String, _ to: String) -> Int {
        func ms(_ iso: String) -> Double? {
            let p = iso.split(separator: "-").compactMap { Int($0) }
            guard p.count == 3 else { return nil }
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = TimeZone(identifier: "UTC")!
            return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))?.timeIntervalSince1970
        }
        guard let a = ms(from), let b = ms(to) else { return 0 }
        return Int(((b - a) / 86_400).rounded())
    }

    /// Prochain rafraîchissement : 7 h 05 Europe/Paris, aujourd'hui si pas encore passé, sinon demain.
    static func nextMorning(after date: Date = .now) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        var c = cal.dateComponents([.year, .month, .day], from: date)
        c.hour = 7; c.minute = 5
        let today = cal.date(from: c) ?? date
        return today > date ? today : cal.date(byAdding: .day, value: 1, to: today) ?? date
    }

    // MARK: Rotation (spec §2, même règle que `selectDailyStory` dans l'app)

    /// Thème du jour : thèmes dédoublonnés et triés, index = jours depuis l'inscription modulo n.
    static func themeOfTheDay(themes: [String], signupDate: String, day: String) -> String? {
        let sorted = Array(Set(themes)).sorted()
        guard !sorted.isEmpty else { return nil }
        let days = max(0, daysBetween(signupDate, day))
        return sorted[days % sorted.count]
    }

    /// Parmi les nouvelles du jour renvoyées par la RPC : celle du thème du jour, sinon le thème
    /// suivant dans l'ordre de rotation qui en a une (ids triés en cas d'égalité) ; nil s'il n'y en a aucune.
    static func pick(from stories: [WidgetStory], themes: [String], signupDate: String, day: String) -> WidgetStory? {
        guard let start = themeOfTheDay(themes: themes, signupDate: signupDate, day: day) else { return nil }
        let sorted = Array(Set(themes)).sorted()
        let startIndex = sorted.firstIndex(of: start) ?? 0
        for step in 0..<sorted.count {
            let candidate = sorted[(startIndex + step) % sorted.count]
            if let story = stories.filter({ $0.themeId == candidate }).sorted(by: { ($0.id ?? "") < ($1.id ?? "") }).first {
                return story
            }
        }
        return nil
    }

    // MARK: Supabase (RPC publique `daily_stories`, clé anon)

    private struct RpcRow: Decodable {
        let id: String
        let theme_id: String
        let theme_label: String
        let palette: WidgetPalette
        let title_main: String
        let title_accent: String?
        let source_name: String?
        let image_path: String?
    }

    /// Nouvelles programmées et validées d'aujourd'hui pour les thèmes du profil. Jette en cas d'échec réseau.
    static func fetchToday(payload: WidgetPayload) async throws -> [WidgetStory] {
        guard let url = URL(string: "\(payload.supabaseUrl)/rest/v1/rpc/daily_stories") else { throw URLError(.badURL) }
        var request = URLRequest(url: url, timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(payload.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(payload.anonKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(["theme_ids": Array(payload.themes.prefix(10))])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode([RpcRow].self, from: data).map { row in
            WidgetStory(id: row.id, themeId: row.theme_id, themeLabel: row.theme_label, titleMain: frenchTypography(row.title_main), titleAccent: row.title_accent.map(frenchTypography),
                        source: row.source_name.map(sourceLabel), palette: row.palette, imagePath: nil, remoteImagePath: row.image_path)
        }
    }

    /// Télécharge l'illustration d'une nouvelle (bucket public) et la garde réduite dans le conteneur partagé.
    static func cacheImage(for story: WidgetStory, payload: WidgetPayload) async -> String? {
        guard let remote = story.remoteImagePath, let id = story.id, let dir = cacheDirectory() else { return nil }
        let target = dir.appendingPathComponent("\(id).jpg")
        if FileManager.default.fileExists(atPath: target.path) { return target.path }
        guard let url = URL(string: "\(payload.supabaseUrl)/storage/v1/object/public/illustrations/\(remote)"),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let jpeg = downsampledJPEG(data, maxSide: 600) else { return nil }
        // Une seule illustration en cache : celle du jour.
        (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil))?.forEach { try? FileManager.default.removeItem(at: $0) }
        guard (try? jpeg.write(to: target, options: .atomic)) != nil else { return nil }
        return target.path
    }
}
