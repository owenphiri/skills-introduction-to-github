import Foundation

// Translation between the app's domain enums and the values Postgres actually
// stores, defined in supabase/migrations/.
//
// This file exists because the enums carry DISPLAY text as their rawValue —
// `GigCategory.delivery` is "Delivery & Errands" — while the database enum is
// 'delivery'. Encoding a model straight to JSON would therefore send text the
// database rejects, or worse, quietly write nonsense. Every enum that crosses
// the wire needs an explicit mapping here, and `WireFormatTests` checks the
// round trip so a renamed label can't silently break writes.

protocol WireRepresentable: CaseIterable, Hashable {
    /// Exactly the value the Postgres enum stores.
    var wireValue: String { get }
}

extension WireRepresentable {
    static func from(wire: String) -> Self? {
        allCases.first { $0.wireValue == wire }
    }
}

extension GigCategory: WireRepresentable {
    var wireValue: String {
        switch self {
        case .delivery:     return "delivery"
        case .homeServices: return "home_services"
        case .tutoring:     return "tutoring"
        case .digital:      return "digital"
        case .events:       return "events"
        case .farm:         return "farm"
        case .beauty:       return "beauty"
        case .repairs:      return "repairs"
        }
    }
}

extension GigStatus: WireRepresentable {
    static var allCases: [GigStatus] { [.open, .assigned, .completed, .paid] }

    var wireValue: String {
        switch self {
        case .open:      return "open"
        case .assigned:  return "assigned"
        case .completed: return "completed"
        case .paid:      return "paid"
        }
    }
}

extension MicroTaskKind: WireRepresentable {
    var wireValue: String {
        switch self {
        case .survey:      return "survey"
        case .appTest:     return "app_test"
        case .dataLabel:   return "data_label"
        case .social:      return "social"
        case .mysteryShop: return "mystery_shop"
        }
    }
}

extension TransactionKind: WireRepresentable {
    static var allCases: [TransactionKind] {
        [.gigPayout, .taskReward, .referralBonus, .cashOut, .boostPurchase,
         .wageAdvance, .advanceRepayment, .advanceRecovery, .escrowIn, .escrowRefund]
    }

    var wireValue: String {
        switch self {
        case .gigPayout:        return "gig_payout"
        case .taskReward:       return "task_reward"
        case .referralBonus:    return "referral_bonus"
        case .cashOut:          return "cash_out"
        case .boostPurchase:    return "boost_purchase"
        case .wageAdvance:      return "wage_advance"
        case .advanceRepayment: return "advance_repayment"
        case .advanceRecovery:  return "advance_recovery"
        case .escrowIn:         return "escrow_in"
        case .escrowRefund:     return "escrow_refund"
        case .other:            return "other"
        }
    }
}

extension TransactionKind {
    /// Never fails: a kind this build doesn't recognise becomes `.other`, so one
    /// unfamiliar row can't take down a user's whole transaction list.
    static func lenient(wire: String) -> TransactionKind {
        from(wire: wire) ?? .other
    }
}

extension VerificationLevel: WireRepresentable {
    static var allCases: [VerificationLevel] { [.unverified, .phoneVerified, .nrcVerified] }

    var wireValue: String {
        switch self {
        case .unverified:    return "unverified"
        case .phoneVerified: return "phone_verified"
        case .nrcVerified:   return "nrc_verified"
        }
    }
}

extension ProofPhoto.Kind: WireRepresentable {
    var wireValue: String { rawValue }   // already 'before' / 'after'
}

extension WageAdvance.Status: WireRepresentable {
    static var allCases: [WageAdvance.Status] {
        [.outstanding, .settled, .recovering, .writtenOff]
    }
    var wireValue: String { rawValue }   // already matches advance_status
}

// MARK: - Dates

enum WireDate {
    /// Postgres returns timestamptz with a variable number of fractional digits,
    /// which `.iso8601` alone rejects — so try with fractional seconds first.
    static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ string: String) -> Date? {
        withFraction.date(from: string) ?? plain.date(from: string)
    }

    static func format(_ date: Date) -> String {
        withFraction.string(from: date)
    }
}

extension JSONDecoder {
    /// Decoder configured for PostgREST responses.
    static var nchito: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            guard let date = WireDate.parse(raw) else {
                throw DecodingError.dataCorruptedError(
                    in: try decoder.singleValueContainer(),
                    debugDescription: "Unrecognised timestamp: \(raw)")
            }
            return date
        }
        return decoder
    }
}

extension JSONEncoder {
    static var nchito: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(WireDate.format(date))
        }
        return encoder
    }
}
