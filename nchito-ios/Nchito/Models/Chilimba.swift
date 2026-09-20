import Foundation

/// A rotating savings circle — INNOVATION.md §3.3, schema in
/// `supabase/migrations/0011_digital_chilimba.sql`.
///
/// Everything modelled here that is not obvious exists because of how these go
/// wrong in practice. A member who collects the pot and then stops paying is
/// the entire risk in a chilimba, which is why `netPosition` and `exitCost` are
/// first-class rather than something the UI works out and might get wrong.
struct ChilimbaCircle: Identifiable, Codable, Hashable {
    enum Status: String, Codable, CaseIterable {
        case forming, active, completed, cancelled
    }

    enum Cadence: String, Codable, CaseIterable, Identifiable {
        case weekly, fortnightly, monthly
        var id: String { rawValue }

        var days: Int {
            switch self {
            case .weekly:      return 7
            case .fortnightly: return 14
            case .monthly:     return 30
            }
        }

        var label: String {
            switch self {
            case .weekly:      return "Every week"
            case .fortnightly: return "Every two weeks"
            case .monthly:     return "Every month"
            }
        }
    }

    var id: UUID
    var name: String
    var contributionZMW: Double
    var cadence: Cadence
    var status: Status
    var currentRound: Int
    var memberTarget: Int
    /// Only while forming — once a circle starts, its order is fixed and
    /// joining part-way through would mean joining a queue already drawn.
    var inviteCode: String?
    var members: [ChilimbaMember]

    /// Off unless the member turns it on. Taking a slice of somebody's payout
    /// without them choosing it is a deduction, not a savings feature.
    var autoContribute: Bool

    var pot: Double { contributionZMW * Double(activeMembers.count) }
    var activeMembers: [ChilimbaMember] { members.filter { $0.isActive } }
    var me: ChilimbaMember? { members.first(where: \.isMe) }

    /// Whose turn this round is. Nil when that member has left — the round is
    /// skipped rather than handed to somebody else.
    var recipient: ChilimbaMember? {
        activeMembers.first { $0.position == currentRound }
    }

    var membersOutstanding: [ChilimbaMember] {
        activeMembers.filter { !$0.hasPaidThisRound }
    }

    /// The pot moves only when everybody has paid. Nobody collects a short one.
    var roundIsComplete: Bool { membersOutstanding.isEmpty }
}

struct ChilimbaMember: Identifiable, Codable, Hashable {
    var id: UUID
    var name: String
    /// Nil while the circle is still forming: the order is drawn at random when
    /// it fills, never first-come, because first-come always puts whoever
    /// started the circle at the front.
    var position: Int?
    var isActive: Bool
    var isMe: Bool
    var hasPaidThisRound: Bool
    var paidInZMW: Double
    var receivedZMW: Double

    /// Positive means they have put in more than they have taken out.
    var netPosition: Double { paidInZMW - receivedZMW }

    /// What leaving now would take out of the other members' pockets.
    var exitCost: Double { max(receivedZMW - paidInZMW, 0) }

    var mayLeave: Bool { netPosition >= 0 }
}

/// Whether someone can take on another circle, and the numbers behind the
/// answer — shown as it is decided, not only when it refuses. Nobody should
/// discover a cap by being told no.
struct ChilimbaAffordability {
    /// Circles are capped at this share of recent Nchito earnings, counting the
    /// ones already joined. A missed cycle costs the other members, not just
    /// the person who missed it.
    static let incomeShare = 0.25

    var isAffordable: Bool
    var obligationZMW: Double
    var existingObligationZMW: Double
    var recentIncomeZMW: Double
    var reason: String

    var capZMW: Double { recentIncomeZMW * Self.incomeShare }

    static func assess(contribution: Double, cadence: ChilimbaCircle.Cadence,
                       recentIncome: Double, existing: Double) -> ChilimbaAffordability {
        let per90 = 90.0 / Double(cadence.days)
        let obligation = contribution * per90
        let cap = recentIncome * incomeShare

        if recentIncome <= 0 {
            return .init(isAffordable: false, obligationZMW: obligation,
                         existingObligationZMW: existing, recentIncomeZMW: recentIncome,
                         reason: "You have not been paid through Nchito in the last 90 days, "
                               + "so there is nothing to judge this against. Finish a gig first.")
        }
        if obligation + existing > cap {
            return .init(isAffordable: false, obligationZMW: obligation,
                         existingObligationZMW: existing, recentIncomeZMW: recentIncome,
                         reason: "This would commit K\(Int(obligation + existing)) over 90 days "
                               + "against K\(Int(recentIncome)) earned. Circles are capped at "
                               + "\(Int(incomeShare * 100))% of recent income, because a missed "
                               + "cycle costs the other members, not just you.")
        }
        return .init(isAffordable: true, obligationZMW: obligation,
                     existingObligationZMW: existing, recentIncomeZMW: recentIncome,
                     reason: "ok")
    }
}

/// A recording attached to a gig, an application or a message.
///
/// This is the whole of "speak instead of typing" that works today. No browser
/// or phone OS transcribes any Zambian language, so `transcript` stays nil
/// rather than being filled with a guess, and the other person simply listens —
/// which is how people already send job instructions on WhatsApp.
struct VoiceNote: Identifiable, Codable, Hashable {
    enum Subject: String, Codable { case gig, message, application }

    var id: UUID
    var subject: Subject
    var subjectID: UUID
    var storagePath: String
    var durationSeconds: Double
    var language: String
    /// Nil until a person or a model produces one. Never invented.
    var transcript: String?
    /// Explicit, revocable, off by default. A recording of someone's voice is
    /// not ours to train on because they happened to use the app.
    var corpusConsent: Bool
}
