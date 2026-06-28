// VoltexAI mobile — AI Terminal (Claude chat). Shows login when signed out.
import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { api, tokens } from "../api";
import { theme } from "../theme";

const MODES = ["terminal", "analysis", "signals", "academy"];

export default function TerminalScreen() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setChecking(false));
  }, []);

  if (checking) return <Centered><ActivityIndicator color={theme.accent} /></Centered>;
  if (!user) return <AuthForm onAuthed={setUser} />;
  return <Chat user={user} onSignOut={async () => { await tokens.clear(); setUser(null); }} />;
}

function Chat({ user, onSignOut }) {
  const [mode, setMode] = useState("terminal");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convo, setConvo] = useState(null);
  const listRef = useRef(null);

  async function send() {
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const r = await api.chat(text, mode, convo);
      setConvo(r.conversation_id);
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 80);
    }
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.modes}>
        {MODES.map((m) => (
          <TouchableOpacity key={m} onPress={() => { setMode(m); setMessages([]); setConvo(null); }}
            style={[s.modeTab, m === mode && s.modeActive]}>
            <Text style={[s.modeText, m === mode && s.modeTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        ListEmptyComponent={
          <Text style={s.hint}>Hi {user.full_name?.split(" ")[0] || "trader"} — ask for analysis,
            a signal, or an ICT/SMC lesson. e.g. "Run analysis on XAUUSD H1".</Text>
        }
        renderItem={({ item: m }) => (
          <View style={[s.bubble, m.role === "user" ? s.bubbleUser : s.bubbleAI]}>
            <Text style={s.bubbleText}>{m.content}</Text>
          </View>
        )}
      />
      {busy && <ActivityIndicator color={theme.accent} style={{ marginBottom: 6 }} />}
      <View style={s.composer}>
        <TextInput style={s.input} value={input} onChangeText={setInput}
          placeholder="Message VoltexAI…" placeholderTextColor={theme.dim} multiline />
        <TouchableOpacity style={s.sendBtn} onPress={send} disabled={busy}>
          <Text style={s.sendText}>↑</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onSignOut}><Text style={s.signout}>Sign out</Text></TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

function AuthForm({ onAuthed }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(""); setBusy(true);
    try {
      const r = isLogin
        ? await api.login(email, password)
        : await api.register({ email, password, full_name: name });
      await tokens.set(r.access_token, r.refresh_token);
      const me = await api.me();
      onAuthed(me);
    } catch (e) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Centered>
      <Text style={s.brand}>⚡ VoltexAI</Text>
      <Text style={s.authSub}>{isLogin ? "Welcome back." : "Create your free account."}</Text>
      {!isLogin && (
        <TextInput style={s.authInput} placeholder="Full name" placeholderTextColor={theme.dim}
          value={name} onChangeText={setName} />
      )}
      <TextInput style={s.authInput} placeholder="Email" placeholderTextColor={theme.dim}
        autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.authInput} placeholder="Password" placeholderTextColor={theme.dim}
        secureTextEntry value={password} onChangeText={setPassword} />
      {err ? <Text style={s.err}>{err}</Text> : null}
      <TouchableOpacity style={s.primaryBtn} onPress={submit} disabled={busy}>
        <Text style={s.primaryText}>{busy ? "…" : isLogin ? "Log in" : "Sign up"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
        <Text style={s.switch}>{isLogin ? "Need an account? Sign up" : "Have an account? Log in"}</Text>
      </TouchableOpacity>
    </Centered>
  );
}

function Centered({ children }) {
  return <View style={[s.screen, { justifyContent: "center", padding: 24 }]}>{children}</View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  modes: { flexDirection: "row", padding: 8, gap: 6 },
  modeTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.bgElev },
  modeActive: { backgroundColor: "rgba(194,245,61,0.14)" },
  modeText: { color: theme.dim, textTransform: "capitalize", fontSize: 13 },
  modeTextActive: { color: theme.accent },
  hint: { color: theme.dim, padding: 16, lineHeight: 20 },
  bubble: { maxWidth: "85%", borderRadius: 14, padding: 12 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: theme.primary },
  bubbleAI: { alignSelf: "flex-start", backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  bubbleText: { color: theme.text, lineHeight: 20 },
  composer: { flexDirection: "row", padding: 10, gap: 8, alignItems: "flex-end" },
  input: { flex: 1, backgroundColor: theme.bgElev, borderRadius: 12, color: theme.text,
    paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120, borderWidth: 1, borderColor: theme.border },
  sendBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.accent,
    alignItems: "center", justifyContent: "center" },
  sendText: { color: theme.bg, fontSize: 22, fontWeight: "800" },
  signout: { color: theme.dim, textAlign: "center", paddingBottom: 10 },
  brand: { color: theme.accent, fontSize: 30, fontWeight: "800", textAlign: "center" },
  authSub: { color: theme.dim, textAlign: "center", marginVertical: 14 },
  authInput: { backgroundColor: theme.bgElev, borderRadius: 12, color: theme.text,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  err: { color: theme.danger, marginBottom: 8, textAlign: "center" },
  primaryBtn: { backgroundColor: theme.accent, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4 },
  primaryText: { color: theme.bg, fontWeight: "800", fontSize: 16 },
  switch: { color: theme.accent, textAlign: "center", marginTop: 14 },
});
