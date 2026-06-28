// VoltexAI mobile — root app with bottom-tab navigation
import React from "react";
import { Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { theme } from "./src/theme";
import MarketsScreen from "./src/screens/MarketsScreen";
import SignalsScreen from "./src/screens/SignalsScreen";
import TerminalScreen from "./src/screens/TerminalScreen";
import MoreScreen from "./src/screens/MoreScreen";

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.bg,
    card: theme.bgElev,
    text: theme.text,
    border: theme.border,
    primary: theme.accent,
  },
};

const ICONS = { Markets: "📈", Signals: "⚡", "AI Terminal": "🧠", More: "⋯" };

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: theme.bgElev },
          headerTitleStyle: { color: theme.text, fontWeight: "700" },
          headerTintColor: theme.accent,
          tabBarStyle: { backgroundColor: theme.bgElev, borderTopColor: theme.border },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.dim,
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18, color }}>{ICONS[route.name]}</Text>
          ),
        })}
      >
        <Tab.Screen name="Markets" component={MarketsScreen} />
        <Tab.Screen name="Signals" component={SignalsScreen} />
        <Tab.Screen name="AI Terminal" component={TerminalScreen} />
        <Tab.Screen name="More" component={MoreScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
