import SwiftUI
import Charts

struct ClientProgressView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    @State private var summary: ProgressSummaryResponse?
    @State private var selectedStrengthExercise = ""
    @State private var loading = false
    @State private var error: String?

    private var isImperial: Bool { sessionStore.preferredUnits == "imperial" }

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Loading progress...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error {
                    ContentUnavailableView(
                        "Couldn't load progress",
                        systemImage: "chart.line.downtrend.xyaxis",
                        description: Text(error)
                    )
                } else if let summary {
                    ScrollView {
                        LazyVStack(spacing: 20) {
                            if !summary.weightTrend.isEmpty {
                                WeightChartCard(
                                    points: summary.weightTrend,
                                    isImperial: isImperial
                                )
                            }

                            if !summary.measurementTrend.isEmpty {
                                MeasurementsChartCard(points: summary.measurementTrend, isImperial: isImperial)
                            }

                            if !summary.wellnessTrend.isEmpty {
                                WellnessChartCard(points: summary.wellnessTrend)
                            }

                            if !summary.strengthTrend.isEmpty {
                                StrengthChartCard(
                                    series: summary.strengthTrend,
                                    selectedExercise: $selectedStrengthExercise,
                                    isImperial: isImperial
                                )
                            }

                            if !summary.personalRecords.isEmpty {
                                PersonalRecordsCard(
                                    records: summary.personalRecords,
                                    isImperial: isImperial
                                )
                            }

                            if summary.weightTrend.isEmpty
                                && summary.wellnessTrend.isEmpty
                                && summary.personalRecords.isEmpty {
                                ContentUnavailableView(
                                    "No data yet",
                                    systemImage: "chart.xyaxis.line",
                                    description: Text("Complete check-ins and workouts to see your progress here.")
                                )
                                .padding(.top, 60)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 20)
                    }
                    .background(Color(red: 245.0 / 255.0, green: 240.0 / 255.0, blue: 232.0 / 255.0))
                } else {
                    ContentUnavailableView("No data yet", systemImage: "chart.xyaxis.line")
                }
            }
            .navigationTitle("Progress")
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        guard let token = sessionStore.accessToken else { return }
        loading = true
        error = nil
        do {
            summary = try await APIClient(token: token).fetchProgressSummary()
            if let firstExercise = summary?.strengthTrend.first?.exerciseName,
               !summary!.strengthTrend.contains(where: { $0.exerciseName == selectedStrengthExercise }) {
                selectedStrengthExercise = firstExercise
            }
        } catch {
            self.error = (error as? APIClientError)?.localizedDescription ?? error.localizedDescription
        }
        loading = false
    }
}

// MARK: - Strength Chart Card

private struct StrengthChartCard: View {
    let series: [StrengthTrendSeries]
    @Binding var selectedExercise: String
    let isImperial: Bool

    private var selectedSeries: StrengthTrendSeries? {
        if let exact = series.first(where: { $0.exerciseName == selectedExercise }) {
            return exact
        }
        return series.first
    }

    private var unit: String { isImperial ? "lbs" : "kg" }

    private func displayWeight(_ kg: Double) -> Double {
        isImperial ? kg / 0.453592 : kg
    }

    var body: some View {
        ProgressCard(title: "Strength Progress", systemImage: "chart.line.uptrend.xyaxis") {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Exercise", selection: $selectedExercise) {
                    ForEach(series) { item in
                        Text(item.exerciseName).tag(item.exerciseName)
                    }
                }
                .pickerStyle(.menu)

                if let selectedSeries {
                    Chart(selectedSeries.points) { point in
                        LineMark(
                            x: .value("Session", shortDate(point.sessionDate)),
                            y: .value(unit, displayWeight(point.bestWeightKg))
                        )
                        .interpolationMethod(.catmullRom)
                        .foregroundStyle(Color.orange)

                        PointMark(
                            x: .value("Session", shortDate(point.sessionDate)),
                            y: .value(unit, displayWeight(point.bestWeightKg))
                        )
                        .foregroundStyle(Color.orange)
                        .annotation(position: .top, alignment: .center) {
                            if let reps = point.bestReps {
                                Text("\(reps)")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .chartYAxis {
                        AxisMarks(position: .leading) { value in
                            AxisValueLabel {
                                if let numeric = value.as(Double.self) {
                                    Text(String(format: "%.0f", numeric)).font(.caption2)
                                }
                            }
                            AxisGridLine()
                        }
                    }
                    .frame(height: 180)
                }
            }
        } trailing: {
            if let latest = selectedSeries?.points.last {
                Text(String(format: "%.1f %@", displayWeight(latest.bestWeightKg), unit))
                    .font(.headline)
                    .foregroundStyle(.primary)
            }
        }
    }
}

// MARK: - Weight Chart Card

private struct WeightChartCard: View {
    let points: [WeightDataPoint]
    let isImperial: Bool

