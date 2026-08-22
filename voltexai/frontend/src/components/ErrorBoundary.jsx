// src/components/ErrorBoundary.jsx — catches render errors so one bad screen
// never takes down the whole app.
import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production, forward to your error tracker (Sentry, etc.).
    console.error("VoltexAI UI error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="vx-auth-page">
        <div className="vx-auth-card vx-center">
          <div className="vx-logo" style={{ marginBottom: 12 }}>
            <span className="vx-logo-mark">⚡</span> Voltex<span className="vx-logo-ai">AI</span>
          </div>
          <h2>Something went wrong</h2>
          <p className="vx-muted">
            A part of the app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button className="vx-btn-primary vx-btn-block" style={{ marginTop: 16 }}
            onClick={() => window.location.assign("/")}>
            Reload VoltexAI
          </button>
        </div>
      </div>
    );
  }
}
