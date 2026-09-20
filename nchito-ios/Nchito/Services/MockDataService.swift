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
        // Spread across all eight service families: widening the taxonomy to 39
        // categories achieves nothing if the demo feed still only shows deliveries
        // and design work, and every other group chip opens onto an empty list.
        Gig(id: UUID(), title: "Build a boundary wall — 3 days of bricklaying",
            details: "Approximately 18 metres of block wall at a plot in Chalala. Blocks, sand and cement on site. Bring your own trowel and level. Two general workers provided.",
            category: .bricklaying, payZMW: 1800, city: "Lusaka", area: "Chalala",
            posterName: "Kalunga Properties", posterRating: 4.6,
            postedAt: .now.addingTimeInterval(-3600), status: .open,
            isUrgent: false, isBoosted: true, applicants: 7,
            completedWithPoster: 2),
        Gig(id: UUID(), title: "Rewire two sockets and fit a DB board",
            details: "Small house in Kabwata needs two sockets rewired and a new distribution board fitted. Certificate required — please state your registration.",
            category: .electrical, payZMW: 950, city: "Lusaka", area: "Kabwata",
            posterName: "Daniel S.", posterRating: 4.8,
            postedAt: .now.addingTimeInterval(-18000), status: .open,
            isUrgent: true, isBoosted: false, applicants: 3),
        Gig(id: UUID(), title: "Make 40 chitenge uniforms for a church choir",
            details: "Sewing 40 matching choir outfits from supplied chitenge. Measurements collected already. Three weeks to deliver, payment in two stages.",
            category: .tailoring, payZMW: 3200, city: "Ndola", area: "Masala",
            posterName: "UCZ Masala", posterRating: 5.0,
            postedAt: .now.addingTimeInterval(-86400), status: .open,
            isUrgent: false, isBoosted: false, applicants: 12,
            completedWithPoster: 1),
        Gig(id: UUID(), title: "Cook for a 60-guest wedding reception",
            details: "Experienced chef to lead cooking for 60 guests — nshima, chicken, beef stew, rice and vegetables. Kitchen team of four provided. Own transport needed.",
            category: .chef, payZMW: 2500, city: "Lusaka", area: "Chilanga",
            posterName: "Mulenga Family", posterRating: 4.9,
            postedAt: .now.addingTimeInterval(-25200), status: .open,
            isUrgent: false, isBoosted: true, applicants: 5),
        Gig(id: UUID(), title: "Build a 6-page website for a hardware shop",
            details: "Simple WordPress or hand-built site: home, products, about, contact, location, WhatsApp button. Hosting already bought. Content supplied.",
            category: .webDesign, payZMW: 4500, city: "Lusaka", area: "Remote",
            posterName: "Chembe Hardware", posterRating: 4.5,
            postedAt: .now.addingTimeInterval(-39600), status: .open,
            isUrgent: false, isBoosted: true, applicants: 15),
        Gig(id: UUID(), title: "Two loaders to offload a 10-tonne maize truck",
            details: "Offloading 50kg bags from a truck into a store in Makeni. Roughly four hours of work. Water and lunch provided. Paid same day.",
            category: .loading, payZMW: 320, city: "Lusaka", area: "Makeni",
            posterName: "Musa Traders", posterRating: 4.3,
            postedAt: .now.addingTimeInterval(-7200), status: .open,
            isUrgent: true, isBoosted: false, applicants: 6),
        Gig(id: UUID(), title: "Office assistant: filing, typing and reception",
            details: "Two weeks covering an office in Northmead — answering the phone, typing letters, filing and managing a small diary. Immediate start.",
            category: .officeAdmin, payZMW: 1600, city: "Lusaka", area: "Northmead",
            posterName: "Lusaka Legal Chambers", posterRating: 4.6,
            postedAt: .now.addingTimeInterval(-57600), status: .open,
            isUrgent: true, isBoosted: false, applicants: 21),
        Gig(id: UUID(), title: "Translate a health leaflet into Bemba and Nyanja",
            details: "A 900-word clinic leaflet needs careful translation into Bemba and Nyanja. Plain language for community health workers.",
            category: .translation, payZMW: 900, city: "Lusaka", area: "Remote",
            posterName: "Lifeline Clinic", posterRating: 4.9,
            postedAt: .now.addingTimeInterval(-86400), status: .open,
            isUrgent: false, isBoosted: false, applicants: 7),
        Gig(id: UUID(), title: "Relief teacher: Grade 5, half a term",
            details: "Cover a Grade 5 class at a community school in Chawama for six weeks. Teaching qualification required. Paid fortnightly.",
            category: .teaching, payZMW: 4000, city: "Lusaka", area: "Chawama",
            posterName: "Chawama Community School", posterRating: 4.9,
            postedAt: .now.addingTimeInterval(-172800), status: .open,
            isUrgent: false, isBoosted: false, applicants: 16),
        Gig(id: UUID(), title: "Sunday guest preacher for a youth service",
            details: "Guest speaker for a youth service in Matero, 10:00–12:00. Topic: work and integrity. Transport refund included in the amount.",
            category: .ministry, payZMW: 500, city: "Lusaka", area: "Matero",
            posterName: "Grace Assembly", posterRating: 5.0,
            postedAt: .now.addingTimeInterval(-172800), status: .open,
            isUrgent: false, isBoosted: false, applicants: 3),
        Gig(id: UUID(), title: "Nanny for two children, weekday mornings",
            details: "Care for a 2-year-old and a 4-year-old, 07:00–13:00, Monday to Friday, in Roma. Cooking for the children included. References essential.",
            category: .childcare, payZMW: 2400, city: "Lusaka", area: "Roma",
            posterName: "Tembo Family", posterRating: 4.9,
            postedAt: .now.addingTimeInterval(-172800), status: .open,
            isUrgent: false, isBoosted: false, applicants: 18),
        Gig(id: UUID(), title: "Barber for a weekend at a Kitwe shop",
            details: "Cover a barbershop in Chimwemwe on Saturday and Sunday. Clippers and chair provided. Paid per head plus a guaranteed minimum.",
            category: .barbering, payZMW: 600, city: "Kitwe", area: "Chimwemwe",
            posterName: "Fresh Cuts", posterRating: 4.6,
            postedAt: .now.addingTimeInterval(-50400), status: .open,
            isUrgent: false, isBoosted: false, applicants: 8,
            completedWithPoster: 3),
        Gig(id: UUID(), title: "Live band for a company end-of-year party",
            details: "Four-piece band or keyboardist plus vocalist for a corporate function in Rhodes Park, 19:00–22:00. PA system available on site.",
            category: .music, payZMW: 3500, city: "Lusaka", area: "Rhodes Park",
            posterName: "Zamtel Staff Club", posterRating: 4.7,
            postedAt: .now.addingTimeInterval(-32400), status: .open,
            isUrgent: false, isBoosted: false, applicants: 4),
        Gig(id: UUID(), title: "Night guard for a warehouse, two weeks",
            details: "Cover the night shift, 18:00–06:00, at a warehouse in Light Industrial Area. Reference and NRC required.",
            category: .security, payZMW: 1900, city: "Lusaka", area: "Light Industrial",
            posterName: "Zamcargo Ltd", posterRating: 4.2,
            postedAt: .now.addingTimeInterval(-86400), status: .open,
            isUrgent: false, isBoosted: false, applicants: 14),

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
            isUrgent: false, isBoosted: true, applicants: 8,
            completedWithPoster: 4),

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
            isUrgent: false, isBoosted: false, applicants: 11,
            completedWithPoster: 12),

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

