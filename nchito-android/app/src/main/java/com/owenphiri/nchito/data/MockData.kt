package com.owenphiri.nchito.data

import java.util.Date

// Same Lusaka/Kitwe/Ndola seed data as the iOS app's MockDataService.
object MockData {

    val gigs = listOf(
        // Spread across all eight service families: widening the taxonomy to 39
        // categories achieves nothing if the demo feed still only shows deliveries
        // and design work, and every other group chip opens onto an empty list.
        Gig(title = "Build a boundary wall — 3 days of bricklaying",
            details = "Approximately 18 metres of block wall at a plot in Chalala. Blocks, sand and cement on site. Bring your own trowel and level. Two general workers provided.",
            category = GigCategory.BRICKLAYING, payZMW = 1800.0, city = "Lusaka",
            area = "Chalala", posterName = "Kalunga Properties", posterRating = 4.6,
            minutesAgo = 60, isBoosted = true, applicants = 7,
            completedWithPoster = 2),
        Gig(title = "Rewire two sockets and fit a DB board",
            details = "Small house in Kabwata needs two sockets rewired and a new distribution board fitted. Certificate required — please state your registration.",
            category = GigCategory.ELECTRICAL, payZMW = 950.0, city = "Lusaka",
            area = "Kabwata", posterName = "Daniel S.", posterRating = 4.8,
            minutesAgo = 300, isUrgent = true, applicants = 3),
        Gig(title = "Make 40 chitenge uniforms for a church choir",
            details = "Sewing 40 matching choir outfits from supplied chitenge. Measurements collected already. Three weeks to deliver, payment in two stages.",
            category = GigCategory.TAILORING, payZMW = 3200.0, city = "Ndola",
            area = "Masala", posterName = "UCZ Masala", posterRating = 5.0,
            minutesAgo = 1440, applicants = 12,
            completedWithPoster = 1),
        Gig(title = "Cook for a 60-guest wedding reception",
            details = "Experienced chef to lead cooking for 60 guests — nshima, chicken, beef stew, rice and vegetables. Kitchen team of four provided. Own transport needed.",
            category = GigCategory.CHEF, payZMW = 2500.0, city = "Lusaka",
            area = "Chilanga", posterName = "Mulenga Family", posterRating = 4.9,
            minutesAgo = 420, isBoosted = true, applicants = 5),
        Gig(title = "Build a 6-page website for a hardware shop",
            details = "Simple WordPress or hand-built site: home, products, about, contact, location, WhatsApp button. Hosting already bought. Content supplied.",
            category = GigCategory.WEB_DESIGN, payZMW = 4500.0, city = "Lusaka",
            area = "Remote", posterName = "Chembe Hardware", posterRating = 4.5,
            minutesAgo = 660, isBoosted = true, applicants = 15),
        Gig(title = "Two loaders to offload a 10-tonne maize truck",
            details = "Offloading 50kg bags from a truck into a store in Makeni. Roughly four hours of work. Water and lunch provided. Paid same day.",
            category = GigCategory.LOADING, payZMW = 320.0, city = "Lusaka",
            area = "Makeni", posterName = "Musa Traders", posterRating = 4.3,
            minutesAgo = 120, isUrgent = true, applicants = 6),
        Gig(title = "Office assistant: filing, typing and reception",
            details = "Two weeks covering an office in Northmead — answering the phone, typing letters, filing and managing a small diary. Immediate start.",
            category = GigCategory.OFFICE_ADMIN, payZMW = 1600.0, city = "Lusaka",
            area = "Northmead", posterName = "Lusaka Legal Chambers", posterRating = 4.6,
            minutesAgo = 960, isUrgent = true, applicants = 21),
        Gig(title = "Translate a health leaflet into Bemba and Nyanja",
            details = "A 900-word clinic leaflet needs careful translation into Bemba and Nyanja. Plain language for community health workers.",
            category = GigCategory.TRANSLATION, payZMW = 900.0, city = "Lusaka",
            area = "Remote", posterName = "Lifeline Clinic", posterRating = 4.9,
            minutesAgo = 1440, applicants = 7),
        Gig(title = "Relief teacher: Grade 5, half a term",
            details = "Cover a Grade 5 class at a community school in Chawama for six weeks. Teaching qualification required. Paid fortnightly.",
            category = GigCategory.TEACHING, payZMW = 4000.0, city = "Lusaka",
            area = "Chawama", posterName = "Chawama Community School", posterRating = 4.9,
            minutesAgo = 2880, applicants = 16),
        Gig(title = "Sunday guest preacher for a youth service",
            details = "Guest speaker for a youth service in Matero, 10:00–12:00. Topic: work and integrity. Transport refund included in the amount.",
            category = GigCategory.MINISTRY, payZMW = 500.0, city = "Lusaka",
            area = "Matero", posterName = "Grace Assembly", posterRating = 5.0,
            minutesAgo = 2880, applicants = 3),
        Gig(title = "Nanny for two children, weekday mornings",
            details = "Care for a 2-year-old and a 4-year-old, 07:00–13:00, Monday to Friday, in Roma. Cooking for the children included. References essential.",
            category = GigCategory.CHILDCARE, payZMW = 2400.0, city = "Lusaka",
            area = "Roma", posterName = "Tembo Family", posterRating = 4.9,
            minutesAgo = 2880, applicants = 18),
        Gig(title = "Barber for a weekend at a Kitwe shop",
            details = "Cover a barbershop in Chimwemwe on Saturday and Sunday. Clippers and chair provided. Paid per head plus a guaranteed minimum.",
            category = GigCategory.BARBERING, payZMW = 600.0, city = "Kitwe",
            area = "Chimwemwe", posterName = "Fresh Cuts", posterRating = 4.6,
            minutesAgo = 840, applicants = 8,
            completedWithPoster = 3),
        Gig(title = "Live band for a company end-of-year party",
            details = "Four-piece band or keyboardist plus vocalist for a corporate function in Rhodes Park, 19:00–22:00. PA system available on site.",
            category = GigCategory.MUSIC, payZMW = 3500.0, city = "Lusaka",
            area = "Rhodes Park", posterName = "Zamtel Staff Club", posterRating = 4.7,
            minutesAgo = 540, applicants = 4),
        Gig(title = "Night guard for a warehouse, two weeks",
            details = "Cover the night shift, 18:00–06:00, at a warehouse in Light Industrial Area. Reference and NRC required.",
            category = GigCategory.SECURITY, payZMW = 1900.0, city = "Lusaka",
            area = "Light Industrial", posterName = "Zamcargo Ltd", posterRating = 4.2,
            minutesAgo = 1440, applicants = 14),

        Gig(title = "Deliver documents from Cairo Road to Woodlands",
            details = "Pick up a sealed envelope from an office on Cairo Road and deliver to Woodlands by 15:00. Must have own transport (bicycle or motorbike fine). Airtime allowance included.",
            category = GigCategory.DELIVERY, payZMW = 150.0, city = "Lusaka",
            area = "Cairo Road → Woodlands", posterName = "Chanda M.", posterRating = 4.9,
            minutesAgo = 30, isUrgent = true, isBoosted = true, applicants = 3),
        Gig(title = "Design 5 social media posters for a salon",
            details = "New salon in Kabulonga needs 5 Canva/Photoshop posters for Facebook and TikTok. Brand colours provided. Deliver as PNG within 2 days.",
            category = GigCategory.DIGITAL, payZMW = 400.0, city = "Lusaka",
            area = "Remote", posterName = "Beauty Haven", posterRating = 4.7,
            minutesAgo = 120, isBoosted = true, applicants = 8,
            completedWithPoster = 4),
        Gig(title = "Grade 9 Maths tutoring, 3 sessions per week",
            details = "Looking for a patient tutor for my daughter preparing for Grade 9 exams. Sessions at our home in Riverside, Kitwe. K120 per 90-minute session, paid weekly.",
            category = GigCategory.TUTORING, payZMW = 360.0, city = "Kitwe",
            area = "Riverside", posterName = "Mrs. Banda", posterRating = 5.0,
            minutesAgo = 180, applicants = 5),
        Gig(title = "Fix leaking kitchen tap + replace 2 bulbs",
            details = "Simple plumbing and electrical job in Northrise, Ndola. Parts already bought. Should take under an hour for someone experienced.",
            category = GigCategory.REPAIRS, payZMW = 200.0, city = "Ndola",
            area = "Northrise", posterName = "Joseph K.", posterRating = 4.5,
            minutesAgo = 240, isUrgent = true, applicants = 2),
        Gig(title = "Waiter/waitress for kitchen party (Saturday)",
            details = "Need 2 smart, experienced servers for a kitchen party in Avondale, 12:00–18:00. Uniform provided. Meal included. Payment same day via MoMo.",
            category = GigCategory.EVENTS, payZMW = 250.0, city = "Lusaka",
            area = "Avondale", posterName = "Events by Mutale", posterRating = 4.8,
            minutesAgo = 360, applicants = 11,
            completedWithPoster = 12),
        Gig(title = "Deep-clean 3-bedroom house before move-in",
            details = "Full clean of an empty house in Ibex Hill: floors, windows, bathrooms, kitchen. Cleaning materials provided. Can be a 2-person team.",
            category = GigCategory.HOME_SERVICES, payZMW = 500.0, city = "Lusaka",
            area = "Ibex Hill", posterName = "Mwansa T.", posterRating = 4.4,
            minutesAgo = 720, applicants = 9),
    )

