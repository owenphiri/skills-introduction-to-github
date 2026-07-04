import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var state: AppState
    @State private var search = ""
    @State private var selectedCategory: GigCategory?
    @State private var selectedCity = "All Cities"
    @State private var showPostGig = false

    private let cities = ["All Cities", "Lusaka", "Kitwe", "Ndola", "Livingstone", "Solwezi"]

    private var filteredGigs: [Gig] {
        state.gigs.filter { gig in
            (selectedCategory == nil || gig.category == selectedCategory)
            && (selectedCity == "All Cities" || gig.city == selectedCity)
            && (search.isEmpty
                || gig.title.localizedCaseInsensitiveContains(search)
                || gig.details.localizedCaseInsensitiveContains(search))
        }
        // Boosted gigs float to the top — this is a paid placement (see STRATEGY.md).
        .sorted { ($0.isBoosted ? 1 : 0, $0.postedAt) > ($1.isBoosted ? 1 : 0, $1.postedAt) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    categoryRow
                    ForEach(filteredGigs) { gig in
                        NavigationLink(value: gig.id) {
                            GigCard(gig: gig)
                        }
                        .buttonStyle(.plain)
                    }
                    if filteredGigs.isEmpty {
                        ContentUnavailableView("No gigs match",
                                               systemImage: "magnifyingglass",
                                               description: Text("Try a different category or city."))
                    }
                }
                .padding(.horizontal)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Gigs near you")
            .searchable(text: $search, prompt: "Search gigs…")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("City", selection: $selectedCity) {
                        ForEach(cities, id: \.self) { Text($0) }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showPostGig = true
                    } label: {
                        Label("Post a gig", systemImage: "plus.circle.fill")
                            .foregroundStyle(Theme.copper)
                    }
                }
            }
            .sheet(isPresented: $showPostGig) { PostGigView() }
            .navigationDestination(for: UUID.self) { id in
                if let gig = state.gigs.first(where: { $0.id == id }) {
                    GigDetailView(gig: gig)
                }
            }
        }
    }

    private var categoryRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(GigCategory.allCases) { cat in
                    let isSelected = selectedCategory == cat
                    Button {
                        selectedCategory = isSelected ? nil : cat
                    } label: {
                        Label(cat.rawValue, systemImage: cat.icon)
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(isSelected ? Theme.green : Theme.card,
                                        in: Capsule())
                            .foregroundStyle(isSelected ? .white : Theme.ink)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }
}

struct GigCard: View {
    let gig: Gig

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                PillTag(text: gig.category.rawValue)
                if gig.isUrgent { PillTag(text: "URGENT", color: Theme.red) }
                if gig.isBoosted { PillTag(text: "★ Featured", color: Theme.copper) }
                Spacer()
                Text(gig.payZMW.kwacha)
                    .font(.headline)
                    .foregroundStyle(Theme.green)
            }
            Text(gig.title)
                .font(.subheadline.weight(.semibold))
                .multilineTextAlignment(.leading)
            HStack(spacing: 12) {
                Label("\(gig.city) · \(gig.area)", systemImage: "mappin.and.ellipse")
                Label("\(gig.applicants) applied", systemImage: "person.2")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    HomeView().environmentObject(AppState())
}
