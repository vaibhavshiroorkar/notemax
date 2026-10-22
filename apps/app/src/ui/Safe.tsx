import { Component, type ReactNode } from "react";

/**
 * Wraps what a plugin draws. If it throws while drawing, only its own spot
 * shows a short note and the rest of the app keeps working. Without this, one
 * broken community plugin would blank the whole window.
 */
export class Safe extends Component<{ name: string; children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    console.warn(`"${this.props.name}" stopped working:`, error);
  }

  render() {
    if (this.state.error === null) return this.props.children;
    return (
      <p className="safe-error" role="status">
        {this.props.name} stopped working: {this.state.error}
      </p>
    );
  }
}
