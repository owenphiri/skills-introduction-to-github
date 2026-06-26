// src/pages/Terminal.jsx
import { useEffect, useRef, useState } from "react";
import { aiService } from "../services/ai";
import { useAuth } from "../contexts/AuthContext";

const MODES = [
  { id: "terminal", label: "Terminal", desc: "Free-form trading assistant" },
  { id: "analysis", label: "Analysis", desc: "Structured technical breakdown" },
  { id: "signals",  label: "Signals",  desc: "JSON trade signals" },
  { id: "academy",  label: "Academy",  desc: "Learn ICT/SMC concepts" },
];

export default function Terminal() {
  const { user } = useAuth();
  const [mode, setMode] = useState("terminal");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [quota, setQuota] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { aiService.quota().then(setQuota).catch(() => {}); }, [messages.length]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(e) {
    e?.preventDefault?.();
    if (!input.trim() || streaming) return;
    const userMsg = { role: "user", content: input };
    const assistantMsg = { role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    const sent = input;
    setInput("");
    setStreaming(true);

    await aiService.stream(
      { message: sent, mode, conversation_id: conversationId },
      {
        onDelta: (chunk) => {
          setMessages((m) => {
            const last = m[m.length - 1];
            return [...m.slice(0, -1), { ...last, content: last.content + chunk }];
          });
        },
        onDone: () => setStreaming(false),
        onError: (err) => {
          setMessages((m) => {
            const last = m[m.length - 1];
            return [...m.slice(0, -1),
              { ...last, content: last.content || `Error: ${err.message}` }];
          });
          setStreaming(false);
        },
      }
    );

    // refresh quota after the call
    aiService.quota().then(setQuota).catch(() => {});
  }

  return (
    <div className="vx-terminal">
      <aside className="vx-terminal-sidebar">
        <h2>Mode</h2>
        <ul className="vx-mode-list">
          {MODES.map((m) => (
            <li key={m.id}>
              <button
                className={`vx-mode-item ${mode === m.id ? "active" : ""}`}
                onClick={() => { setMode(m.id); setMessages([]); setConversationId(null); }}
              >
                <strong>{m.label}</strong>
                <span>{m.desc}</span>
              </button>
            </li>
          ))}
        </ul>

        {quota && (
          <div className="vx-quota">
            <p>Daily AI quota</p>
            <progress value={quota.used} max={quota.limit}></progress>
            <small>{quota.used} / {quota.limit} used</small>
          </div>
        )}
      </aside>

      <main className="vx-terminal-main">
        <header className="vx-terminal-head">
          <h1>VoltexAI · {MODES.find((m) => m.id === mode).label}</h1>
          <span className="vx-tag">Hi, {user?.full_name?.split(" ")[0] || "trader"}</span>
        </header>

        <div className="vx-chat">
          {messages.length === 0 && (
            <div className="vx-chat-empty">
              <p>Ask anything. Try:</p>
              <ul>
                <li>"Run analysis on XAUUSD H1"</li>
                <li>"Give me a signal for NAS100 M15"</li>
                <li>"Explain Judas swing with an example"</li>
              </ul>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`vx-msg vx-msg--${m.role}`}>
              <div className="vx-msg-content">{m.content || (streaming && i === messages.length - 1 ? "…" : "")}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="vx-composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Type a message · Shift+Enter for newline"
            rows={2}
            disabled={streaming}
          />
          <button type="submit" disabled={streaming || !input.trim()} className="vx-btn-primary">
            {streaming ? "…" : "Send"}
          </button>
        </form>
      </main>
    </div>
  );
}
