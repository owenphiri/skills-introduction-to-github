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
                    Picker("Category", selection: $category) {
                        ForEach(GigCategory.allCases) { cat in
                            Label(cat.rawValue, systemImage: cat.icon).tag(cat)
                        }
                    }
                }

                Section("Pay & location") {
                    HStack {
                        Text("K")
                        TextField("Amount in Kwacha", text: $pay)
                            .keyboardType(.decimalPad)
                    }
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
}

#Preview {
    PostGigView().environmentObject(AppState())
}