// MARK: - Settled gig history

extension MockDataService {

    /// Gigs that have already been paid out. These never appear in the open
    /// feed — they exist so price bands (INNOVATION.md §5.1) have real
    /// comparables, exactly as production queries `status = 'paid'` rows.
    static let settledGigs: [Gig] = {
        let priced: [(GigCategory, String, [Double])] = [
            (.delivery,     "Lusaka", [80, 100, 120, 150, 150, 180, 200, 250]),
            (.delivery,     "Kitwe",  [70, 90, 110, 140, 160]),
            (.homeServices, "Lusaka", [250, 300, 350, 400, 450, 500, 600]),
            (.tutoring,     "Lusaka", [200, 250, 300, 350, 400, 480]),
            (.tutoring,     "Kitwe",  [180, 240, 300, 340, 360]),
            (.digital,      "Lusaka", [150, 250, 300, 400, 450, 600, 800]),
            (.events,       "Lusaka", [150, 200, 250, 250, 300, 400]),
            (.farm,         "Lusaka", [100, 120, 150, 180, 200, 220]),
            (.beauty,       "Kitwe",  [200, 280, 350, 400, 450, 500]),
            (.repairs,      "Ndola",  [120, 150, 200, 220, 280, 300]),
        ]

        return priced.flatMap { category, city, amounts in
            amounts.enumerated().map { index, amount in
                Gig(id: UUID(),
                    title: "Completed \(category.rawValue) gig",
                    details: "Settled gig retained for price comparison.",
                    category: category, payZMW: amount, city: city, area: "—",
                    posterName: "—", posterRating: 4.5,
                    postedAt: .now.addingTimeInterval(-Double(86400 * (index + 7))),
                    status: .paid,
                    isUrgent: false, isBoosted: false, applicants: 0)
            }
        }
    }()
}