    val microTasks = listOf(
        MicroTask(title = "5-min survey: mobile money habits",
                  kind = MicroTaskKind.SURVEY, rewardZMW = 15.0, minutes = 5, slotsLeft = 120),
        MicroTask(title = "Test a new banking app and report 3 issues",
                  kind = MicroTaskKind.APP_TEST, rewardZMW = 60.0, minutes = 20, slotsLeft = 25),
        MicroTask(title = "Label 50 photos of Zambian road signs",
                  kind = MicroTaskKind.DATA_LABEL, rewardZMW = 40.0, minutes = 25, slotsLeft = 80),
        MicroTask(title = "Share a local business promo to your WhatsApp status",
                  kind = MicroTaskKind.SOCIAL, rewardZMW = 10.0, minutes = 2, slotsLeft = 300),
        MicroTask(title = "Mystery-shop a supermarket till and rate service",
                  kind = MicroTaskKind.MYSTERY_SHOP, rewardZMW = 70.0, minutes = 30, slotsLeft = 10),
    )

    val transactions = listOf(
        WalletTransaction(kind = TxKind.GIG_PAYOUT, amountZMW = 405.0,
                          note = "Poster design gig — Beauty Haven"),
        WalletTransaction(kind = TxKind.TASK_REWARD, amountZMW = 15.0,
                          note = "Survey: mobile money habits"),
        WalletTransaction(kind = TxKind.REFERRAL_BONUS, amountZMW = 20.0,
                          note = "Friend joined with code OWEN260"),
        WalletTransaction(kind = TxKind.CASH_OUT, amountZMW = -300.0,
                          note = "Cash out to MTN MoMo •••0000"),
    )

