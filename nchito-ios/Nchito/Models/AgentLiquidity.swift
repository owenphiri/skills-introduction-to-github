import Foundation

/// Mobile money agent liquidity — see INNOVATION.md §3.1.
///
/// Field reporting on Zambian mobile money puts the problem exactly: "a wallet
/// credit you cannot convert is not the same thing as money." Agents run out of
/// float, and a worker who can't cash out stops trusting the wallet.
///
/// The governing constraint throughout: **a false positive costs someone a
/// trip.** Bus fare to a dry agent is real money to someone earning K150 a day,
/// so every type here is built to admit uncertainty rather than guess.
///
/// Mirrors supabase/migrations/0006_agent_liquidity.sql.
struct MobileMoneyAgent: Identifiable, Equatable {
    let id: UUID
    var name: String
    var area: String
    var landmark: String
    var latitude: Double
    var longitude: Double
    var distanceKM: Double
    var isOperatorVerified: Bool
    var liquidity: AgentLiquidity

    var walkingMinutes: Int { max(1, Int((distanceKM / 5.0 * 60).rounded())) }

    var directionsText: String {
        landmark.isEmpty ? area : "\(area) — near \(landmark)"
    }
}

/// What we currently believe about one agent's cash, and how strongly.
struct AgentLiquidity: Equatable {
    enum Status: String, Equatable {
        case hasCash = "has_cash"
        case noCash = "no_cash"
        case mixed
        case unknown

        var label: String {
            switch self {
            case .hasCash: return "Had cash"
            case .noCash:  return "No cash"
            case .mixed:   return "Mixed reports"
            case .unknown: return "Not reported recently"
            }
        }

        var icon: String {
            switch self {
            case .hasCash: return "checkmark.circle.fill"
            case .noCash:  return "xmark.circle.fill"
            case .mixed:   return "exclamationmark.triangle.fill"
            case .unknown: return "questionmark.circle"
            }
        }
    }

    var status: Status
    var confidence: Double
    var lastReportAt: Date?
    /// The largest withdrawal actually confirmed here recently. An agent who
    /// paid out K200 may still not have K2000.
    var confirmedUpTo: Double?
    var reportCount: Int

    /// How long ago the newest report was, in plain words. Recency is the whole
    /// story with agent float, so it is never hidden behind an icon.
    var freshnessText: String {
        guard let lastReportAt else { return "No reports yet" }
        let minutes = Int(Date().timeIntervalSince(lastReportAt) / 60)
        switch minutes {
        case ..<2:   return "just now"
        case ..<60:  return "\(minutes) min ago"
        case ..<120: return "1 hour ago"
        case ..<1440: return "\(minutes / 60) hours ago"
        default:     return "over a day ago"
        }
    }

    /// Says how thin the evidence is, in the user's own terms.
    ///
    /// A single fresh report is enough for the backend to say "had cash" — that
    /// is deliberate, since demanding two would leave the map blank when it most
    /// needs to earn trust. The honest compensation is telling people exactly
    /// how many reports that judgment rests on, so they can decide whether it is
    /// worth the fare.
    var evidenceText: String {
        switch (status, reportCount) {
        case (.unknown, _):
            return "Nobody has reported here recently — you'd be finding out for everyone."
        case (_, 1):
            return "1 person reported \(freshnessText)."
        default:
            return "\(reportCount) people reported in the last day, most recently \(freshnessText)."
        }
    }

    /// Set when the amount someone wants is more than anyone has confirmed
    /// getting out. Shown as a caveat rather than downgrading the status, since
    /// the agent may simply not have been asked for that much.
    func amountCaveat(for amount: Double) -> String? {
        guard status == .hasCash, let confirmed = confirmedUpTo, confirmed < amount else { return nil }
        return "Only withdrawals up to \(confirmed.kwacha) confirmed here — call ahead for \(amount.kwacha)."
    }
}

/// What a visitor found. The wording is deliberately about outcome rather than
/// blame: people report faster when it doesn't feel like an accusation.
enum AgentReportOutcome: String, CaseIterable, Identifiable {
    case cashAvailable = "cash_available"
    case noCash = "no_cash"
    case closed
    case notFound = "not_found"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .cashAvailable: return "I got my cash"
        case .noCash:        return "They had no cash"
        case .closed:        return "They were closed"
        case .notFound:      return "I couldn't find them"
        }
    }

    var icon: String {
        switch self {
        case .cashAvailable: return "checkmark.circle.fill"
        case .noCash:        return "banknote"
        case .closed:        return "lock.fill"
        case .notFound:      return "mappin.slash"
        }
    }
}

extension MobileMoneyProvider {
    /// The database enum value; `rawValue` is the display name.
    var wireValue: String {
        switch self {
        case .mtnMomo:       return "mtn_momo"
        case .airtelMoney:   return "airtel_money"
        case .zamtelKwacha:  return "zamtel_kwacha"
        }
    }

    static func from(wire: String) -> MobileMoneyProvider? {
        allCases.first { $0.wireValue == wire }
    }
}
