// VoltexAI mobile — More: AUM snapshot, prop firms, Africa-friendly brokers
import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity } from "react-native";
import { api } from "../api";
import { theme } from "../theme";

export default function MoreScreen() {
  const [fund, setFund] = useState(null);
  const [firms, setFirms] = useState([]);
  const [brokers, setBrokers] = useState([]);

  useEffect(() => {
    api.fund().then(setFund).catch(() => {});
    api.propFirms().then((d) => setFirms(d.firms.slice(0, 5))).catch(() => {});
    api.brokers().then((d) => setBrokers(d.brokers.slice(0, 5))).catch(() => {});
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h1}>VoltexAI Managed Alpha</Text>
      {fund && (
        <View style={s.statRow}>
          <Stat v={`$${(fund.overview.aum_usd / 1e6).toFixed(1)}M`} l="AUM" />
          <Stat v={`+${fund.cumulative_return_pct}%`} l="Cumulative" />
          <Stat v={fund.overview.investors} l="Investors" />
        </View>
      )}

      <Text style={s.h2}>Top Prop Firms</Text>
      {firms.map((f) => (
        <Card key={f.id} title={f.name} sub={`${f.profit_split} split · ${f.model}`}
          rating={f.rating} url={f.url} />
      ))}

      <Text style={s.h2}>Africa-Friendly Brokers</Text>
      {brokers.map((b) => (
        <Card key={b.id} title={b.name} sub={`Min $${b.min_deposit_usd} · ${b.regulators.join(", ")}`}
          rating={b.rating} url={b.url} />
      ))}

      <Text style={s.footer}>
        VoltexAI by PrimeAxis ICT Trade & Solutions Ltd. Methodology by Owens Forex Academy.
        Trading carries a high risk of loss; not financial advice.
      </Text>
    </ScrollView>
  );
}

function Stat({ v, l }) {
  return (
    <View style={s.stat}>
      <Text style={s.statV}>{v}</Text>
      <Text style={s.statL}>{l}</Text>
    </View>
  );
}

function Card({ title, sub, rating, url }) {
  return (
    <TouchableOpacity style={s.card} onPress={() => url && Linking.openURL(url)}>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={s.cardSub}>{sub}</Text>
      </View>
      <Text style={s.rating}>★ {rating}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  h1: { color: theme.text, fontSize: 22, fontWeight: "800" },
  h2: { color: theme.text, fontSize: 17, fontWeight: "700", marginTop: 22, marginBottom: 10 },
  statRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  stat: { flex: 1, backgroundColor: theme.card, borderRadius: 12, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: theme.border },
  statV: { color: theme.accent, fontSize: 20, fontWeight: "800" },
  statL: { color: theme.dim, fontSize: 11, marginTop: 2 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: theme.card,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
  cardTitle: { color: theme.text, fontWeight: "700", fontSize: 15 },
  cardSub: { color: theme.dim, fontSize: 12, marginTop: 2 },
  rating: { color: theme.accent, fontWeight: "700" },
  footer: { color: theme.dim, fontSize: 11, lineHeight: 17, marginTop: 26, marginBottom: 40 },
});
