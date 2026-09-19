import Foundation

// MARK: - User

enum MobileMoneyProvider: String, Codable, CaseIterable, Identifiable {
    case mtnMomo = "MTN MoMo"
    case airtelMoney = "Airtel Money"
    case zamtelKwacha = "Zamtel Kwacha"

    var id: String { rawValue }

    var brandEmoji: String {
        switch self {
        case .mtnMomo: return "🟡"
        case .airtelMoney: return "🔴"
        case .zamtelKwacha: return "🟢"
        }
    }
}

enum VerificationLevel: String, Codable {
    case unverified = "Unverified"
    case phoneVerified = "Phone Verified"
    case nrcVerified = "NRC Verified"

    var trustScoreBonus: Int {
        switch self {
        case .unverified: return 0
        case .phoneVerified: return 10
        case .nrcVerified: return 30
        }
    }
}

struct UserProfile: Identifiable, Codable {
    let id: UUID
    var fullName: String
    var phone: String
    var city: String
    var bio: String
    var skills: [String]
    var rating: Double
    var completedGigs: Int
    var verification: VerificationLevel
    var referralCode: String
    var referralEarningsZMW: Double
    var joinedDate: Date
}

// MARK: - Gigs

enum GigCategory: String, Codable, CaseIterable, Identifiable {
    case delivery = "Delivery & Errands"
    case homeServices = "Home Services"
    case tutoring = "Tutoring & Lessons"
    case digital = "Digital & Design"
    case events = "Events & Catering"
    case farm = "Farm & Garden"
    case beauty = "Beauty & Care"
    case repairs = "Repairs & Technical"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .delivery: return "bicycle"
        case .homeServices: return "house.fill"
        case .tutoring: return "book.fill"
        case .digital: return "laptopcomputer"
        case .events: return "party.popper.fill"
        case .farm: return "leaf.fill"
        case .beauty: return "scissors"
        case .repairs: return "wrench.and.screwdriver.fill"
        }
    }
}

enum GigStatus: String, Codable {
    case open = "Open"
    case assigned = "In Progress"
    case completed = "Completed"
    case paid = "Paid Out"
}

struct Gig: Identifiable, Codable {
    let id: UUID
    var title: String
    var details: String
    var category: GigCategory
    var payZMW: Double
    var city: String
    var area: String
    var posterName: String
    var posterRating: Double
    var postedAt: Date
    var status: GigStatus
    var isUrgent: Bool
    var isBoosted: Bool
    var applicants: Int

    /// Gigs this poster and the current user have already settled together.
    /// Drives the commission tier (INNOVATION.md §1.1); the backend recomputes
    /// it authoritatively in `commission_rate()` at release time.
    var completedWithPoster: Int = 0

    var commissionTier: CommissionTier {
        CommissionTier(completedTogether: completedWithPoster)
    }

    /// Commission is held in escrow and only taken when the gig settles.
    var commissionRate: Double { commissionTier.rate }

    var commissionAmount: Double { payZMW * commissionRate }

    var workerPayout: Double { payZMW - commissionAmount }

    /// What the worker would keep at the next tier, for showing what staying
    /// on-platform with this poster is worth.
    var payoutAtNextTier: Double? {
        guard let next = commissionTier.next else { return nil }
        return payZMW * (1 - next.rate)
    }
}

// MARK: - Micro-tasks (passive earning feed)

enum MicroTaskKind: String, Codable, CaseIterable {
    case survey = "Survey"
    case appTest = "App Testing"
    case dataLabel = "Data Labelling"
    case social = "Social Boost"
    case mysteryShop = "Mystery Shopper"

    var icon: String {
        switch self {
        case .survey: return "list.clipboard.fill"
        case .appTest: return "iphone.gen3"
        case .dataLabel: return "tag.fill"
        case .social: return "megaphone.fill"
        case .mysteryShop: return "cart.fill"
        }
    }
}

struct MicroTask: Identifiable, Codable {
    let id: UUID
    var title: String
    var kind: MicroTaskKind
    var rewardZMW: Double
    var minutes: Int
    var slotsLeft: Int
    var isCompleted: Bool
}

// MARK: - Wallet

enum TransactionKind: String, Codable {
    case gigPayout = "Gig Payout"
    case taskReward = "Task Reward"
    case referralBonus = "Referral Bonus"
    case cashOut = "Cash Out"
    case boostPurchase = "Boost Purchase"
    case wageAdvance = "Early Payment"
    case advanceRepayment = "Early Payment Repaid"
    case advanceRecovery = "Early Payment Owed Back"
}

struct WalletTransaction: Identifiable, Codable {
    let id: UUID
    var kind: TransactionKind
    var amountZMW: Double // negative for outflows
    var note: String
    var date: Date
}

// MARK: - Formatting helpers

extension Double {
    var kwacha: String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 2
        f.minimumFractionDigits = self.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 2
        return "K\(f.string(from: NSNumber(value: self)) ?? "\(self)")"
    }
}
