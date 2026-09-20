import SwiftUI

/// Where to actually get your cash — see INNOVATION.md §3.1.
///
/// The screen's job is to be honest. Every row says what was reported, how many
/// people said it and how long ago, because sending someone across town to a dry
/// agent costs them bus fare they can ill afford and costs Nchito their trust.
/// "Not reported recently" is shown as a real answer, not hidden.
struct AgentMapView: View {
    @EnvironmentObject private var state: AppState
    /// Set when arriving from a cash-out, so the list can flag agents that
    /// haven't been confirmed for this much.
    var wantingAmount: Double?

    @State private var provider: MobileMoneyProvider = .mtnMomo
    @State private var reporting: MobileMoneyAgent?

    private var agents: [MobileMoneyAgent] {
        state.nearbyAgents(wantingAmount: wantingAmount)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                providerPicker
                if let wantingAmount {
                    Text("Looking for \(wantingAmount.kwacha). Agents are ranked by what people actually got out today.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                ForEach(agents) { agent in
                    AgentRow(agent: agent, wantingAmount: wantingAmount) {
                        reporting = agent
                    }
                }

                honestyNote
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Find cash near you")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $reporting) { agent in
            AgentReportSheet(agent: agent, provider: provider)
                .presentationDetents([.medium])
        }
    }

    private var providerPicker: some View {
        Picker("Provider", selection: $provider) {
            ForEach(MobileMoneyProvider.allCases) { p in
                Text(p.rawValue).tag(p)
            }
        }
        .pickerStyle(.segmented)
    }

    /// Says plainly where the data comes from. People trust a crowdsourced
    /// answer more when you admit it is crowdsourced.
    private var honestyNote: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "person.2.fill")
                .foregroundStyle(Theme.green)
            Text("These reports come from other Nchito workers, not from the networks. Float changes through the day, so always check how recent a report is — and tell us what you find so the next person doesn't waste a trip.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Theme.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct AgentRow: View {
    let agent: MobileMoneyAgent
    let wantingAmount: Double?
    let onReport: () -> Void

    private var tint: Color {
        switch agent.liquidity.status {
        case .hasCash: return Theme.green
        case .noCash:  return Theme.red
        case .mixed:   return Theme.copper
        case .unknown: return .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(agent.name).font(.subheadline.weight(.semibold))
                        if agent.isOperatorVerified {
                            Image(systemName: "checkmark.seal.fill")
                                .font(.caption2)
                                .foregroundStyle(Theme.green)
                        }
                    }
                    Text(agent.directionsText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(agent.distanceKM, specifier: "%.1f") km")
                        .font(.caption.weight(.semibold))
                    Text("~\(agent.walkingMinutes) min walk")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Label(agent.liquidity.status.label, systemImage: agent.liquidity.status.icon)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(tint.opacity(0.14), in: Capsule())
                .foregroundStyle(tint)

            // How thin the evidence is, always — a single report reads very
            // differently from four, and the user should get to weigh that.
            Text(agent.liquidity.evidenceText)
                .font(.caption2)
                .foregroundStyle(.secondary)

            if let wantingAmount,
               let caveat = agent.liquidity.amountCaveat(for: wantingAmount) {
                Label(caveat, systemImage: "exclamationmark.circle.fill")
                    .font(.caption2)
                    .foregroundStyle(Theme.copper)
            }

            Button("I went here — report what I found", action: onReport)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.green)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }
}

/// Reporting is one tap plus an optional amount. Anything longer and people
/// won't do it standing outside a kiosk, and the map dies without reports.
struct AgentReportSheet: View {
    @EnvironmentObject private var state: AppState
    @Environment(\.dismiss) private var dismiss
    let agent: MobileMoneyAgent
    let provider: MobileMoneyProvider

    @State private var amount = ""
    @State private var confirmation: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                VStack(spacing: 4) {
                    Text(agent.name).font(.headline)
                    Text("\(agent.directionsText) · \(provider.rawValue)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 8)

                ForEach(AgentReportOutcome.allCases) { outcome in
                    Button {
                        state.reportAgent(agent, outcome: outcome,
                                          amount: outcome == .cashAvailable ? Double(amount) : nil)
                        confirmation = outcome == .cashAvailable
                            ? "Thanks — others will see this agent has cash."
                            : "Thanks — this saves someone else a wasted trip."
                    } label: {
                        HStack {
                            Image(systemName: outcome.icon)
                            Text(outcome.label)
                            Spacer()
                        }
                        .font(.subheadline.weight(.medium))
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(Theme.ink)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("K")
                        TextField("How much did you take out? (optional)", text: $amount)
                            .keyboardType(.decimalPad)
                    }
                    .padding(10)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))

                    // The reason this field matters, said plainly.
                    Text("Telling us the amount helps — an agent who paid out K200 may still not have K2000.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }
            .padding()
            .navigationTitle("What did you find?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .alert("Report sent", isPresented: Binding(
                get: { confirmation != nil },
                set: { if !$0 { confirmation = nil; dismiss() } }
            )) {
                Button("Done") { confirmation = nil; dismiss() }
            } message: {
                Text(confirmation ?? "")
            }
        }
    }
}

#Preview {
    NavigationStack {
        AgentMapView(wantingAmount: 300).environmentObject(AppState())
    }
}
