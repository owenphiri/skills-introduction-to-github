import UIKit

/// Aggregates Work Record entries and renders the CV export.
///
/// The CV is the point of the whole feature: a domestic cleaner or a rider can
/// walk into a formal job interview holding a document whose every line is
/// backed by a payment that actually cleared, with a link the employer can
/// check themselves.
enum WorkRecordService {

    // MARK: - Summary

    static func summary(for entries: [WorkRecordEntry], memberSince: Date) -> WorkRecordSummary {
        let ratings = entries.compactMap(\.posterRating)
        let counts = Dictionary(grouping: entries, by: \.category)
            .map { (category: $0.key, count: $0.value.count) }
            .sorted { $0.count > $1.count }

        return WorkRecordSummary(
            totalGigs: entries.count,
            totalEarnedZMW: entries.reduce(0) { $0 + $1.payZMW },
            onTimeRate: entries.isEmpty
                ? nil
                : Double(entries.filter(\.onTime).count) / Double(entries.count),
            averageRating: ratings.isEmpty
                ? nil
                : ratings.reduce(0, +) / Double(ratings.count),
            memberSince: memberSince,
            topCategories: Array(counts.prefix(4))
        )
    }

    // MARK: - CV export

    /// Renders an A4 PDF and returns its file URL, ready for the share sheet.
    /// Returns nil only if the file can't be written.
    static func exportCV(user: UserProfile,
                         entries: [WorkRecordEntry],
                         summary: WorkRecordSummary,
                         sharing: WorkRecordSharing?) -> URL? {

        let pageSize = CGRect(x: 0, y: 0, width: 595, height: 842)   // A4 at 72dpi
        let margin: CGFloat = 48
        let contentWidth = pageSize.width - margin * 2

        let renderer = UIGraphicsPDFRenderer(bounds: pageSize)
        let data = renderer.pdfData { context in
            context.beginPage()
            var y: CGFloat = margin

            func draw(_ text: String, font: UIFont, color: UIColor = .black,
                      spacingAfter: CGFloat = 6) {
                let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
                let bounding = (text as NSString).boundingRect(
                    with: CGSize(width: contentWidth, height: .greatestFiniteMagnitude),
                    options: [.usesLineFragmentOrigin, .usesFontLeading],
                    attributes: attributes, context: nil)

                // Start a new page rather than letting content run off the bottom.
                if y + bounding.height > pageSize.height - margin {
                    context.beginPage()
                    y = margin
                }
                (text as NSString).draw(
                    with: CGRect(x: margin, y: y, width: contentWidth, height: bounding.height),
                    options: [.usesLineFragmentOrigin, .usesFontLeading],
                    attributes: attributes, context: nil)
                y += bounding.height + spacingAfter
            }

            func rule() {
                if let cg = UIGraphicsGetCurrentContext() {
                    cg.setStrokeColor(UIColor.separator.cgColor)
                    cg.setLineWidth(0.5)
                    cg.move(to: CGPoint(x: margin, y: y))
                    cg.addLine(to: CGPoint(x: pageSize.width - margin, y: y))
                    cg.strokePath()
                }
                y += 14
            }

            // Header
            draw(user.fullName, font: .boldSystemFont(ofSize: 24), spacingAfter: 2)
            draw("\(user.city), Zambia · \(user.phone)",
                 font: .systemFont(ofSize: 11), color: .darkGray, spacingAfter: 2)
            draw("Verified work record from Nchito · \(user.verification.rawValue)",
                 font: .systemFont(ofSize: 11), color: .darkGray)
            rule()

            // Standing
            draw("Work summary", font: .boldSystemFont(ofSize: 14))
            draw("""
                 \(summary.totalGigs) jobs completed and paid through escrow
                 \(summary.totalEarnedZMW.kwacha) earned · \(summary.onTimePercent) delivered on time
                 Average client rating \(summary.ratingText) · \(summary.tenureText)
                 """,
                 font: .systemFont(ofSize: 11), spacingAfter: 10)

            if let score = summary.reliabilityScore {
                draw("Reliability score: \(score)/100 (\(summary.scoreBand))",
                     font: .boldSystemFont(ofSize: 11), spacingAfter: 10)
            }

            if !summary.topCategories.isEmpty {
                let skills = summary.topCategories
                    .map { "\($0.category.rawValue) (\($0.count))" }
                    .joined(separator: " · ")
                draw("Main areas of work", font: .boldSystemFont(ofSize: 14))
                draw(skills, font: .systemFont(ofSize: 11), spacingAfter: 10)
            }
            rule()

            // History
            draw("Completed work", font: .boldSystemFont(ofSize: 14))
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM yyyy"

            for entry in entries.sorted(by: { $0.completedAt > $1.completedAt }) {
                let date = formatter.string(from: entry.completedAt)
                let rating = entry.posterRating.map { String(format: " · rated %.1f★", $0) } ?? ""
                let punctuality = entry.onTime ? "" : " · delivered late"
                draw("\(date) — \(entry.title)",
                     font: .systemFont(ofSize: 11, weight: .medium), spacingAfter: 1)
                draw("\(entry.category.rawValue), \(entry.city) · \(entry.payZMW.kwacha)\(rating)\(punctuality)",
                     font: .systemFont(ofSize: 10), color: .darkGray, spacingAfter: 8)
            }

            rule()
            if let sharing, sharing.isPublic {
                draw("Verify this record at \(sharing.shareURL)",
                     font: .systemFont(ofSize: 10), color: .darkGray, spacingAfter: 2)
            }
            draw("Every entry above was paid through Nchito escrow and is cryptographically signed. Nchito cannot alter a record once issued, and neither can the worker.",
                 font: .italicSystemFont(ofSize: 9), color: .darkGray)
        }

        let safeName = user.fullName
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "-")
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("Nchito-Work-Record-\(safeName).pdf")

        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }
}
