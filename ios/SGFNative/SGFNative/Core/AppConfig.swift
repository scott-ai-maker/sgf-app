import Foundation

enum AppConfig {
    static let apiBaseURL: URL = {
        URL(string: value(for: "APIBaseURL"))!
    }()

    static let supabaseURL: URL = {
        URL(string: value(for: "SupabaseURL"))!
    }()

    static let supabaseAnonKey: String = value(for: "SupabaseAnonKey")

    private static func value(for key: String) -> String {
        guard let url = Bundle.main.url(forResource: "Configuration", withExtension: "plist"),
              let data = try? Data(contentsOf: url),
              let dict = try? PropertyListSerialization.propertyList(from: data, options: [], format: nil) as? [String: Any],
              let value = dict[key] as? String,
              !value.isEmpty else {
            fatalError("Missing \(key) in Configuration.plist")
        }

        return value
    }
}
