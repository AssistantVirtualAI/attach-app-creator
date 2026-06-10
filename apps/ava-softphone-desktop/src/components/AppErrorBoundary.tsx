import React from 'react';

interface State { hasError: boolean; error: string }
interface Props { children: React.ReactNode; compact?: boolean; onBack?: () => void }

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
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
    if (this.props.compact) {
      return (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, background: '#0a0b12', color: '#f5f7fb', fontFamily: 'Inter, -apple-system, sans-serif' }}>
          <div style={{ maxWidth: 420, textAlign: 'center', padding: 22, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>This page could not load</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 14 }}>{this.state.error || 'A desktop page error was contained.'}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => this.setState({ hasError: false, error: '' })} style={localBtn}>Reload page</button>
              <button onClick={this.props.onBack} style={{ ...localBtn, background: 'transparent', border: '1px solid rgba(255,255,255,0.18)' }}>Go back to Dialer</button>
            </div>
          </div>
        </div>
      );
    }
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

const localBtn: React.CSSProperties = {
  background: '#003DA6', border: 'none', borderRadius: 8, color: 'white',
  padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
};