// MARK: - Proof-of-work seed

extension MockDataService {

    /// The salon poster gig is mid-flight with a "before" photo already taken,
    /// so the capture flow and the blocked-release state are both demoable.
    static let proofPhotos: [ProofPhoto] = [
        ProofPhoto(id: UUID(), gigID: gigs[1].id, kind: .before,
                   storagePath: "", capturedAt: .now.addingTimeInterval(-5400),
                   latitude: -15.3875, longitude: 28.3228),
    ]
}

// MARK: - Work Record seed

extension MockDataService {

    /// A believable four-month history for the demo user, matching the 27
    /// completed gigs on their profile. Signatures are placeholders here;
    /// production values come from `release_escrow()` and are checked by
    /// `verify_work_record()`.
    static let workRecordEntries: [WorkRecordEntry] = {
        let history: [(String, GigCategory, String, Double, Int, Double?, Bool)] = [
            ("Design 5 social media posters for a salon", .digital, "Lusaka", 400, 3, 5.0, true),
            ("Deliver parcel to Chilenje", .delivery, "Lusaka", 120, 6, 4.5, true),
            ("Serve at a kitchen party in Avondale", .events, "Lusaka", 250, 9, 5.0, true),
            ("Menu flyers for a takeaway", .digital, "Lusaka", 300, 12, 4.5, true),
            ("Grade 7 maths tutoring, 4 sessions", .tutoring, "Lusaka", 480, 16, 5.0, true),
            ("Collect documents from Manda Hill", .delivery, "Lusaka", 100, 19, 4.0, false),
            ("Logo and business cards for a barber", .digital, "Lusaka", 450, 23, 5.0, true),
            ("Deep clean after a move-out", .homeServices, "Lusaka", 500, 27, 4.5, true),
            ("Data entry: 300 customer records", .digital, "Lusaka", 350, 31, 4.5, true),
            ("Deliver cake across town", .delivery, "Lusaka", 150, 35, 5.0, true),
            ("Weekend waiter, corporate function", .events, "Lusaka", 300, 40, 4.5, true),
            ("Weed and replant front garden", .farm, "Lusaka", 180, 45, 4.0, true),
            ("Grade 9 maths tutoring, 6 sessions", .tutoring, "Lusaka", 720, 52, 5.0, true),
            ("Instagram posts for a boutique", .digital, "Lusaka", 400, 58, 5.0, true),
            ("Deliver medication to Kabulonga", .delivery, "Lusaka", 130, 64, 5.0, true),
            ("Office deep clean, 2 floors", .homeServices, "Lusaka", 600, 71, 4.5, true),
            ("Birthday party setup and serving", .events, "Lusaka", 280, 78, 4.5, true),
            ("Poster set for a church event", .digital, "Lusaka", 320, 85, 5.0, true),
            ("Deliver 3 parcels, Cairo Road run", .delivery, "Lusaka", 200, 92, 4.5, true),
            ("Primary school English tutoring", .tutoring, "Lusaka", 400, 99, 5.0, true),
            ("Vegetable beds prepared for planting", .farm, "Lusaka", 200, 106, 4.0, false),
            ("Product photos edited for an online shop", .digital, "Lusaka", 380, 112, 4.5, true),
            ("Deliver documents to Longacres", .delivery, "Lusaka", 110, 118, 5.0, true),
            ("Post-event cleanup crew", .homeServices, "Lusaka", 350, 119, 4.5, true),
            ("Flyers for a hardware shop", .digital, "Lusaka", 280, 120, 4.5, true),
            ("Grade 8 maths tutoring, 3 sessions", .tutoring, "Lusaka", 360, 121, 5.0, true),
            ("Deliver groceries to Woodlands", .delivery, "Lusaka", 140, 122, 5.0, true),
        ]

        return history.map { title, category, city, pay, daysAgo, rating, onTime in
            WorkRecordEntry(
                id: UUID(), gigID: UUID(), title: title, category: category, city: city,
                payZMW: pay,
                completedAt: .now.addingTimeInterval(-Double(daysAgo) * 86400),
                posterRating: rating, onTime: onTime,
                signature: "demo-unsigned", isVerified: true)
        }
    }()
}