    private func displayWeight(_ kg: Double) -> Double {
        isImperial ? kg / 0.453592 : kg
    }

    private var unit: String { isImperial ? "lbs" : "kg" }

    private var minY: Double {
        (points.map { displayWeight($0.weightKg) }.min() ?? 0) - 5
    }
    private var maxY: Double {
        (points.map { displayWeight($0.weightKg) }.max() ?? 100) + 5
    }

    var body: some View {
        ProgressCard(title: "Weight", systemImage: "scalemass.fill") {
            Chart(points) { point in
                LineMark(
                    x: .value("Week", shortDate(point.weekStart)),
                    y: .value(unit, displayWeight(point.weightKg))
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(Color.accentColor)

                PointMark(
                    x: .value("Week", shortDate(point.weekStart)),
                    y: .value(unit, displayWeight(point.weightKg))
                )
                .foregroundStyle(Color.accentColor)
                .symbolSize(40)
            }
            .chartYScale(domain: minY...maxY)
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisValueLabel {
                        if let v = value.as(Double.self) {
                            Text(String(format: "%.0f", v))
                                .font(.caption2)
                        }
                    }
                    AxisGridLine()
                }
            }
            .chartXAxis {
                AxisMarks { value in
                    AxisValueLabel {
                        if let s = value.as(String.self) {
                            Text(s).font(.caption2)
                        }
                    }
                }
            }
            .frame(height: 180)
        } trailing: {
            if let last = points.last {
                Text(String(format: "%.1f %@", displayWeight(last.weightKg), unit))
                    .font(.headline)
                    .foregroundStyle(.primary)
            }
        }
    }
}

// MARK: - Measurements Chart Card

private struct MeasurementsChartCard: View {
    let points: [MeasurementDataPoint]
    let isImperial: Bool

    private var unit: String { isImperial ? "in" : "cm" }

    private func display(_ cm: Double) -> Double {
        isImperial ? cm / 2.54 : cm
    }

    struct SeriesPoint: Identifiable {
        let id: String
        let week: String
        let value: Double
        let series: String
    }

    private var seriesData: [SeriesPoint] {
        var result: [SeriesPoint] = []
        for p in points {
            if let v = p.waistCm { result.append(.init(id: "w-\(p.weekStart)", week: shortDate(p.weekStart), value: display(v), series: "Waist")) }
            if let v = p.hipCm   { result.append(.init(id: "h-\(p.weekStart)", week: shortDate(p.weekStart), value: display(v), series: "Hips")) }
            if let v = p.neckCm  { result.append(.init(id: "n-\(p.weekStart)", week: shortDate(p.weekStart), value: display(v), series: "Neck")) }
        }
        return result
    }

    var body: some View {
        ProgressCard(title: "Measurements", systemImage: "ruler.fill") {
            Chart(seriesData) { point in
                LineMark(
                    x: .value("Week", point.week),
                    y: .value(unit, point.value)
                )
                .foregroundStyle(by: .value("Measurement", point.series))
                .interpolationMethod(.catmullRom)

                PointMark(
                    x: .value("Week", point.week),
                    y: .value(unit, point.value)
                )
                .foregroundStyle(by: .value("Measurement", point.series))
                .symbolSize(30)
            }
            .chartLegend(position: .top, alignment: .leading)
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisValueLabel {
                        if let v = value.as(Double.self) { Text(String(format: "%.1f\(unit)", v)).font(.caption2) }
                    }
                    AxisGridLine()
                }
            }
            .frame(height: 180)
        } trailing: {
            EmptyView()
        }
    }
}

