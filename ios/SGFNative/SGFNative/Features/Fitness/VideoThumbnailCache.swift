import Foundation
import SwiftUI
import UIKit

actor VideoThumbnailCache {
    static let shared = VideoThumbnailCache()

    private let memory = NSCache<NSString, NSData>()
    private let fm = FileManager.default

    private var cacheDirectory: URL {
        let base = fm.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("sgf-video-thumbnails", isDirectory: true)
        if !fm.fileExists(atPath: dir.path) {
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    private func cacheKey(for url: URL) -> String {
        let raw = Data(url.absoluteString.utf8).base64EncodedString()
        return raw.replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "=", with: "")
    }

    private func fileURL(for url: URL) -> URL {
        cacheDirectory.appendingPathComponent(cacheKey(for: url) + ".img")
    }

    func fetchData(for url: URL) async -> Data? {
        let key = cacheKey(for: url) as NSString

        if let cached = memory.object(forKey: key) {
            return Data(referencing: cached)
        }

        let diskURL = fileURL(for: url)
        if let diskData = try? Data(contentsOf: diskURL), !diskData.isEmpty {
            memory.setObject(diskData as NSData, forKey: key)
            return diskData
        }

        do {
            let request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 15)
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode), !data.isEmpty else {
                return nil
            }
            memory.setObject(data as NSData, forKey: key)
            try? data.write(to: diskURL, options: .atomic)
            return data
        } catch {
            return nil
        }
    }
}

@MainActor
final class ThumbnailImageLoader: ObservableObject {
    @Published var image: UIImage?
    @Published var isLoading = false

    private var hasLoaded = false

    func load(from url: URL) {
        guard !hasLoaded else { return }
        hasLoaded = true
        isLoading = true

        Task {
            let data = await VideoThumbnailCache.shared.fetchData(for: url)
            if let data, let uiImage = UIImage(data: data) {
                self.image = uiImage
            }
            self.isLoading = false
        }
    }
}

struct CachedThumbnailImage: View {
    let url: URL
    @StateObject private var loader = ThumbnailImageLoader()

    var body: some View {
        Group {
            if let image = loader.image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else if loader.isLoading {
                Color.black.overlay(ProgressView().tint(.white))
            } else {
                Color.black
            }
        }
        .task {
            loader.load(from: url)
        }
    }
}
