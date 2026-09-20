import SwiftUI

/// Nchito brand palette — drawn from the Zambian flag:
/// eagle-green primary, copper accent, with red reserved for urgency.
enum Theme {
    static let green = Color(red: 0.10, green: 0.54, blue: 0.11)   // #198A00-ish
    static let copper = Color(red: 0.94, green: 0.49, blue: 0.05)  // #EF7D00-ish
    static let red = Color(red: 0.87, green: 0.13, blue: 0.06)     // #DE2010-ish
    static let ink = Color.primary
    static let card = Color(.secondarySystemGroupedBackground)
}

struct PillTag: View {
    let text: String
    var color: Color = Theme.green

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.14), in: Capsule())
            .foregroundStyle(color)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var color: Color = Theme.green

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(color, in: RoundedRectangle(cornerRadius: 14))
            .foregroundStyle(.white)
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

struct StatChip: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.headline)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}