// MARK: - Wellness Chart Card

private struct WellnessChartCard: View {
    let points: [WellnessDataPoint]

    struct SeriesPoint: Identifiable {
        let id: String
        let week: String
        let value: Double
        let series: String
    }

    private var seriesData: [SeriesPoint] {
        var result: [SeriesPoint] = []
        for p in points {
            if let v = p.sleepQuality  { result.append(.init(id: "sl-\(p.weekStart)", week: shortDate(p.weekStart), value: Double(v), series: "Sleep")) }
            if let v = p.energyLevel   { result.append(.init(id: "en-\(p.weekStart)", week: shortDate(p.weekStart), value: Double(v), series: "Energy")) }
            if let v = p.stressLevel   { result.append(.init(id: "st-\(p.weekStart)", week: shortDate(p.weekStart), value: Double(v), series: "Stress")) }
            if let v = p.sorenessLevel { result.append(.init(id: "so-\(p.weekStart)", week: shortDate(p.weekStart), value: Double(v), series: "Soreness")) }
        }
        return result
    }

    var body: some View {
        ProgressCard(title: "Wellness Trends", systemImage: "waveform.path.ecg") {
            Chart(seriesData) { point in
                LineMark(
                    x: .value("Week", point.week),
                    y: .value("Score", point.value)
                )
                .foregroundStyle(by: .value("Metric", point.series))
                .interpolationMethod(.catmullRom)
            }
            .chartYScale(domain: 1...5)
            .chartLegend(position: .top, alignment: .leading)
            .chartYAxis {
                AxisMarks(values: [1, 2, 3, 4, 5]) { value in
                    AxisValueLabel {
                        if let v = value.as(Int.self) { Text("\(v)").font(.caption2) }
                    }
                    AxisGridLine()
                }
            }
            .frame(height: 160)
        } trailing: {
            EmptyView()
        }
    }
}

// MARK: - Personal Records Card

private struct PersonalRecordsCard: View {
    let records: [PersonalRecord]
    let isImperial: Bool

    private func displayWeight(_ kg: Double) -> Double {
        isImperial ? kg / 0.453592 : kg
    }
    private var unit: String { isImperial ? "lbs" : "kg" }

    var body: some View {
        ProgressCard(title: "Personal Records", systemImage: "trophy.fill") {
            VStack(spacing: 0) {
                ForEach(Array(records.prefix(10).enumerated()), id: \.element.id) { index, record in
                    HStack(spacing: 12) {
                        Text("#\(index + 1)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .frame(width: 28, alignment: .leading)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(record.exerciseName)
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .lineLimit(1)
                            if let reps = record.reps {
                                Text("\(reps) reps")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        Spacer()

                        Text(String(format: "%.1f %@", displayWeight(record.weightKg), unit))
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.accentColor)
                    }
                    .padding(.vertical, 10)

                    if index < min(records.count, 10) - 1 {
                        Divider()
                    }
                }
            }
        } trailing: {
            EmptyView()
        }
    }
}

// MARK: - Shared Card Shell

private struct ProgressCard<Content: View, Trailing: View>: View {
    let title: String
    let systemImage: String
    @ViewBuilder let content: () -> Content
    @ViewBuilder let trailing: () -> Trailing

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label(title, systemImage: systemImage)
                    .font(.headline)
                    .foregroundStyle(Color(red: 13.0 / 255.0, green: 27.0 / 255.0, blue: 42.0 / 255.0))
                Spacer()
                trailing()
            }
            content()
        }
        .padding(16)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.black.opacity(0.06), radius: 8, x: 0, y: 2)
    }
}

// MARK: - Helpers

private func shortDate(_ iso: String) -> String {
    // "2025-04-21" → "Apr 21"
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    guard let date = formatter.date(from: iso) else { return iso }
    let out = DateFormatter()
    out.locale = Locale(identifier: "en_US_POSIX")
    out.dateFormat = "MMM d"
    return out.string(from: date)
}
