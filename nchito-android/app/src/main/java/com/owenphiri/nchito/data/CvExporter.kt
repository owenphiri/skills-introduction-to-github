package com.owenphiri.nchito.data

import android.content.Context
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Renders the Work Record as an A4 PDF.
 *
 * This is the point of the whole feature: a cleaner or a rider can walk into a
 * formal job interview holding a document whose every line is backed by a
 * payment that actually cleared, with a link the employer can check themselves.
 *
 * Mirrors the iOS WorkRecordService.exportCV output.
 */
object CvExporter {

    private const val PAGE_WIDTH = 595   // A4 at 72dpi
    private const val PAGE_HEIGHT = 842
    private const val MARGIN = 48f

    /** Returns the written file, or null if it couldn't be saved. */
    fun export(
        context: Context,
        fullName: String,
        city: String,
        phone: String,
        verification: String,
        entries: List<WorkRecordEntry>,
        summary: WorkRecordSummary,
        sharing: WorkRecordSharing?,
    ): File? {
        val document = PdfDocument()
        var page = document.startPage(
            PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, 1).create())
        var canvas = page.canvas
        var y = MARGIN
        var pageNumber = 1

        val title = Paint().apply { textSize = 24f; typeface = Typeface.DEFAULT_BOLD }
        val heading = Paint().apply { textSize = 14f; typeface = Typeface.DEFAULT_BOLD }
        val body = Paint().apply { textSize = 11f }
        val bodyBold = Paint().apply { textSize = 11f; typeface = Typeface.DEFAULT_BOLD }
        val muted = Paint().apply { textSize = 10f; color = 0xFF555555.toInt() }
        val fine = Paint().apply {
            textSize = 9f
            color = 0xFF555555.toInt()
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.ITALIC)
        }
        val rulePaint = Paint().apply { strokeWidth = 0.5f; color = 0xFFCCCCCC.toInt() }

        fun newPageIfNeeded(lineHeight: Float) {
            if (y + lineHeight > PAGE_HEIGHT - MARGIN) {
                document.finishPage(page)
                pageNumber += 1
                page = document.startPage(
                    PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create())
                canvas = page.canvas
                y = MARGIN
            }
        }

        /** Wraps on width so long gig titles don't run off the page. */
        fun draw(text: String, paint: Paint, spacingAfter: Float = 6f) {
            val maxWidth = PAGE_WIDTH - MARGIN * 2
            val lineHeight = paint.textSize * 1.35f
            var remaining = text

            while (remaining.isNotEmpty()) {
                val count = paint.breakText(remaining, true, maxWidth, null)
                var cut = count
                if (cut < remaining.length) {
                    val lastSpace = remaining.lastIndexOf(' ', cut)
                    if (lastSpace > 0) cut = lastSpace
                }
                newPageIfNeeded(lineHeight)
                canvas.drawText(remaining.substring(0, cut).trim(), MARGIN, y + paint.textSize, paint)
                y += lineHeight
                remaining = remaining.substring(cut).trimStart()
            }
            y += spacingAfter
        }

        fun rule() {
            newPageIfNeeded(14f)
            canvas.drawLine(MARGIN, y, PAGE_WIDTH - MARGIN, y, rulePaint)
            y += 14f
        }

        // Header
        draw(fullName, title, 2f)
        draw("$city, Zambia · $phone", muted, 2f)
        draw("Verified work record from Nchito · $verification", muted)
        rule()

        // Standing
        draw("Work summary", heading)
        draw("${summary.totalGigs} jobs completed and paid through escrow", body, 2f)
        draw("${summary.totalEarnedZMW.kwacha()} earned · ${summary.onTimePercent} delivered on time", body, 2f)
        draw("Average client rating ${summary.ratingText} · ${summary.tenureText}", body)
        summary.reliabilityScore?.let {
            draw("Reliability score: $it/100 (${summary.scoreBand})", bodyBold)
        }

        if (summary.topCategories.isNotEmpty()) {
            draw("Main areas of work", heading)
            draw(summary.topCategories.joinToString(" · ") { "${it.first.label} (${it.second})" }, body)
        }
        rule()

        // History
        draw("Completed work", heading)
        val monthYear = SimpleDateFormat("MMM yyyy", Locale.getDefault())
        entries.sortedByDescending { it.completedAt }.forEach { entry ->
            val rating = entry.posterRating?.let { String.format(" · rated %.1f★", it) } ?: ""
            val punctuality = if (entry.onTime) "" else " · delivered late"
            draw("${monthYear.format(entry.completedAt)} — ${entry.title}", body, 1f)
            draw("${entry.category.label}, ${entry.city} · ${entry.payZMW.kwacha()}$rating$punctuality",
                 muted, 8f)
        }

        rule()
        if (sharing != null && sharing.isPublic) {
            draw("Verify this record at ${sharing.shareUrl}", muted, 2f)
        }
        draw("Every entry above was paid through Nchito escrow and is cryptographically " +
             "signed. Nchito cannot alter a record once issued, and neither can the worker.", fine)

        document.finishPage(page)

        // Written into cache/shared/ so a FileProvider can hand it to WhatsApp,
        // Gmail or Drive without exposing the rest of the app's storage.
        return try {
            val dir = File(context.cacheDir, "shared").apply { mkdirs() }
            val safeName = fullName.replace(Regex("[^A-Za-z0-9]+"), "-").trim('-')
            val file = File(dir, "Nchito-Work-Record-$safeName.pdf")
            file.outputStream().use { document.writeTo(it) }
            file
        } catch (e: Exception) {
            null
        } finally {
            document.close()
        }
    }
}
