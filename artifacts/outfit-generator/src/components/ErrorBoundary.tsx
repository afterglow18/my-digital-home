import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary.
 * Without this, any unhandled render error unmounts the entire React tree
 * and leaves WKWebView showing a black screen with no diagnostic information.
 * With this, the user sees a recoverable error card and the error is logged.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#f9f4ee",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            gap: 16,
            fontFamily: "sans-serif",
          }}
        >
          <p style={{ fontSize: 40 }}>⚠️</p>
          <p style={{ fontWeight: 900, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 13, color: "rgba(0,0,0,0.5)", textAlign: "center", maxWidth: 280 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 8,
              padding: "12px 28px",
              border: "2px solid black",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13,
              textTransform: "uppercase",
              background: "white",
              cursor: "pointer",
              boxShadow: "3px 3px 0 black",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
