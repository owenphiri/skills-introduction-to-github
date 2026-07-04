import Foundation

/// Seed data for the MVP demo. In production this is replaced by the
/// Nchito backend API (see nchito-ios/STRATEGY.md for the architecture).
enum MockDataService {

    static let currentUser = UserProfile(
        id: UUID(),
        fullName: "Owen Phiri",
        phone: "+260 97 000 0000",
        city: "Lusaka",
        bio: "Reliable and hardworking. Open to deliveries, digital tasks and tutoring.",
        skills: ["Deliveries", "Canva Design", "Maths Tutoring", "Data Entry"],
        rating: 4.8,
        completedGigs: 27,
        verification: .nrcVerified,
        referralCode: "OWEN260",
        referralEarningsZMW: 340,
        joinedDate: Calendar.current.date(byAdding: .month, value: -4, to: .now) ?? .now
    )

    static let gigs: [Gig] = [
        Gig(id: UUID(), title: "Deliver documents from Cairo Road to Woodlands",
            details: "Pick up a sealed envelope from an office on Cairo Road and deliver to Woodlands by 15:00. Must have own transport (bicycle or motorbike fine). Airtime allowance included.",
            category: .delivery, payZMW: 150, city: "Lusaka", area: "Cairo Road → Woodlands",
            posterName: "Chanda M.", posterRating: 4.9,
            postedAt: .now.addingTimeInterval(-1800), status: .open,
            isUrgent: true, isBoosted: true, applicants: 3),

        Gig(id: UUID(), title: "Design 5 social media posters for a salon",
            details: "New salon in Kabulonga needs 5 Canva/Photoshop posters for Facebook and TikTok. Brand colours provided. Deliver as PNG within 2 days.",
            category: .digital, payZMW: 400, city: "Lusaka", area: "Remote",
            posterName: "Beauty Haven", posterRating: 4.7,
            postedAt: .now.addingTimeInterval(-7200), status: .open,
            isUrgent: false, isBoosted: true, applicants: 8),

        Gig(id: UUID(), title: "Grade 9 Maths tutoring, 3 sessions per week",
            details: "Looking for a patient tutor for my daughter preparing for Grade 9 exams. Sessions at our home in Riverside, Kitwe. K120 per 90-minute session, paid weekly.",
            category: .tutoring, payZMW: 360, city: "Kitwe", area: "Riverside",
            posterName: "Mrs. Banda", posterRating: 5.0,
            postedAt: .now.addingTimeInterval(-10800), status: .open,
            isUrgent: false, isBoosted: false, applicants: 5),

        Gig(id: UUID(), title: "Fix leaking kitchen tap + replace 2 bulbs",
            details: "Simple plumbing and electrical job in Northrise, Ndola. Parts already bought. Should take under an hour for someone experienced.",
            category: .repairs, payZMW: 200, city: "Ndola", area: "Northrise",
            posterName: "Joseph K.", posterRating: 4.5,
            postedAt: .now.addingTimeInterval(-14400), status: .open,
            isUrgent: true, isBoosted: false, applicants: 2),

        Gig(id: UUID(), title: "Waiter/waitress for kitchen party (Saturday)",
            details: "Need 2 smart, experienced servers for a kitchen party in Avondale, 12:00–18:00. Uniform provided. Meal included. Payment same day via MoMo.",
            category: .events, payZMW: 250, city: "Lusaka", area: "Avondale",
            posterName: "Events by Mutale", posterRating: 4.8,
            postedAt: .now.addingTimeInterval(-21600), status: .open,
            isUrgent: false, isBoosted: false, applicants: 11),

        Gig(id: UUID(), title: "Weed and prepare 2 vegetable beds",
            details: "Backyard garden in Chelstone needs weeding and two beds prepared for rape and tomato planting. Tools provided.",
            category: .farm, payZMW: 180, city: "Lusaka", area: "Chelstone",
            posterName: "Agnes Z.", posterRating: 4.6,
            postedAt: .now.addingTimeInterval(-28800), status: .open,
            isUrgent: false, isBoosted: false, applicants: 4),

        Gig(id: UUID(), title: "Braids for 2 clients at home",
            details: "Mobile hairdresser needed in Parklands, Kitwe for box braids, 2 clients. Extensions already bought. Portfolio photos required when applying.",
            category: .beauty, payZMW: 450, city: "Kitwe", area: "Parklands",
            posterName: "Natasha C.", posterRating: 4.9,
            postedAt: .now.addingTimeInterval(-36000), status: .open,
            isUrgent: false, isBoosted: false, applicants: 6),

        Gig(id: UUID(), title: "Deep-clean 3-bedroom house before move-in",
            details: "Full clean of an empty house in Ibex Hill: floors, windows, bathrooms, kitchen. Cleaning materials provided. Can be a 2-person team.",
            category: .homeServices, payZMW: 500, city: "Lusaka", area: "Ibex Hill",
            posterName: "Mwansa T.", posterRating: 4.4,
            postedAt: .now.addingTimeInterval(-43200), status: .open,
            isUrgent: false, isBoosted: false, applicants: 9),
    ]

