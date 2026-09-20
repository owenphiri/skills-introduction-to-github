import SwiftUI

/// Proof-of-work capture — see INNOVATION.md §4.1.
///
/// Appears once the worker is on the job. Both photos must exist before escrow
/// can be released, which is enforced server-side in `release_escrow()` too —
/// this card is the human half of that contract, not the security boundary.
struct ProofOfWorkCard: View {
    @EnvironmentObject private var state: AppState
    let gig: Gig

    private var status: ProofStatus { state.proofStatus(for: gig) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Proof of work", systemImage: "camera.metering.matrix")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                if status.isComplete {
                    Label("Complete", systemImage: "checkmark.circle.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.green)
                } else {
                    Text("\(2 - status.missing.count)/2")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }

            Text("Photos are stamped with the time and place they were taken. They protect your payment if the poster disputes the work.")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(spacing: 10) {
                ForEach(ProofPhoto.Kind.allCases, id: \.self) { kind in
                    ProofSlot(kind: kind, photo: status.photo(for: kind)) {
                        state.captureProof(kind, for: gig)
                    }
                }
            }

            if let reason = status.releaseBlockedReason {
                Label(reason, systemImage: "lock.fill")
                    .font(.caption)
                    .foregroundStyle(Theme.copper)
            } else {
                Label("Payment can now be released by the poster.",
                      systemImage: "lock.open.fill")
                    .font(.caption)
                    .foregroundStyle(Theme.green)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct ProofSlot: View {
    let kind: ProofPhoto.Kind
    let photo: ProofPhoto?
    let onCapture: () -> Void

    var body: some View {
        Group {
            if let photo {
                VStack(spacing: 4) {
                    Image(systemName: "photo.fill")
                        .font(.title2)
                        .foregroundStyle(Theme.green)
                    Text(kind.label)
                        .font(.caption.weight(.semibold))
                    Text(photo.capturedAt, format: .dateTime.day().month().hour().minute())
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    if photo.hasLocation {
                        Label("Geotagged", systemImage: "mappin.circle.fill")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.green.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
            } else {
                Button(action: onCapture) {
                    VStack(spacing: 4) {
                        Image(systemName: kind.icon)
                            .font(.title2)
                        Text(kind.label)
                            .font(.caption.weight(.semibold))
                        Text(kind.prompt)
                            .font(.caption2)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [4]))
                            .foregroundStyle(.secondary)
                    )
                    .foregroundStyle(Theme.ink)
                }
            }
        }
    }
}

#Preview {
    ProofOfWorkCard(gig: MockDataService.gigs[1])
        .environmentObject(AppState())
        .padding()
}