    private val convoBeauty = Conversation(
        counterpartName = "Beauty Haven", counterpartRating = 4.7,
        gigId = gigs[1].id, gigTitle = gigs[1].title)
    private val convoChanda = Conversation(
        counterpartName = "Chanda M.", counterpartRating = 4.9,
        gigId = gigs[0].id, gigTitle = gigs[0].title)

    val conversations = listOf(convoBeauty, convoChanda)

    val messages = listOf(
        ChatMessage(conversationId = convoBeauty.id, isMine = false,
                    body = "Hi! I saw your application — do you have samples of poster work?", time = "09:12"),
        ChatMessage(conversationId = convoBeauty.id, isMine = true,
                    body = "Hello! Yes, I'll send 3 recent Canva designs I did for a barbershop and a boutique.", time = "09:17"),
        ChatMessage(conversationId = convoBeauty.id, isMine = false,
                    body = "These look great 👌 If I pick you, can you deliver by Thursday?", time = "09:55"),
        ChatMessage(conversationId = convoChanda.id, isMine = false,
                    body = "Are you available today before 15:00? It's a sealed envelope, Cairo Road pickup.", time = "08:02"),
        ChatMessage(conversationId = convoChanda.id, isMine = true,
                    body = "Yes, I can pick up by 13:30 and deliver to Woodlands within the hour.", time = "08:31"),
    )

