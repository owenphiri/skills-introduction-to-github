// src/App.jsx
// VoltexAI - Top-level router + AuthProvider wrap.

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Markets from "./pages/Markets";
import Signals from "./pages/Signals";
import PropFirms from "./pages/PropFirms";
import Brokers from "./pages/Brokers";
import AUM from "./pages/AUM";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Forgot from "./pages/Forgot";
import Reset from "./pages/Reset";
import Pricing from "./pages/Pricing";
import Account from "./pages/Account";
import Terminal from "./pages/Terminal";
import Trade from "./pages/Trade";

import "./voltexai.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public marketing + data surfaces */}
          <Route path="/" element={<Landing />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/prop-firms" element={<PropFirms />} />
          <Route path="/brokers" element={<Brokers />} />
          <Route path="/aum" element={<AUM />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* Protected */}
          <Route
            path="/terminal"
            element={
              <ProtectedRoute>
                <Terminal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trade"
            element={
              <ProtectedRoute>
                <Trade />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
