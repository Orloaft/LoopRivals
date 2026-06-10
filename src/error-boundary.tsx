import { Component, type ReactNode } from 'react';

// Last line of defense for render-time crashes (malformed state, asset edge
// cases): without this, one thrown render = permanent blank page. Recovery is
// a reload — server state is authoritative and the session token rejoins the
// room automatically.
export class AppErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error('[loopduel] render crash', error, info?.componentStack ?? '');
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="boot app-crash" role="alert">
        <strong>Something broke on this screen</strong>
        <span>The match is safe on the server — reload to rejoin your room.</span>
        <button className="primary-action" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}
