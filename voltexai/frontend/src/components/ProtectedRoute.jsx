// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute({ children, requirePlan = null }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="vx-loader">
        <div className="vx-pulse" />
        <p>Connecting to VoltexAI…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requirePlan && !requirePlan.includes(user.plan)) {
    return <Navigate to="/pricing?reason=upgrade" replace />;
  }

  return children;
}
