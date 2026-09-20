import Foundation

/// The Work Record — see INNOVATION.md §1.2.
///
/// One signed entry per settled gig. Because entries are written only by
/// `release_escrow()`, every line represents money that actually moved through
/// escrow — this is a history that cannot be self-reported, which is precisely
/// what makes it worth showing an employer or a lender.
///
/// Mirrors the `work_records` table in supabase/migrations/0003_work_record.sql.
struct WorkRecordEntry: Identifiable, Codable, Equatable {
    let id: UUID
    var gigID: UUID
    var title: String
    var category: GigCategory
    var city: String
    var payZMW: Double
    var completedAt: Date
    var posterRating: Double?
    var onTime: Bool

    /// Hex HMAC over the entry's canonical content, checked by
    /// `verify_work_record()`. A false result means the row was altered after
    /// issue and the entry must not be presented as verified.
    var signature: String
    var isVerified: Bool
}

/// Everything a verifier or lender reads at a glance.
struct WorkRecordSummary: Equatable {
    var totalGigs: Int
    var totalEarnedZMW: Double
    var onTimeRate: Double?        // 0–1, nil until there's history
    var averageRating: Double?
    var memberSince: Date
    var topCategories: [(category: GigCategory, count: Int)]

    var isEmpty: Bool { totalGigs == 0 }

    var onTimePercent: String {
        guard let rate = onTimeRate else { return "—" }
        return "\(Int((rate * 100).rounded()))%"
    }

    var ratingText: String {
        guard let r = averageRating else { return "—" }
        return String(format: "%.1f★", r)
    }

    var tenureText: String {
        let months = Calendar.current.dateComponents([.month], from: memberSince, to: .now).month ?? 0
        if months < 1 { return "New this month" }
        if months < 12 { return "\(months) month\(months == 1 ? "" : "s") on Nchito" }
        let years = months / 12
        return "\(years) year\(years == 1 ? "" : "s") on Nchito"
    }

    /// Weight given to the neutral prior when shrinking rates. Five is roughly
    /// where a worker's own numbers start outweighing the assumption.
    private static let priorWeight = 5.0
    private static let neutralOnTime = 0.5
    private static let neutralRating = 3.5

    /// A deliberately simple, explainable reliability score out of 100.
    ///
    /// Anything a lender might price risk from has to be defensible line by
    /// line, so this is a transparent weighted sum rather than an opaque model:
    /// volume of settled work, punctuality, rating, and tenure. It is a summary
    /// of the record, never a substitute for reading it.
    ///
    /// Punctuality and rating are shrunk toward a neutral prior, because a
    /// perfect record over one job is not evidence of anything — without this,
    /// a single flawless gig scores about the same as fifteen good ones.
    var reliabilityScore: Int? {
        guard totalGigs > 0 else { return nil }

        let n = Double(totalGigs)
        let k = Self.priorWeight

        // Volume saturates at 50 gigs — beyond that, more work says little extra.
        let volume = min(n / 50.0, 1.0) * 40

        let observedOnTime = onTimeRate ?? Self.neutralOnTime
        let shrunkOnTime = (observedOnTime * n + Self.neutralOnTime * k) / (n + k)
        let punctuality = shrunkOnTime * 30

        let observedRating = averageRating ?? Self.neutralRating
        let shrunkRating = (observedRating * n + Self.neutralRating * k) / (n + k)
        let quality = (shrunkRating / 5.0) * 20

        let months = Double(Calendar.current.dateComponents([.month], from: memberSince, to: .now).month ?? 0)
        let tenure = min(months / 12.0, 1.0) * 10

        return Int((volume + punctuality + quality + tenure).rounded())
    }

    var scoreBand: String {
        guard let score = reliabilityScore else { return "Not yet rated" }
        switch score {
        case 80...: return "Excellent"
        case 60..<80: return "Strong"
        case 40..<60: return "Building"
        default: return "Getting started"
        }
    }
}

/// Opt-in sharing state. Employment history is sensitive, so a record stays
/// private until the worker chooses otherwise and the link can be rotated to
/// revoke access already granted.
struct WorkRecordSharing: Equatable {
    var isPublic: Bool
    var slug: String

    var shareURL: String { "https://nchito.zm/w/\(slug)" }

    var shareMessage: String {
        "Here's my verified Nchito work record — every job on it was paid through escrow: \(shareURL)"
    }
}