    /**
     * Gigs already paid out. These never appear in the open feed — they exist
     * so price bands have real comparables, exactly as production queries
     * `status = 'paid'` rows.
     */
    val settledGigs: List<Gig> = listOf(
        Triple(GigCategory.DELIVERY, "Lusaka", listOf(80.0, 100.0, 120.0, 150.0, 150.0, 180.0, 200.0, 250.0)),
        Triple(GigCategory.DELIVERY, "Kitwe", listOf(70.0, 90.0, 110.0, 140.0, 160.0)),
        Triple(GigCategory.HOME_SERVICES, "Lusaka", listOf(250.0, 300.0, 350.0, 400.0, 450.0, 500.0, 600.0)),
        Triple(GigCategory.TUTORING, "Lusaka", listOf(200.0, 250.0, 300.0, 350.0, 400.0, 480.0)),
        Triple(GigCategory.TUTORING, "Kitwe", listOf(180.0, 240.0, 300.0, 340.0, 360.0)),
        Triple(GigCategory.DIGITAL, "Lusaka", listOf(150.0, 250.0, 300.0, 400.0, 450.0, 600.0, 800.0)),
        Triple(GigCategory.EVENTS, "Lusaka", listOf(150.0, 200.0, 250.0, 250.0, 300.0, 400.0)),
        Triple(GigCategory.FARM, "Lusaka", listOf(100.0, 120.0, 150.0, 180.0, 200.0, 220.0)),
        Triple(GigCategory.BEAUTY, "Kitwe", listOf(200.0, 280.0, 350.0, 400.0, 450.0, 500.0)),
        Triple(GigCategory.REPAIRS, "Ndola", listOf(120.0, 150.0, 200.0, 220.0, 280.0, 300.0)),
    ).flatMap { (category, city, amounts) ->
        amounts.map { amount ->
            Gig(title = "Completed ${category.label} gig",
                details = "Settled gig retained for price comparison.",
                category = category, payZMW = amount, city = city, area = "—",
                posterName = "—", posterRating = 4.5, minutesAgo = 10_000,
                status = GigStatus.PAID)
        }
    }

    /**
     * A believable four-month history for the demo user, matching the 27
     * completed gigs on their profile. Signatures are placeholders here;
     * production values come from `release_escrow()`.
     */
    val workRecordEntries: List<WorkRecordEntry> = listOf(
        Triple("Design 5 social media posters for a salon", GigCategory.DIGITAL, 400.0) to Triple(3, 5.0, true),
        Triple("Deliver parcel to Chilenje", GigCategory.DELIVERY, 120.0) to Triple(6, 4.5, true),
        Triple("Serve at a kitchen party in Avondale", GigCategory.EVENTS, 250.0) to Triple(9, 5.0, true),
        Triple("Menu flyers for a takeaway", GigCategory.DIGITAL, 300.0) to Triple(12, 4.5, true),
        Triple("Grade 7 maths tutoring, 4 sessions", GigCategory.TUTORING, 480.0) to Triple(16, 5.0, true),
        Triple("Collect documents from Manda Hill", GigCategory.DELIVERY, 100.0) to Triple(19, 4.0, false),
        Triple("Logo and business cards for a barber", GigCategory.DIGITAL, 450.0) to Triple(23, 5.0, true),
        Triple("Deep clean after a move-out", GigCategory.HOME_SERVICES, 500.0) to Triple(27, 4.5, true),
        Triple("Data entry: 300 customer records", GigCategory.DIGITAL, 350.0) to Triple(31, 4.5, true),
        Triple("Deliver cake across town", GigCategory.DELIVERY, 150.0) to Triple(35, 5.0, true),
        Triple("Weekend waiter, corporate function", GigCategory.EVENTS, 300.0) to Triple(40, 4.5, true),
        Triple("Weed and replant front garden", GigCategory.FARM, 180.0) to Triple(45, 4.0, true),
        Triple("Grade 9 maths tutoring, 6 sessions", GigCategory.TUTORING, 720.0) to Triple(52, 5.0, true),
        Triple("Instagram posts for a boutique", GigCategory.DIGITAL, 400.0) to Triple(58, 5.0, true),
        Triple("Deliver medication to Kabulonga", GigCategory.DELIVERY, 130.0) to Triple(64, 5.0, true),
        Triple("Office deep clean, 2 floors", GigCategory.HOME_SERVICES, 600.0) to Triple(71, 4.5, true),
        Triple("Birthday party setup and serving", GigCategory.EVENTS, 280.0) to Triple(78, 4.5, true),
        Triple("Poster set for a church event", GigCategory.DIGITAL, 320.0) to Triple(85, 5.0, true),
        Triple("Deliver 3 parcels, Cairo Road run", GigCategory.DELIVERY, 200.0) to Triple(92, 4.5, true),
        Triple("Primary school English tutoring", GigCategory.TUTORING, 400.0) to Triple(99, 5.0, true),
        Triple("Vegetable beds prepared for planting", GigCategory.FARM, 200.0) to Triple(106, 4.0, false),
        Triple("Product photos edited for an online shop", GigCategory.DIGITAL, 380.0) to Triple(112, 4.5, true),
        Triple("Deliver documents to Longacres", GigCategory.DELIVERY, 110.0) to Triple(118, 5.0, true),
        Triple("Post-event cleanup crew", GigCategory.HOME_SERVICES, 350.0) to Triple(119, 4.5, true),
        Triple("Flyers for a hardware shop", GigCategory.DIGITAL, 280.0) to Triple(120, 4.5, true),
        Triple("Grade 8 maths tutoring, 3 sessions", GigCategory.TUTORING, 360.0) to Triple(121, 5.0, true),
        Triple("Deliver groceries to Woodlands", GigCategory.DELIVERY, 140.0) to Triple(122, 5.0, true),
    ).map { (job, meta) ->
        val (title, category, pay) = job
        val (daysAgo, rating, onTime) = meta
        WorkRecordEntry(
            title = title, category = category, city = "Lusaka", payZMW = pay,
            completedAt = Date(System.currentTimeMillis() - daysAgo * 86_400_000L),
            posterRating = rating, onTime = onTime,
            signature = "demo-unsigned", isVerified = true)
    }

