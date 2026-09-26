import React from "react";
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="startup-state">
        <h1>Let’s take a breath.</h1>
        <p>
          Orbit ran into an unexpected problem. Your saved workspace is still on
          this device.
        </p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload Orbit
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
