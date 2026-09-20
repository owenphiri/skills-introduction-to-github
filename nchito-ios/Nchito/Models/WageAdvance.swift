import Foundation

/// Earned wage access — see INNOVATION.md §3.2.
///
/// The single reason a worker takes a cash job over a Nchito gig is that cash
/// pays today. This closes that gap: once work is verifiably underway, part of
/// the payout is released immediately.
///
/// It is not a loan. The poster has already funded escrow, so Nchito is holding
/// this worker's money — an advance is early release of funds already deposited
/// against work already started. Nothing accrues, there is no interest, and the
/// flat fee is quoted in kwacha before the worker agrees.
///
/// Mirrors `wage_advances` in supabase/migrations/0005_wage_advances.sql.
struct WageAdvance: Identifiable, Codable, Equatable {
    enum Status: String, Codable {
        case outstanding, settled, recovering, writtenOff = "written_off"

        var label: String {
            switch self {
            case .outstanding: return "Comes off your next payout"
            case .settled:     return "Repaid"
            case .recovering:  return "Owed back — gig not completed"
            case .writtenOff:  return "Written off"
            }
        }
    }

    let id: UUID
    var gigID: UUID
    var gigTitle: String
    var amountZMW: Double
    var feeZMW: Double
    var status: Status
    var createdAt: Date

    var totalDueZMW: Double { amountZMW + feeZMW }
}

/// The offer for one gig, or the reason there isn't one.
///
/// A refusal always carries a sentence explaining itself — greying out a button
/// with no reason is how a worker concludes the feature is broken and stops
/// looking for it.
struct AdvanceOffer: Equatable {
    var isEligible: Bool
    var maxAmount: Double
    var reason: String

    static func ineligible(_ reason: String) -> AdvanceOffer {
        AdvanceOffer(isEligible: false, maxAmount: 0, reason: reason)
    }
}

enum AdvanceTerms {
    /// Share of the worker's payout that may be released early. Half leaves
    /// ample headroom for the fee and for a commission tier that is never worse
    /// than the one quoted, so repayment is always covered by the escrow.
    static let maxShare = 0.50

    static let feeRate = 0.04
    static let minimumFee = 5.0

    /// Below this a gig isn't worth the paperwork for either side.
    static let minimumAdvance = 20.0

    /// Standing thresholds, read from the Work Record.
    static let minimumCompletedJobs = 3
    static let minimumOnTimeRate = 0.6

    /// Flat service fee — not interest. It does not compound and does not grow
    /// if settlement takes longer.
    static func fee(on amount: Double) -> Double {
        max((amount * feeRate * 100).rounded() / 100, minimumFee)
    }

    static func maxAdvance(onPayout payout: Double) -> Double {
        (payout * maxShare).rounded(.down)
    }
}
