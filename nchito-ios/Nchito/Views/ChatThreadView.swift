import SwiftUI

struct ChatThreadView: View {
    @EnvironmentObject private var state: AppState
    let conversation: Conversation
    @State private var draft = ""
    @FocusState private var inputFocused: Bool

    private var thread: [ChatMessage] { state.messages(in: conversation) }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 10) {
                    gigContextCard
                    ForEach(thread) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .onChange(of: thread.count) {
                if let lastID = thread.last?.id {
                    withAnimation { proxy.scrollTo(lastID, anchor: .bottom) }
                }
            }
            .onAppear {
                if let lastID = thread.last?.id {
                    proxy.scrollTo(lastID, anchor: .bottom)
                }
            }
        }
        .navigationTitle(conversation.counterpartName)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) { inputBar }
    }

    private var gigContextCard: some View {
        HStack(spacing: 8) {
            Image(systemName: "briefcase.fill")
                .foregroundStyle(Theme.copper)
            Text(conversation.gigTitle)
                .font(.caption.weight(.medium))
                .lineLimit(2)
            Spacer()
            Label(String(format: "%.1f", conversation.counterpartRating), systemImage: "star.fill")
                .font(.caption2)
                .foregroundStyle(Theme.copper)
        }
        .padding(10)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("Message…", text: $draft, axis: .vertical)
                .lineLimit(1...4)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
                .focused($inputFocused)
            Button {
                state.send(draft, in: conversation)
                draft = ""
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                     ? .gray : Theme.green)
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.thinMaterial)
    }
}

private struct MessageBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.isMine { Spacer(minLength: 48) }
            VStack(alignment: message.isMine ? .trailing : .leading, spacing: 3) {
                Text(message.body)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(message.isMine ? Theme.green : Theme.card,
                                in: RoundedRectangle(cornerRadius: 18))
                    .foregroundStyle(message.isMine ? .white : Theme.ink)
                Text(message.date, format: .dateTime.hour().minute())
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            if !message.isMine { Spacer(minLength: 48) }
        }
    }
}

#Preview {
    NavigationStack {
        ChatThreadView(conversation: MockDataService.conversations[0])
    }
    .environmentObject(AppState())
}
