import SwiftUI

struct ChatListView: View {
    @EnvironmentObject private var state: AppState

    private var sorted: [Conversation] {
        state.conversations.sorted { $0.lastActivity > $1.lastActivity }
    }

    var body: some View {
        NavigationStack {
            Group {
                if sorted.isEmpty {
                    ContentUnavailableView("No chats yet",
                                           systemImage: "bubble.left.and.bubble.right",
                                           description: Text("Apply for a gig or message a poster to start a conversation."))
                } else {
                    List(sorted) { convo in
                        NavigationLink {
                            ChatThreadView(conversation: convo)
                        } label: {
                            ChatRow(conversation: convo,
                                    lastMessage: state.messages(in: convo).last)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Chats")
        }
    }
}

private struct ChatRow: View {
    let conversation: Conversation
    let lastMessage: ChatMessage?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 40))
                .foregroundStyle(Theme.green.opacity(0.7))
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(conversation.counterpartName)
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text(conversation.lastActivity, format: .relative(presentation: .named))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Text(conversation.gigTitle)
                    .font(.caption2)
                    .foregroundStyle(Theme.copper)
                    .lineLimit(1)
                if let last = lastMessage {
                    Text((last.isMine ? "You: " : "") + last.body)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    ChatListView().environmentObject(AppState())
}
