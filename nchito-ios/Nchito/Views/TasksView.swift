import SwiftUI

/// The "passive income" side of Nchito: short digital micro-tasks
/// (surveys, app testing, data labelling) anyone can do from a phone.
struct TasksView: View {
    @EnvironmentObject private var state: AppState
    @State private var justEarned: MicroTask?

    private var availableTotal: Double {
        state.microTasks.filter { !$0.isCompleted }.reduce(0) { $0 + $1.rewardZMW }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    header
                    ForEach(state.microTasks) { task in
                        TaskCard(task: task) {
                            state.complete(task: task)
                            justEarned = task
                        }
                    }
                }
                .padding(.horizontal)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Quick Tasks")
            .alert("Reward earned! 🎉",
                   isPresented: Binding(get: { justEarned != nil },
                                        set: { if !$0 { justEarned = nil } }),
                   presenting: justEarned) { _ in
                Button("Nice", role: .cancel) {}
            } message: { task in
                Text("+\(task.rewardZMW.kwacha) added to your wallet. Cash out any time to mobile money.")
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Earn in your spare time")
                .font(.headline)
                .foregroundStyle(.white)
            Text("\(availableTotal.kwacha) available right now — tasks refresh daily. Finish tasks to keep your streak and unlock higher-paying ones.")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.9))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(
            LinearGradient(colors: [Theme.green, Theme.copper],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 16)
        )
    }
}

private struct TaskCard: View {
    let task: MicroTask
    let onComplete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: task.kind.icon)
                .font(.title3)
                .frame(width: 44, height: 44)
                .background(Theme.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                .foregroundStyle(Theme.green)

            VStack(alignment: .leading, spacing: 4) {
                Text(task.title)
                    .font(.subheadline.weight(.semibold))
                HStack(spacing: 10) {
                    Label("\(task.minutes) min", systemImage: "clock")
                    Label("\(task.slotsLeft) slots", systemImage: "person.3")
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }

            Spacer()

            if task.isCompleted {
                Label("Done", systemImage: "checkmark.circle.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.green)
            } else {
                Button {
                    onComplete()
                } label: {
                    Text(task.rewardZMW.kwacha)
                        .font(.subheadline.weight(.bold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Theme.copper, in: Capsule())
                        .foregroundStyle(.white)
                }
            }
        }
        .padding()
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    TasksView().environmentObject(AppState())
}
