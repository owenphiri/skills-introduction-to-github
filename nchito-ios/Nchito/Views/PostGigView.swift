import SwiftUI

struct PostGigView: View {
    @EnvironmentObject private var state: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var details = ""
    @State private var category: GigCategory = .delivery
    @State private var pay = ""
    @State private var city = "Lusaka"
    @State private var area = ""
    @State private var isUrgent = false
    @State private var boost = false

    private let cities = ["Lusaka", "Kitwe", "Ndola", "Livingstone", "Solwezi", "Kabwe", "Chipata"]
    private let boostFee = 25.0

    private var payValue: Double? { Double(pay) }
    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
        && !details.trimmingCharacters(in: .whitespaces).isEmpty
        && (payValue ?? 0) > 0
        && !area.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("What do you need done?") {
                    TextField("Gig title (e.g. Deliver a parcel to Kabwata)", text: $title)
                    TextField("Describe the job, timing and requirements…",
                              text: $details, axis: .vertical)
                        .lineLimit(4...8)
                    // Sectioned by family: a flat list of thirty-nine services
                    // is a wheel nobody can find "Bricklaying" in.
                    Picker("Category", selection: $category) {
                        ForEach(ServiceGroup.allCases) { group in
                            Section(group.label) {
                                ForEach(group.categories) { cat in
                                    Label(cat.rawValue, systemImage: cat.icon).tag(cat)
                                }
                            }
                        }
                    }
                    .pickerStyle(.navigationLink)
                }

                Section("Pay & location") {
                    HStack {
                        Text("K")
                        TextField("Amount in Kwacha", text: $pay)
                            .keyboardType(.decimalPad)
                    }
                    priceGuidance
                    Picker("City", selection: $city) {
                        ForEach(cities, id: \.self) { Text($0) }
                    }
                    TextField("Area (e.g. Kabulonga, Riverside)", text: $area)
                }

                Section {
                    Toggle(isOn: $isUrgent) {
                        Label("Mark as urgent", systemImage: "exclamationmark.circle.fill")
                    }
                    Toggle(isOn: $boost) {
                        VStack(alignment: .leading, spacing: 2) {
                            Label("Boost to top of feed", systemImage: "star.fill")
                            Text("K\(Int(boostFee)) — featured for 48 hours, ~5× more applicants")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .tint(Theme.copper)
                } footer: {
                    if let p = payValue, p > 0 {
                        Text("You'll pay \(p.kwacha)\(boost ? " + K\(Int(boostFee)) boost" : "") into escrow when you pick a worker. Money is only released when you confirm the job is done.")
                    }
                }

                Section {
                    Button("Post gig") {
                        state.post(gig: Gig(
                            id: UUID(), title: title, details: details,
                            category: category, payZMW: payValue ?? 0,
                            city: city, area: area,
                            posterName: state.user.fullName,
                            posterRating: state.user.rating,
                            postedAt: .now, status: .open,
                            isUrgent: isUrgent, isBoosted: boost, applicants: 0))
                        dismiss()
                    }
                    .buttonStyle(PrimaryButtonStyle(color: Theme.copper))
                    .disabled(!isValid)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
            }
            .navigationTitle("Post a gig")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    /// Fair-price band (INNOVATION.md §5.1). Quoting what comparable work
    /// actually settled at stops lowballing and makes posting quicker. When
    /// there isn't enough history we show nothing rather than invent a figure.
    @ViewBuilder
    private var priceGuidance: some View {
        if let band = state.priceBand(for: category, city: city) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Label("Similar gigs pay", systemImage: "chart.bar.fill")
                        .font(.caption.weight(.semibold))
                    Spacer()
                    Text(band.rangeText)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.green)
                }

                Text("Typically \(band.median.kwacha), based on \(band.sourceText).")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                if let value = payValue, value > 0 {
                    let verdict = band.verdict(for: value)
                    Label(verdict.message, systemImage: verdict.icon)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(verdict == .low ? Theme.red
                                         : verdict == .high ? Theme.copper : Theme.green)
                } else {
                    Button("Use \(band.median.kwacha)") {
                        pay = String(format: "%.0f", band.median)
                    }
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Theme.copper)
                }
            }
            .padding(.vertical, 4)
        }
    }
}

#Preview {
    PostGigView().environmentObject(AppState())
}
