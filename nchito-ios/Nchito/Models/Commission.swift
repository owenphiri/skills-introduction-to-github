import Foundation

/// Loyalty-decaying commission — see INNOVATION.md §1.1.
///
/// A flat rate forever is a standing invitation to settle in cash off-platform.
/// Instead the rate falls as a poster and worker build history together, so the
/// saving from leaving stops covering what they'd lose: escrow, recourse, and
/// credit toward their Work Record.
///
/// Mirrors `commission_rate()` in supabase/migrations/0002_phase1_defensibility.sql.
enum CommissionTier: Int, CaseIterable, Comparable {
    case standard   // gigs 1–2 together
    case trusted    // gigs 3–9
    case partner    // gigs 10+

    static let gigsForTrusted = 3
    static let gigsForPartner = 10

    /// Only settled ("paid") gigs count, so the discount is earned through
    /// completed work rather than through gigs merely posted.
    init(completedTogether: Int) {
        switch completedTogether {
        case Self.gigsForPartner...: self = .partner
        case Self.gigsForTrusted...: self = .trusted
        default: self = .standard
        }
    }

    var rate: Double {
        switch self {
        case .standard: return 0.10
        case .trusted:  return 0.07
        case .partner:  return 0.05
        }
    }

    var label: String {
        switch self {
        case .standard: return "Standard"
        case .trusted:  return "Trusted pair"
        case .partner:  return "Partner rate"
        }
    }

    var badge: String {
        switch self {
        case .standard: return "percent"
        case .trusted:  return "handshake.fill"
        case .partner:  return "star.circle.fill"
        }
    }

    var ratePercent: String { "\(Int(rate * 100))%" }

    var next: CommissionTier? {
        switch self {
        case .standard: return .trusted
        case .trusted:  return .partner
        case .partner:  return nil
        }
    }

    /// Gigs still needed with this counterpart to reach the next tier.
    func gigsToNextTier(completedTogether: Int) -> Int? {
        switch self {
        case .standard: return Self.gigsForTrusted - completedTogether
        case .trusted:  return Self.gigsForPartner - completedTogether
        case .partner:  return nil
        }
    }

    static func < (lhs: CommissionTier, rhs: CommissionTier) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}
