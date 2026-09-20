import Foundation

/// Thin PostgREST + RPC + Storage client over URLSession.
///
/// Deliberately dependency-free, matching the rest of the app. It is a
/// transport, not a data layer: it knows how to talk to Supabase and nothing
/// about gigs or wallets — that lives in `LiveRepository`.
///
/// The caller's access token is sent on every request, so Row Level Security
/// applies exactly as it does in the SQL. Without it PostgREST would fall back
/// to the anon role and quietly return nothing.
actor NchitoAPI {

    enum APIError: LocalizedError {
        case notConfigured
        case notSignedIn
        case http(status: Int, message: String)
        case decoding(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured:
                return "Supabase isn't configured yet."
            case .notSignedIn:
                return "Please sign in again."
            case .http(let status, let message):
                // 401/403 nearly always means the token expired or RLS refused,
                // which the user can act on; other codes they cannot.
                if status == 401 || status == 403 { return "Your session has expired. Please sign in again." }
                return message.isEmpty ? "Server error (\(status))." : message
            case .decoding(let detail):
                return "Unexpected response from the server. \(detail)"
            }
        }
    }

    private var accessToken: String = ""

    func setAccessToken(_ token: String) { accessToken = token }

    // MARK: - Requests

    /// A PostgREST table read. `query` is appended verbatim, e.g.
    /// "select=*&status=eq.open&order=created_at.desc&limit=20".
    func get<T: Decodable>(_ table: String, query: String, as: T.Type = T.self) async throws -> T {
        try await send(path: "/rest/v1/\(table)?\(query)", method: "GET", body: nil)
    }

    @discardableResult
    func insert<T: Decodable>(_ table: String, body: Encodable, as: T.Type = T.self) async throws -> T {
        try await send(path: "/rest/v1/\(table)", method: "POST",
                       body: try JSONEncoder.nchito.encode(AnyEncodable(body)),
                       prefer: "return=representation")
    }

    /// Updates rows in place. Used only for fields a user is allowed to change
    /// on their own row — their language, their chilimba auto-contribute
    /// setting — where row level security is the whole rule and there is no
    /// function's worth of logic to enforce.
    @discardableResult
    func update<T: Decodable>(_ table: String, query: String, body: Encodable,
                              as: T.Type = T.self) async throws -> T {
        try await send(path: "/rest/v1/\(table)?\(query)", method: "PATCH",
                       body: try JSONEncoder.nchito.encode(AnyEncodable(body)),
                       prefer: "return=representation")
    }

    /// Calls a Postgres function. Most of Nchito's writes go through these
    /// rather than direct table writes, because the rules (commission tiers,
    /// proof gates, PIN checks) live in the functions.
    @discardableResult
    func rpc<T: Decodable>(_ function: String, args: [String: Encodable] = [:],
                           as: T.Type = T.self) async throws -> T {
        let encoded = args.mapValues(AnyEncodable.init)
        return try await send(path: "/rest/v1/rpc/\(function)", method: "POST",
                              body: try JSONEncoder.nchito.encode(encoded))
    }

    /// Uploads bytes to a Storage bucket and returns the object path.
    func upload(bucket: String, path: String, data: Data, contentType: String) async throws -> String {
        _ = try await sendRaw(path: "/storage/v1/object/\(bucket)/\(path)",
                              method: "POST", body: data, contentType: contentType)
        return path
    }

    // MARK: - Plumbing

    private func send<T: Decodable>(path: String, method: String,
                                    body: Data?, prefer: String? = nil) async throws -> T {
        let data = try await sendRaw(path: path, method: method, body: body,
                                     contentType: "application/json", prefer: prefer)

        // Functions returning void or a bare scalar can come back empty.
        if data.isEmpty, let empty = EmptyResponse() as? T { return empty }

        do {
            return try JSONDecoder.nchito.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    private func sendRaw(path: String, method: String, body: Data?,
                         contentType: String, prefer: String? = nil) async throws -> Data {
        guard SupabaseConfig.isConfigured,
              let url = URL(string: SupabaseConfig.projectURL + path) else {
            throw APIError.notConfigured
        }
        guard !accessToken.isEmpty else { throw APIError.notSignedIn }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        if let prefer { request.setValue(prefer, forHTTPHeaderField: "Prefer") }
        // Zambian mobile data can be slow; fail in a human timeframe rather than
        // leaving a spinner up for a minute.
        request.timeoutInterval = 20

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.http(status: -1, message: "No response")
        }
        guard (200..<300).contains(http.statusCode) else {
            // PostgREST reports problems as {"message": "...", "hint": "..."}.
            struct ServerError: Decodable { let message: String? }
            let parsed = try? JSONDecoder().decode(ServerError.self, from: data)
            throw APIError.http(status: http.statusCode, message: parsed?.message ?? "")
        }
        return data
    }
}

/// Lets a heterogeneous dictionary of arguments be encoded.
struct AnyEncodable: Encodable {
    private let encodeTo: (Encoder) throws -> Void
    init(_ wrapped: Encodable) { encodeTo = wrapped.encode }
    func encode(to encoder: Encoder) throws { try encodeTo(encoder) }
}

/// Stands in for a response body that carries nothing.
struct EmptyResponse: Codable {}
