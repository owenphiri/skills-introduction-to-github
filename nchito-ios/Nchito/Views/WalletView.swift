import SwiftUI

struct WalletView: View {
    @EnvironmentObject private var state: AppState
    @State private var showCashOut = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    balanceCard
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                }

                Section("Payout method") {
                    Picker("Cash out to", selection: $state.payoutProvider) {
                        ForEach(MobileMoneyProvider.allCases) { p in
                            Text("\(p.brandEmoji) \(p.rawValue)").tag(p)
                        }
                    }
                }

                Section("Recent activity") {
                    ForEach(state.transactions) { tx in
                        TransactionRow(tx: tx)
                    }
                }
            }
            .navigationTitle("Wallet")
            .sheet(isPresented: $showCashOut) {
                CashOutSheet()
                    .presentationDetents([.medium])
            }
        }
    }

    private var balanceCard: some View {
        VStack(spacing: 12) {
            Text("Available balance")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.85))
            Text(state.walletBalance.kwacha)
                .font(.system(size: 40, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
            Button {
                showCashOut = true
            } label: {
                Label("Cash out to \(state.payoutProvider.rawValue)", systemImage: "arrow.up.right.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(.white, in: Capsule())
                    .foregroundStyle(Theme.green)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(
            LinearGradient(colors: [Theme.green, Theme.green.opacity(0.7)],
                           startPoint: .top, endPoint: .bottom),
            in: RoundedRectangle(cornerRadius: 20)
        )
    }
}

private struct TransactionRow: View {
    let tx: WalletTransaction

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(tx.kind.rawValue).font(.subheadline.weight(.medium))
                Text(tx.note).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text((tx.amountZMW >= 0 ? "+" : "") + tx.amountZMW.kwacha)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tx.amountZMW >= 0 ? Theme.green : Theme.red)
        }
    }
}

private struct CashOutSheet: View {
    @EnvironmentObject private var state: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var amount = ""
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("Balance: \(state.walletBalance.kwacha)")
                    .foregroundStyle(.secondary)

                HStack {
                    Text("K").font(.largeTitle.bold())
                    TextField("0", text: $amount)
                        .keyboardType(.decimalPad)
                        .font(.largeTitle.bold())
                }
                .padding(.horizontal, 40)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(Theme.red)
                }

                Text("Sent instantly to your \(state.payoutProvider.rawValue) number \(state.user.phone). No cash-out fee for NRC-verified users.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                Button("Cash out now") {
                    guard let value = Double(amount), value > 0 else {
                        errorMessage = "Enter a valid amount."
                        return
                    }
                    if state.cashOut(amount: value) {
                        dismiss()
                    } else {
                        errorMessage = "Amount exceeds your available balance."
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.horizontal)
            }
            .padding(.top, 24)
            .navigationTitle("Cash out")
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
    WalletView().environmentObject(AppState())
}
