import Foundation

/// Chat between a gig poster and a worker. Mirrors the `conversations` /
/// `messages` tables in supabase/migrations/0001_init.sql; production
/// clients subscribe to Supabase Realtime `postgres_changes` on `messages`.
struct Conversation: Identifiable, Codable {
    let id: UUID
    var counterpartName: String
    var counterpartRating: Double
    var gigID: UUID?
    var gigTitle: String
    var lastActivity: Date
}

struct ChatMessage: Identifiable, Codable {
    let id: UUID
    var conversationID: UUID
    var isMine: Bool
    var body: String
    var date: Date
}