    /** Roughly four months of tenure, matching the iOS demo profile. */
    val memberSince: Date = Date(System.currentTimeMillis() - 122L * 86_400_000L)

    /**
     * A believable spread of Lusaka agents, deliberately covering every
     * liquidity state — including "unknown", the most common one in a real
     * market and the easiest to forget to design for.
     */
    val agents: List<MobileMoneyAgent> = run {
        fun liq(reports: List<Triple<AgentReportOutcome, Double?, Double>>) =
            LiquidityService.liquidity(reports.map { (outcome, amount, hoursAgo) ->
                LiquidityService.Report(outcome, amount,
                    Date(System.currentTimeMillis() - (hoursAgo * 3_600_000).toLong()))
            })

        listOf(
            MobileMoneyAgent(
                name = "Kabulonga Quickpay", area = "Kabulonga",
                landmark = "next to Melissa Supermarket",
                latitude = -15.4067, longitude = 28.3419, distanceKm = 0.4,
                isOperatorVerified = true,
                liquidity = liq(listOf(
                    Triple(AgentReportOutcome.CASH_AVAILABLE, 1500.0, 0.3),
                    Triple(AgentReportOutcome.CASH_AVAILABLE, 800.0, 0.9)))),
            MobileMoneyAgent(
                name = "Chibwe Phone Shop", area = "Woodlands",
                landmark = "opposite the filling station",
                latitude = -15.4211, longitude = 28.3188, distanceKm = 1.1,
                isOperatorVerified = false,
                liquidity = liq(listOf(
                    Triple(AgentReportOutcome.CASH_AVAILABLE, 300.0, 0.5)))),
            MobileMoneyAgent(
                name = "Mulungushi Agent Point", area = "Rhodes Park",
                landmark = "inside the arcade",
                latitude = -15.4003, longitude = 28.3077, distanceKm = 1.8,
                isOperatorVerified = true,
                liquidity = liq(listOf(
                    Triple(AgentReportOutcome.NO_CASH, null, 0.4),
                    Triple(AgentReportOutcome.NO_CASH, null, 1.2)))),
            MobileMoneyAgent(
                name = "Cairo Road Money Centre", area = "Cairo Road",
                landmark = "near the post office",
                latitude = -15.4194, longitude = 28.2833, distanceKm = 2.6,
                isOperatorVerified = true,
                liquidity = liq(listOf(
                    Triple(AgentReportOutcome.CASH_AVAILABLE, 2000.0, 0.6),
                    Triple(AgentReportOutcome.NO_CASH, null, 0.8)))),
            MobileMoneyAgent(
                name = "Chelstone Corner Kiosk", area = "Chelstone",
                landmark = "by the market entrance",
                latitude = -15.3644, longitude = 28.3722, distanceKm = 3.4,
                isOperatorVerified = false,
                // Stale on purpose: reads as unknown.
                liquidity = liq(listOf(
                    Triple(AgentReportOutcome.CASH_AVAILABLE, 600.0, 9.0)))),
            MobileMoneyAgent(
                name = "Northmead Agent", area = "Northmead",
                landmark = "next to the pharmacy",
                latitude = -15.3936, longitude = 28.3200, distanceKm = 1.4,
                isOperatorVerified = false,
                liquidity = liq(emptyList())),   // never reported
        )
    }

    /**
     * The salon poster gig is mid-flight with a "before" photo already taken,
     * so the capture flow and the blocked-release state are both demoable.
     */
    val proofPhotos: List<ProofPhoto> = listOf(
        ProofPhoto(gigId = gigs[1].id, kind = ProofKind.BEFORE,
                   capturedAtLabel = "Today 09:12",
                   latitude = -15.3875, longitude = 28.3228),
    )
}
