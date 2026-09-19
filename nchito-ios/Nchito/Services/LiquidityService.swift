import Foundation

/// Scores agent liquidity from raw reports.
///
/// Mirrors `agent_liquidity()` in 0006_agent_liquidity.sql exactly, so demo mode
/// and production rank agents the same way. The constants live here and there —
/// changing one without the other would make the app disagree with itself.
enum LiquidityService {

    /// Agent float turns over across a day, not a week: a report from this
    /// morning says little about this afternoon. Short by design, because stale
    /// optimism is what sends people on wasted journeys.
    static let halfLifeHours = 3.0

    /// Below this total weight the answer is "we don't know" — honest, and it
    /// costs nobody a bus fare.
    static let minimumConfidence = 0.8

    /// Reports older than this contribute so little they're excluded outright.
    static let windowHours = 24.0

    struct Report {
        var outcome: AgentReportOutcome
        var amountZMW: Double?
        var createdAt: Date
    }

    static func liquidity(from reports: [Report], wanting amount: Double? = nil,
                          now: Date = .now) -> AgentLiquidity {
        var positive = 0.0
        var negative = 0.0

        let recent = reports.filter { now.timeIntervalSince($0.createdAt) / 3600 <= windowHours }

        for report in recent {
            let ageHours = now.timeIntervalSince(report.createdAt) / 3600
            let weight = pow(0.5, ageHours / halfLifeHours)

            switch report.outcome {
            case .cashAvailable:
                // A confirmation only counts for amounts at or below what was
                // actually withdrawn.
                if let amount, (report.amountZMW ?? 0) < amount { continue }
                positive += weight
            case .noCash, .closed:
                negative += weight
            case .notFound:
                // Says the pin is wrong, not that the agent is dry — it should
                // not push the cash status either way.
                continue
            }
        }

        let total = positive + negative
        let status: AgentLiquidity.Status
        if total < minimumConfidence {
            status = .unknown
        } else {
            let ratio = positive / total
            status = ratio >= 0.6 ? .hasCash : (ratio <= 0.4 ? .noCash : .mixed)
        }

        return AgentLiquidity(
            status: status,
            confidence: (total * 100).rounded() / 100,
            lastReportAt: reports.map(\.createdAt).max(),
            confirmedUpTo: recent
                .filter { $0.outcome == .cashAvailable }
                .compactMap(\.amountZMW).max(),
            reportCount: recent.count)
    }

    /// Great-circle distance in kilometres, matching `distance_km()` in SQL.
    static func distanceKM(from: (lat: Double, lon: Double),
                           to: (lat: Double, lon: Double)) -> Double {
        let earthRadius = 6371.0
        let dLat = (to.lat - from.lat) * .pi / 180
        let dLon = (to.lon - from.lon) * .pi / 180
        let a = pow(sin(dLat / 2), 2)
            + cos(from.lat * .pi / 180) * cos(to.lat * .pi / 180) * pow(sin(dLon / 2), 2)
        let distance = earthRadius * 2 * asin(sqrt(a))
        return (distance * 100).rounded() / 100
    }

    /// Confirmed cash first, then unknowns, then known-dry last — but still
    /// listed. An agent reported dry an hour ago may have been restocked, and
    /// hiding it entirely would be its own kind of false claim.
    static func rank(_ agents: [MobileMoneyAgent]) -> [MobileMoneyAgent] {
        agents.sorted { a, b in
            let order: (AgentLiquidity.Status) -> Int = { status in
                switch status {
                case .hasCash: return 0
                case .unknown: return 1
                case .mixed:   return 2
                case .noCash:  return 3
                }
            }
            let (oa, ob) = (order(a.liquidity.status), order(b.liquidity.status))
            return oa == ob ? a.distanceKM < b.distanceKM : oa < ob
        }
    }
}
