// src/App.jsx
// VoltexAI - Top-level router + AuthProvider wrap.

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SocialProof } from "./components/SocialProof";
import { SocialRail } from "./components/Social";

import Landing from "./pages/Landing";
import Markets from "./pages/Markets";
import Signals from "./pages/Signals";
import PropFirms from "./pages/PropFirms";
import Brokers from "./pages/Brokers";
import AUM from "./pages/AUM";
import Products from "./pages/Products";
import Academy from "./pages/Academy";
import Scanner from "./pages/Scanner";
import Competition from "./pages/Competition";
import Store from "./pages/Store";
import Pay from "./pages/Pay";
import Vision from "./pages/Vision";
import Success from "./pages/Success";
import Sentiment from "./pages/Sentiment";
import Live from "./pages/Live";
import Resources from "./pages/Resources";
import Community from "./pages/Community";
import Travel from "./pages/Travel";
import Dashboard from "./pages/Dashboard";
import Sitemap from "./pages/Sitemap";
import About from "./pages/About";
import Careers from "./pages/Careers";
import CSR from "./pages/CSR";
import Foundation from "./pages/Foundation";
import Press from "./pages/Press";
import TV from "./pages/TV";
import Media from "./pages/Media";
import Podcast from "./pages/Podcast";
import Blog from "./pages/Blog";
import Offers from "./pages/Offers";
import Awards from "./pages/Awards";
import FAQ from "./pages/FAQ";
import Journal from "./pages/Journal";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Forgot from "./pages/Forgot";
import Reset from "./pages/Reset";
import Pricing from "./pages/Pricing";
import Account from "./pages/Account";
import Terminal from "./pages/Terminal";
import Trade from "./pages/Trade";
import Reconciliation from "./pages/Reconciliation";
import Verify from "./pages/Verify";
import Kyc from "./pages/Kyc";

import "./voltexai.css";

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
        <SocialProof />
        <SocialRail />
        <Routes>
          {/* Public marketing + data surfaces */}
          <Route path="/" element={<Landing />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/prop-firms" element={<PropFirms />} />
          <Route path="/brokers" element={<Brokers />} />
          <Route path="/aum" element={<AUM />} />
          <Route path="/products" element={<Products />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/competition" element={<Competition />} />
          <Route path="/store" element={<Store />} />
          <Route path="/pay" element={<Pay />} />
          <Route path="/vision" element={<Vision />} />
          <Route path="/success" element={<Success />} />
          <Route path="/sentiment" element={<Sentiment />} />
          <Route path="/live" element={<Live />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/community" element={<Community />} />
          <Route path="/travel" element={<Travel />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Company & media */}
          <Route path="/sitemap" element={<Sitemap />} />
          <Route path="/about" element={<About />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/csr" element={<CSR />} />
          <Route path="/foundation" element={<Foundation />} />
          <Route path="/press" element={<Press />} />
          <Route path="/tv" element={<TV />} />
          <Route path="/media" element={<Media />} />
          <Route path="/podcast" element={<Podcast />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/awards" element={<Awards />} />
          <Route path="/faq" element={<FAQ />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/verify" element={<Verify />} />
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
            path="/journal"
            element={
              <ProtectedRoute>
                <Journal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reconciliation"
            element={
              <ProtectedRoute>
                <Reconciliation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kyc"
            element={
              <ProtectedRoute>
                <Kyc />
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
    </ErrorBoundary>
  );
}
