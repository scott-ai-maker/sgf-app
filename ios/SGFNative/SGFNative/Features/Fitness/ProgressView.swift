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
                InsightBanner(text: strengthInsight(selectedSeries, isImperial: isImperial))
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
            VStack(alignment: .leading, spacing: 12) {
                InsightBanner(text: weightInsight(points, isImperial: isImperial))
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
            }
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
            VStack(alignment: .leading, spacing: 12) {
                InsightBanner(text: measurementsInsight(points, isImperial: isImperial))
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
            }
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
            VStack(alignment: .leading, spacing: 12) {
                InsightBanner(text: wellnessInsight(points))
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
            }
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

// MARK: - Insight Banner

private struct InsightBanner: View {
    let text: String

    private let gold = Color(red: 212.0/255, green: 160.0/255, blue: 23.0/255)
    private let navy = Color(red: 13.0/255, green: 27.0/255, blue: 42.0/255)

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Rectangle()
                .fill(gold)
                .frame(width: 3)
                .clipShape(Capsule())
            Image(systemName: "lightbulb.fill")
                .font(.caption)
                .foregroundStyle(gold)
                .padding(.top, 1)
            Text(text)
                .font(.caption)
                .foregroundStyle(navy)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 248.0/255, green: 244.0/255, blue: 232.0/255))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Insight generators

private func weightInsight(_ points: [WeightDataPoint], isImperial: Bool) -> String {
    guard points.count >= 2 else {
        return "Keep logging your weight after each check-in to unlock trend analysis."
    }
    let unit = isImperial ? "lbs" : "kg"
    let factor = isImperial ? (1.0 / 0.453592) : 1.0
    let first = points.first!.weightKg * factor
    let last  = points.last!.weightKg  * factor
    let diff  = last - first
    let weeks = max(1, points.count - 1)
    let perWeek = diff / Double(weeks)
    let sign = diff < 0 ? "↓" : "↑"
    let absDiff = abs(diff)
    if abs(perWeek) < 0.1 {
        return "Your weight has been stable — great consistency over \(weeks) week\(weeks == 1 ? "" : "s")."
    }
    return String(format: "%@ %.1f %@ total over %d week%@ (avg %.2f %@/wk).",
                  sign, absDiff, unit, weeks, weeks == 1 ? "" : "s", abs(perWeek), unit)
}

private func wellnessInsight(_ points: [WellnessDataPoint]) -> String {
    guard points.count >= 2 else {
        return "Complete weekly check-ins to see your sleep, energy, and stress trends here."
    }
    let recent = Array(points.suffix(4))
    let avgEnergy = recent.compactMap { $0.energyLevel }.map(Double.init).reduce(0, +) / Double(max(1, recent.compactMap { $0.energyLevel }.count))
    let avgStress = recent.compactMap { $0.stressLevel }.map(Double.init).reduce(0, +) / Double(max(1, recent.compactMap { $0.stressLevel }.count))
    if avgEnergy >= 4 && avgStress <= 2 {
        return "Strong recent form — high energy and low stress over the past 4 weeks."
    } else if avgStress >= 4 {
        return "Stress has been elevated lately. Communicate with your coach if recovery is suffering."
    } else if avgEnergy <= 2 {
        return "Energy has been low recently — make sure you're prioritising sleep and nutrition."
    }
    return String(format: "Recent avg energy %.1f/5, stress %.1f/5 over the last %d check-ins.", avgEnergy, avgStress, recent.count)
}

private func strengthInsight(_ series: StrengthTrendSeries?, isImperial: Bool) -> String {
    guard let series, series.points.count >= 2 else {
        return "Log workouts to track strength trends for each exercise."
    }
    let unit = isImperial ? "lbs" : "kg"
    let factor = isImperial ? (1.0 / 0.453592) : 1.0
    let first = series.points.first!.bestWeightKg * factor
    let last  = series.points.last!.bestWeightKg  * factor
    let diff  = last - first
    if diff > 0 {
        return String(format: "%.0f %@ gain on %@ since you started — keep pushing.", diff, unit, series.exerciseName)
    } else if diff < 0 {
        return String(format: "%.0f %@ drop on %@. Deload periods are normal — consistency wins.", abs(diff), unit, series.exerciseName)
    }
    return "\(series.exerciseName) weight has held steady. Aim for progressive overload on reps or sets."
}

private func measurementsInsight(_ points: [MeasurementDataPoint], isImperial: Bool) -> String {
    guard points.count >= 2 else {
        return "Log body measurements in your weekly check-in to track body composition changes."
    }
    let unit = isImperial ? "in" : "cm"
    let factor = isImperial ? (1.0 / 2.54) : 1.0
    let firstWaist = points.first?.waistCm
    let lastWaist  = points.last?.waistCm
    if let f = firstWaist, let l = lastWaist {
        let diff = (l - f) * factor
        if diff < -0.5 {
            return String(format: "Waist down %.1f %@ — body composition is moving in the right direction.", abs(diff), unit)
        } else if diff > 0.5 {
            return String(format: "Waist up %.1f %@. Review nutrition if fat loss is the goal.", diff, unit)
        }
    }
    return "Waist measurements are holding steady. Keep checking in weekly for a clearer picture."
}