    static let microTasks: [MicroTask] = [
        MicroTask(id: UUID(), title: "5-min survey: mobile money habits", kind: .survey,
                  rewardZMW: 15, minutes: 5, slotsLeft: 120, isCompleted: false),
        MicroTask(id: UUID(), title: "Test a new banking app and report 3 issues", kind: .appTest,
                  rewardZMW: 60, minutes: 20, slotsLeft: 25, isCompleted: false),
        MicroTask(id: UUID(), title: "Label 50 photos of Zambian road signs", kind: .dataLabel,
                  rewardZMW: 40, minutes: 25, slotsLeft: 80, isCompleted: false),
        MicroTask(id: UUID(), title: "Share a local business promo to your WhatsApp status", kind: .social,
                  rewardZMW: 10, minutes: 2, slotsLeft: 300, isCompleted: false),
        MicroTask(id: UUID(), title: "Mystery-shop a supermarket till and rate service", kind: .mysteryShop,
                  rewardZMW: 70, minutes: 30, slotsLeft: 10, isCompleted: false),
        MicroTask(id: UUID(), title: "10-min survey: transport costs in your area", kind: .survey,
                  rewardZMW: 25, minutes: 10, slotsLeft: 60, isCompleted: false),
    ]

    static let transactions: [WalletTransaction] = [
        WalletTransaction(id: UUID(), kind: .gigPayout, amountZMW: 405,
                          note: "Poster design gig — Beauty Haven", date: .now.addingTimeInterval(-86400)),
        WalletTransaction(id: UUID(), kind: .taskReward, amountZMW: 15,
                          note: "Survey: mobile money habits", date: .now.addingTimeInterval(-172800)),
        WalletTransaction(id: UUID(), kind: .referralBonus, amountZMW: 20,
                          note: "Friend joined with code OWEN260", date: .now.addingTimeInterval(-259200)),
        WalletTransaction(id: UUID(), kind: .cashOut, amountZMW: -300,
                          note: "Cash out to MTN MoMo •••0000", date: .now.addingTimeInterval(-345600)),
        WalletTransaction(id: UUID(), kind: .gigPayout, amountZMW: 225,
                          note: "Kitchen party serving — Events by Mutale", date: .now.addingTimeInterval(-432000)),
    ]
}

// MARK: - Chat seed data

extension MockDataService {

    static let conversationBeautyHaven = Conversation(
        id: UUID(), counterpartName: "Beauty Haven", counterpartRating: 4.7,
        gigID: gigs[1].id, gigTitle: gigs[1].title,
        lastActivity: .now.addingTimeInterval(-900))

    static let conversationChanda = Conversation(
        id: UUID(), counterpartName: "Chanda M.", counterpartRating: 4.9,
        gigID: gigs[0].id, gigTitle: gigs[0].title,
        lastActivity: .now.addingTimeInterval(-5400))

    static let conversations: [Conversation] = [conversationBeautyHaven, conversationChanda]

    static let messages: [ChatMessage] = [
        ChatMessage(id: UUID(), conversationID: conversationBeautyHaven.id, isMine: false,
                    body: "Hi Owen! I saw your application — do you have samples of poster work?",
                    date: .now.addingTimeInterval(-3600)),
        ChatMessage(id: UUID(), conversationID: conversationBeautyHaven.id, isMine: true,
                    body: "Hello! Yes, I'll send 3 recent Canva designs I did for a barbershop and a boutique.",
                    date: .now.addingTimeInterval(-3300)),
        ChatMessage(id: UUID(), conversationID: conversationBeautyHaven.id, isMine: false,
                    body: "These look great 👌 If I pick you, can you deliver by Thursday?",
                    date: .now.addingTimeInterval(-900)),
        ChatMessage(id: UUID(), conversationID: conversationChanda.id, isMine: false,
                    body: "Are you available today before 15:00? It's a sealed envelope, Cairo Road pickup.",
                    date: .now.addingTimeInterval(-7200)),
        ChatMessage(id: UUID(), conversationID: conversationChanda.id, isMine: true,
                    body: "Yes, I can pick up by 13:30 and deliver to Woodlands within the hour.",
                    date: .now.addingTimeInterval(-5400)),
    ]
}
