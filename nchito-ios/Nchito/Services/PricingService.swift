import Foundation

/// Fair-price bands — see INNOVATION.md §5.1.
///
/// Posting a gig in a market with no reference prices leads to lowballing and
/// slow, hesitant posting. Quoting what comparable work actually settled at
/// makes the marketplace feel fair to both sides and speeds up posting.
///
/// Mirrors `price_band()` in 0002_phase1_defensibility.sql. Production reads
/// the RPC; this computes the same quartiles locally over mock data.
struct PriceBand: Equatable {
    var low: Double       // 25th percentile
    var median: Double
    var high: Double      // 75th percentile
    var sampleSize: Int
    /// False when the local market was too thin and we widened to nationwide.
    var isLocal: Bool

    /// How a proposed price sits against the band.
    enum Verdict: Equatable {
        case low, fair, high

        var message: String {
            switch self {
            case .low:  return "Below the going rate — you may get few applicants"
            case .fair: return "In line with similar gigs"
            case .high: return "Above the going rate — expect fast applications"
            }
        }

        var icon: String {
            switch self {
            case .low:  return "arrow.down.circle.fill"
            case .fair: return "checkmark.circle.fill"
            case .high: return "arrow.up.circle.fill"
            }
        }
    }

    func verdict(for price: Double) -> Verdict {
        if price < low { return .low }
        if price > high { return .high }
        return .fair
    }

    var rangeText: String { "\(low.kwacha)–\(high.kwacha)" }

    var sourceText: String {
        "\(sampleSize) similar \(isLocal ? "local " : "")gig\(sampleSize == 1 ? "" : "s")"
    }
}

enum PricingService {
    /// Below this, a sample says more about who happened to post than about
    /// the market, so we widen the search rather than advise from noise.
    static let minimumSample = 5

    /// Returns nil when there simply isn't enough history — callers must show
    /// nothing rather than invent a number.
    static func band(for category: GigCategory, city: String, in gigs: [Gig]) -> PriceBand? {
        let comparable = gigs.filter { $0.category == category }

        let local = comparable.filter { $0.city == city }
        let useLocal = local.count >= minimumSample
        let sample = useLocal ? local : comparable

        guard sample.count >= minimumSample else { return nil }

        let prices = sample.map(\.payZMW).sorted()
        return PriceBand(
            low: percentile(prices, 0.25),
            median: percentile(prices, 0.50),
            high: percentile(prices, 0.75),
            sampleSize: prices.count,
            isLocal: useLocal
        )
    }

    /// Linear interpolation between ranks — the same method as Postgres's
    /// `percentile_cont`, so the app and the database agree.
    private static func percentile(_ sorted: [Double], _ p: Double) -> Double {
        guard !sorted.isEmpty else { return 0 }
        guard sorted.count > 1 else { return sorted[0] }

        let position = p * Double(sorted.count - 1)
        let lowerIndex = Int(position.rounded(.down))
        let upperIndex = Swift.min(lowerIndex + 1, sorted.count - 1)
        let weight = position - Double(lowerIndex)

        let interpolated = sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight
        return (interpolated * 100).rounded() / 100
    }
}
