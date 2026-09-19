import SwiftUI

/// The Work Record — see INNOVATION.md §1.2.
///
/// For most users this is the first CV they've ever had. The screen is built
/// around that: standing at the top, proof of how it was earned below, and the
/// two things they'd actually want to do with it — share it or hand it over as
/// a document — always within reach.
struct WorkRecordView: View {
    @EnvironmentObject private var state: AppState
    @State private var exportedCV: ExportedFile?
    @State private var showRotateConfirm = false

    private var summary: WorkRecordSummary { state.workRecordSummary }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if summary.isEmpty {
                    emptyState
                } else {
                    standingCard
                    sharingCard
                    if !summary.topCategories.isEmpty { categoriesCard }
                    historySection
                    trustFooter
                }
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Work Record")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !summary.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        exportedCV = state.exportWorkRecordCV().map(ExportedFile.init)
                    } label: {
                        Label("Export CV", systemImage: "square.and.arrow.down")
                    }
                }
            }
        }
        .sheet(item: $exportedCV) { file in
            ShareSheet(items: [file.url])
        }
        .confirmationDialog("Create a new link?",
                            isPresented: $showRotateConfirm, titleVisibility: .visible) {
            Button("Create new link", role: .destructive) { state.rotateWorkRecordLink() }
            Button("Keep current link", role: .cancel) {}
        } message: {
            Text("Anyone you've already given the old link to will no longer be able to open your record.")
        }
    }

    // MARK: - Sections

    /// StatChip dims its label with `.secondary`, which disappears against the
    /// green card — these stay legible on a coloured background.
    private func lightStat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.headline).foregroundStyle(.white)
            Text(label).font(.caption2).foregroundStyle(.white.opacity(0.85))
        }
        .frame(maxWidth: .infinity)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 52))
                .foregroundStyle(Theme.green)
            Text("Your work record starts with your first gig")
                .font(.headline)
                .multilineTextAlignment(.center)
            Text("Every job you complete and get paid for through Nchito is added here automatically — a work history you can show an employer or a bank. Jobs settled in cash off the app can't be added.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private var standingCard: some View {
        VStack(spacing: 14) {
            if let score = summary.reliabilityScore {
                VStack(spacing: 2) {
                    Text("\(score)")
                        .font(.system(size: 46, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("\(summary.scoreBand) · reliability out of 100")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.9))
                }
            }

            HStack(spacing: 0) {
                lightStat("\(summary.totalGigs)", "Jobs done")
                Divider().frame(height: 30).overlay(.white.opacity(0.3))
                lightStat(summary.onTimePercent, "On time")
                Divider().frame(height: 30).overlay(.white.opacity(0.3))
                lightStat(summary.ratingText, "Rating")
            }

            Text("\(summary.totalEarnedZMW.kwacha) earned through escrow · \(summary.tenureText)")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.9))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(
            LinearGradient(colors: [Theme.green, Theme.green.opacity(0.75)],
                           startPoint: .top, endPoint: .bottom),
            in: RoundedRectangle(cornerRadius: 20)
        )
    }

    private var sharingCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Toggle(isOn: Binding(get: { state.workRecordSharing.isPublic },
                                 set: { state.setWorkRecordPublic($0) })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Share my record").font(.subheadline.weight(.semibold))
                    Text("Off by default. Turn on to let an employer open it from a link.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if state.workRecordSharing.isPublic {
                HStack {
                    Text(state.workRecordSharing.shareURL)
                        .font(.caption.monospaced())
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer()
                    ShareLink(item: state.workRecordSharing.shareMessage) {
                        Label("Share", systemImage: "square.and.arrow.up")
                            .font(.caption.weight(.semibold))
                    }
                }
                .padding(10)
                .background(Theme.green.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))

                Button("Create a new link") { showRotateConfirm = true }
                    .font(.caption)
                    .foregroundStyle(Theme.copper)
            }
        }
        .padding()
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }

    private var categoriesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("What you work on most").font(.headline)
            ForEach(summary.topCategories, id: \.category) { item in
                HStack {
                    Label(item.category.rawValue, systemImage: item.category.icon)
                        .font(.caption)
                    Spacer()
                    Text("\(item.count) job\(item.count == 1 ? "" : "s")")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.green)
                }
                ProgressView(value: Double(item.count), total: Double(summary.totalGigs))
                    .tint(Theme.green)
            }
        }
        .padding()
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Completed work").font(.headline)
            ForEach(state.workRecord.sorted(by: { $0.completedAt > $1.completedAt })) { entry in
                WorkRecordRow(entry: entry)
            }
        }
    }

    private var trustFooter: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "checkmark.seal.fill")
                .foregroundStyle(Theme.green)
            Text("Every entry was paid through Nchito escrow and is cryptographically signed. Neither Nchito nor you can change a record once it's issued — that's what makes it worth showing.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Theme.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct WorkRecordRow: View {
    let entry: WorkRecordEntry

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: entry.category.icon)
                .frame(width: 38, height: 38)
                .background(Theme.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(Theme.green)

            VStack(alignment: .leading, spacing: 3) {
                Text(entry.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)
                HStack(spacing: 8) {
                    Text(entry.completedAt, format: .dateTime.month(.abbreviated).year())
                    if let rating = entry.posterRating {
                        Label(String(format: "%.1f", rating), systemImage: "star.fill")
                    }
                    if !entry.onTime {
                        Text("late").foregroundStyle(Theme.copper)
                    }
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(entry.payZMW.kwacha)
                    .font(.subheadline.weight(.semibold))
                if entry.isVerified {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.caption2)
                        .foregroundStyle(Theme.green)
                } else {
                    // A failed signature check means the row was altered after
                    // issue; it must never be presented as verified.
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.caption2)
                        .foregroundStyle(Theme.red)
                }
            }
        }
        .padding(12)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
    }
}

/// UIActivityViewController wrapper so the generated PDF can be sent to
/// WhatsApp, email, Files or AirDrop.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

/// Wraps the exported file so it can drive `.sheet(item:)` without
/// retroactively conforming URL to Identifiable.
struct ExportedFile: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

#Preview {
    NavigationStack {
        WorkRecordView().environmentObject(AppState())
    }
}
