// VoltexAI mobile — live markets
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { api } from "../api";
import { theme } from "../theme";

const CLASSES = ["all", "forex", "metals", "indices", "crypto", "stocks"];

export default function MarketsScreen() {
  const [assetClass, setAssetClass] = useState("all");
  const [quotes, setQuotes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.quotes(assetClass).then((d) => setQuotes(d.quotes)).catch(() => {});
  }, [assetClass]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <View style={s.screen}>
      <View style={s.tabs}>
        {CLASSES.map((c) => (
          <TouchableOpacity key={c} onPress={() => setAssetClass(c)}
            style={[s.tab, c === assetClass && s.tabActive]}>
            <Text style={[s.tabText, c === assetClass && s.tabTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={quotes}
        keyExtractor={(q) => q.symbol}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.accent}
          onRefresh={() => { setRefreshing(true); load(); setRefreshing(false); }} />}
        renderItem={({ item: q }) => {
          const up = q.change_pct >= 0;
          return (
            <View style={s.row}>
              <View>
                <Text style={s.sym}>{q.symbol}</Text>
                <Text style={s.name}>{q.display}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.price}>{q.price}</Text>
                <Text style={[s.chg, { color: up ? theme.success : theme.danger }]}>
                  {up ? "▲" : "▼"} {Math.abs(q.change_pct).toFixed(2)}%
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  tabs: { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.bgElev },
  tabActive: { backgroundColor: "rgba(194,245,61,0.14)" },
  tabText: { color: theme.dim, textTransform: "capitalize", fontSize: 13 },
  tabTextActive: { color: theme.accent },
  row: { flexDirection: "row", justifyContent: "space-between", padding: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border },
  sym: { color: theme.text, fontWeight: "700", fontSize: 16 },
  name: { color: theme.dim, fontSize: 12 },
  price: { color: theme.text, fontSize: 16, fontVariant: ["tabular-nums"] },
  chg: { fontSize: 13, fontWeight: "600" },
});