// MARK: - Agent liquidity seed

extension MockDataService {

    /// A believable spread of Lusaka agents, deliberately covering every
    /// liquidity state — including "unknown", which is the most common one in
    /// a real market and the easiest to forget to design for.
    static let agents: [MobileMoneyAgent] = {
        func liquidity(_ reports: [(AgentReportOutcome, Double?, Double)]) -> AgentLiquidity {
            LiquidityService.liquidity(from: reports.map { outcome, amount, hoursAgo in
                LiquidityService.Report(outcome: outcome, amountZMW: amount,
                                        createdAt: .now.addingTimeInterval(-hoursAgo * 3600))
            })
        }

        return [
            MobileMoneyAgent(
                id: UUID(), name: "Kabulonga Quickpay", area: "Kabulonga",
                landmark: "next to Melissa Supermarket",
                latitude: -15.4067, longitude: 28.3419, distanceKM: 0.4,
                isOperatorVerified: true,
                liquidity: liquidity([(.cashAvailable, 1500, 0.3), (.cashAvailable, 800, 0.9)])),

            MobileMoneyAgent(
                id: UUID(), name: "Chibwe Phone Shop", area: "Woodlands",
                landmark: "opposite the filling station",
                latitude: -15.4211, longitude: 28.3188, distanceKM: 1.1,
                isOperatorVerified: false,
                liquidity: liquidity([(.cashAvailable, 300, 0.5)])),

            MobileMoneyAgent(
                id: UUID(), name: "Mulungushi Agent Point", area: "Rhodes Park",
                landmark: "inside the arcade",
                latitude: -15.4003, longitude: 28.3077, distanceKM: 1.8,
                isOperatorVerified: true,
                liquidity: liquidity([(.noCash, nil, 0.4), (.noCash, nil, 1.2)])),

            MobileMoneyAgent(
                id: UUID(), name: "Cairo Road Money Centre", area: "Cairo Road",
                landmark: "near the post office",
                latitude: -15.4194, longitude: 28.2833, distanceKM: 2.6,
                isOperatorVerified: true,
                liquidity: liquidity([(.cashAvailable, 2000, 0.6), (.noCash, nil, 0.8)])),

            MobileMoneyAgent(
                id: UUID(), name: "Chelstone Corner Kiosk", area: "Chelstone",
                landmark: "by the market entrance",
                latitude: -15.3644, longitude: 28.3722, distanceKM: 3.4,
                isOperatorVerified: false,
                liquidity: liquidity([(.cashAvailable, 600, 9)])),   // stale: reads unknown

            MobileMoneyAgent(
                id: UUID(), name: "Northmead Agent", area: "Northmead",
                landmark: "next to the pharmacy",
                latitude: -15.3936, longitude: 28.3200, distanceKM: 1.4,
                isOperatorVerified: false,
                liquidity: liquidity([])),                            // never reported
        ]
    }()
}

extension MockDataService {

    /// Two circles: one running, one still filling up. The running one puts the
    /// signed-in user behind — they have paid in and not yet collected — which
    /// is the state where the screens have something honest to say.
    static let chilimbaCircles: [ChilimbaCircle] = {
        let names = ["Naomi C.", "Owen Phiri", "Joseph K.", "Mercy L."]
        let active = ChilimbaCircle(
            id: UUID(), name: "Soweto Traders", contributionZMW: 200, cadence: .monthly,
            status: .active, currentRound: 2, memberTarget: 4, inviteCode: nil,
            members: names.enumerated().map { index, name in
                ChilimbaMember(
                    id: UUID(), name: name, position: index + 1, isActive: true,
                    isMe: name == "Owen Phiri",
                    hasPaidThisRound: index % 2 == 0,
                    paidInZMW: index % 2 == 0 ? 400 : 200,
                    receivedZMW: index == 0 ? 800 : 0)
            },
            autoContribute: true)

        let forming = ChilimbaCircle(
            id: UUID(), name: "Kabwata Ladies", contributionZMW: 500, cadence: .monthly,
            status: .forming, currentRound: 0, memberTarget: 6, inviteCode: "A7F3C2",
            members: ["Chileshe N.", "Owen Phiri", "Agnes Z."].map { name in
                ChilimbaMember(
                    id: UUID(), name: name, position: nil, isActive: true,
                    isMe: name == "Owen Phiri", hasPaidThisRound: false,
                    paidInZMW: 0, receivedZMW: 0)
            },
            autoContribute: false)

        return [active, forming]
    }()
}
