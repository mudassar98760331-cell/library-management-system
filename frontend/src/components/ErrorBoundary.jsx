import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state" style={{ padding: "60px 20px" }}>
          <h3>Something went wrong</h3>
          <p style={{ margin: "8px 0 16px", color: "var(--text)" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
