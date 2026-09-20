import Foundation

/// Proof-of-work capture — see INNOVATION.md §4.1.
///
/// A geotagged, timestamped before/after pair attached to the gig. It settles
/// most disputes before they start, and because the capture time and place are
/// recorded at the device rather than at upload, it's also the underwriting
/// signal that later makes earned wage access against escrow safe.
///
/// Mirrors the `proof_of_work` table in 0002_phase1_defensibility.sql.
struct ProofPhoto: Identifiable, Codable, Equatable {
    enum Kind: String, Codable, CaseIterable {
        case before, after

        var label: String { self == .before ? "Before" : "After" }
        var icon: String { self == .before ? "camera.viewfinder" : "checkmark.seal.fill" }
        var prompt: String {
            self == .before
                ? "Photograph the job before you start"
                : "Photograph the finished work"
        }
    }

    let id: UUID
    var gigID: UUID
    var kind: Kind
    /// Path in the `proofs` storage bucket. Empty in demo mode, where the
    /// capture is simulated rather than a real photo.
    var storagePath: String
    var capturedAt: Date
    var latitude: Double?
    var longitude: Double?

    var hasLocation: Bool { latitude != nil && longitude != nil }

    var locationSummary: String {
        guard let lat = latitude, let lon = longitude else { return "No location" }
        return String(format: "%.4f, %.4f", lat, lon)
    }
}

/// The proof state of a single gig: what's captured, what's still missing,
/// and whether escrow may be released.
struct ProofStatus {
    var before: ProofPhoto?
    var after: ProofPhoto?

    var isComplete: Bool { before != nil && after != nil }

    var missing: [ProofPhoto.Kind] {
        ProofPhoto.Kind.allCases.filter { photo(for: $0) == nil }
    }

    func photo(for kind: ProofPhoto.Kind) -> ProofPhoto? {
        kind == .before ? before : after
    }

    /// Matches the guard in `release_escrow()`: payment can't move until both
    /// halves of the record exist.
    var releaseBlockedReason: String? {
        guard !isComplete else { return nil }
        let names = missing.map(\.label).joined(separator: " and ")
        return "\(names) photo required before payment can be released"
    }
}
