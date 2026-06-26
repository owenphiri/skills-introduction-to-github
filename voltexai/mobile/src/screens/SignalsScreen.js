// VoltexAI mobile — algorithmic signal scanner
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { api } from "../api";
import { theme } from "../theme";

const TFS = ["M15", "M30", "H1", "H4"];

export default function SignalsScreen() {
  const [timeframe, setTimeframe] = useState("M15");
  const [signals, setSignals] = useState([]);

  const load = useCallback(() => {
    api.signals("all", timeframe, 4).then((d) => setSignals(d.signals)).catch(() => {});
  }, [timeframe]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <View style={s.screen}>
      <View style={s.tabs}>
        {TFS.map((tf) => (
          <TouchableOpacity key={tf} onPress={() => setTimeframe(tf)}
            style={[s.tab, tf === timeframe && s.tabActive]}>
            <Text style={[s.tabText, tf === timeframe && s.tabTextActive]}>{tf}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {signals.length === 0 && (
        <Text style={s.empty}>No high-confluence setups right now — check back next session.</Text>
      )}
      <FlatList
        data={signals}
        keyExtractor={(x) => `${x.symbol}-${x.timeframe}`}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        renderItem={({ item: sig }) => {
          const long = sig.direction === "LONG";
          const col = long ? theme.success : theme.danger;
          return (
            <View style={[s.card, { borderLeftColor: col }]}>
              <View style={s.cardTop}>
                <Text style={s.sym}>{sig.symbol}</Text>
                <View style={[s.pill, { backgroundColor: long ? "rgba(69,224,160,0.14)" : "rgba(255,85,96,0.14)" }]}>
                  <Text style={{ color: col, fontWeight: "700", fontSize: 12 }}>{sig.direction}</Text>
                </View>
              </View>
              <View style={s.confBar}>
                <View style={[s.confFill, { width: `${sig.confidence * 10}%` }]} />
              </View>
              <Text style={s.conf}>Confidence {sig.confidence}/10 · R:R {sig.risk_reward_tp3}</Text>
              <View style={s.levels}>
                <Lvl label="Entry" v={sig.entry} />
                <Lvl label="Stop" v={sig.stop_loss} color={theme.danger} />
                <Lvl label="TP1" v={sig.tp1} color={theme.success} />
                <Lvl label="TP3" v={sig.tp3} color={theme.success} />
              </View>
              <Text style={s.session}>{sig.session} · RSI {sig.indicators?.rsi14}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

function Lvl({ label, v, color }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ color: theme.dim, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: color || theme.text, fontWeight: "600" }}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  tabs: { flexDirection: "row", padding: 8, gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.bgElev },
  tabActive: { backgroundColor: "rgba(194,245,61,0.14)" },
  tabText: { color: theme.dim, fontSize: 13 },
  tabTextActive: { color: theme.accent },
  empty: { color: theme.dim, textAlign: "center", margin: 24 },
  card: { backgroundColor: theme.card, borderRadius: 14, borderLeftWidth: 4, padding: 16,
    borderWidth: 1, borderColor: theme.border },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sym: { color: theme.text, fontSize: 18, fontWeight: "700" },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  confBar: { height: 8, backgroundColor: theme.bgElev, borderRadius: 20, marginTop: 12, overflow: "hidden" },
  confFill: { height: "100%", backgroundColor: theme.accent },
  conf: { color: theme.dim, fontSize: 12, marginTop: 6 },
  levels: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  session: { color: theme.dim, fontSize: 12, marginTop: 12 },
});
