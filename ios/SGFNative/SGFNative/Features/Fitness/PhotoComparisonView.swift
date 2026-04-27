import SwiftUI

struct PhotoComparisonView: View {
    let photos: [ProgressPhoto]

    // Sorted oldest → newest
    private var sorted: [ProgressPhoto] {
        photos.sorted { $0.takenAt < $1.takenAt }
    }

    @State private var beforeIndex: Int = 0
    @State private var afterIndex: Int = 0

    var body: some View {
        Group {
            if sorted.count < 2 {
                ContentUnavailableView(
                    "Not enough photos",
                    systemImage: "photo.on.rectangle.angled",
                    description: Text("Add at least two progress photos to compare.")
                )
            } else {
                VStack(spacing: 0) {
                    pickerRow
                    comparisonRow
                    Spacer()
                }
            }
        }
        .navigationTitle("Photo Comparison")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            beforeIndex = 0
            afterIndex = sorted.count - 1
        }
    }

    // MARK: - Picker row

    private var pickerRow: some View {
        HStack(spacing: 0) {
            // Before picker
            VStack(alignment: .center, spacing: 4) {
                Text("BEFORE")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                Menu {
                    ForEach(sorted.indices, id: \.self) { i in
                        Button(action: { beforeIndex = i }) {
                            Label(formattedDate(sorted[i].takenAt), systemImage: beforeIndex == i ? "checkmark" : "photo")
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(formattedDate(sorted[beforeIndex].takenAt))
                            .font(.subheadline)
                        Image(systemName: "chevron.down")
                            .font(.caption)
                    }
                    .foregroundStyle(.primary)
                }
            }
            .frame(maxWidth: .infinity)

            Divider().frame(height: 36)

            // After picker
            VStack(alignment: .center, spacing: 4) {
                Text("AFTER")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                Menu {
                    ForEach(sorted.indices, id: \.self) { i in
                        Button(action: { afterIndex = i }) {
                            Label(formattedDate(sorted[i].takenAt), systemImage: afterIndex == i ? "checkmark" : "photo")
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(formattedDate(sorted[afterIndex].takenAt))
                            .font(.subheadline)
                        Image(systemName: "chevron.down")
                            .font(.caption)
                    }
                    .foregroundStyle(.primary)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
        .background(Color(.systemGroupedBackground))
    }

    // MARK: - Comparison images

    private var comparisonRow: some View {
        GeometryReader { geo in
            HStack(spacing: 1) {
                photoCard(photo: sorted[beforeIndex], label: "Before")
                    .frame(width: (geo.size.width - 1) / 2)
                photoCard(photo: sorted[afterIndex], label: "After")
                    .frame(width: (geo.size.width - 1) / 2)
            }
        }
        .frame(maxHeight: .infinity)
    }

    private func photoCard(photo: ProgressPhoto, label: String) -> some View {
        ZStack(alignment: .bottom) {
            AsyncImage(url: URL(string: photo.photoURL)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                case .failure:
                    Color.gray.opacity(0.2)
                        .overlay(Image(systemName: "exclamationmark.triangle").foregroundStyle(.secondary))
                default:
                    Color.gray.opacity(0.15)
                        .overlay(ProgressView())
                }
            }
            .clipped()

            VStack(spacing: 2) {
                Text(label)
                    .font(.caption)
                    .fontWeight(.bold)
                Text(formattedDate(photo.takenAt))
                    .font(.caption2)
                if let notes = photo.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption2)
                        .lineLimit(1)
                }
            }
            .foregroundStyle(.white)
            .padding(.vertical, 8)
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity)
            .background(.ultraThinMaterial)
        }
    }

    // MARK: - Helpers

    private func formattedDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        if let date = formatter.date(from: iso) {
            let out = DateFormatter()
            out.dateStyle = .medium
            out.timeStyle = .none
            return out.string(from: date)
        }
        return iso
    }
}
