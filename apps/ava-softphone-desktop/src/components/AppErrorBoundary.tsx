import React from 'react';

interface State { hasError: boolean; error: string }

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] crash caught:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', padding: 24, gap: 12,
        background: 'linear-gradient(180deg, #0a0b12, #11131c)', color: '#f5f7fb',
        fontFamily: 'Inter, -apple-system, sans-serif', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</div>
        <div style={{ fontSize: 13, opacity: 0.7, maxWidth: 360 }}>{this.state.error}</div>
        <button
          onClick={() => {
            this.setState({ hasError: false, error: '' });
            window.location.reload();
          }}
          style={{
            background: '#003DA6', border: 'none', borderRadius: 10, color: 'white',
            padding: '10px 24px', cursor: 'pointer', fontSize: 14, marginTop: 8,
          }}
        >
          🔄 Reload App
        </button>
      </div>
    );
  }
}
