import { useEffect, useState } from 'react';
import { getLatestRelease, type LatestRelease } from '@/lib/githubReleases';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

const formatSize = (bytes?: number) => (bytes ? `${Math.round(bytes / 1024 / 1024)} MB` : '');

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #0A0E27 0%, #050818 100%)',
  color: '#fff',
  padding: '60px 24px',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const containerStyle: React.CSSProperties = { maxWidth: 1100, margin: '0 auto' };

const sectionTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  margin: '48px 0 20px',
};

const cardGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16,
  padding: 20,
  backdropFilter: 'blur(10px)',
};

interface DownloadCardProps {
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  url?: string;
  filename?: string;
  requirements?: string;
  loading?: boolean;
  size?: number;
}

const DownloadCard = ({ icon, title, subtitle, badge, url, filename, requirements, loading, size }: DownloadCardProps) => (
  <div style={cardStyle}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
      <span style={{ fontSize: 32 }}>{icon}</span>
      {badge && (
        <span style={{ fontSize: 11, padding: '4px 8px', background: 'rgba(0,61,166,0.3)', borderRadius: 8 }}>
          {badge}
        </span>
      )}
    </div>
    <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h3>
    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '4px 0 12px' }}>{subtitle}</p>
    {requirements && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 12px' }}>{requirements}</p>}
    {loading ? (
      <div style={{ height: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }} />
    ) : (
      <a
        href={url || '#'}
        download={filename}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: url ? 'linear-gradient(135deg, #003DA6, #7C3AED)' : 'rgba(255,255,255,0.1)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 10,
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 600,
          cursor: url ? 'pointer' : 'not-allowed',
          opacity: url ? 1 : 0.5,
        }}
      >
        ⬇️ Télécharger {size ? `(${formatSize(size)})` : ''}
      </a>
    )}
  </div>
);

const DownloadPage = () => {
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLatestRelease().then((r) => {
      setRelease(r);
      setLoading(false);
    });
  }, []);

  const sizeOf = (predicate: (n: string) => boolean) =>
    release?.assets.find((a) => predicate(a.name.toLowerCase()))?.size;

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📱</div>
          <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #fff, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Lemtel Telecom
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', maxWidth: 600, margin: '12px auto 0' }}>
            Téléphonie IA pour entreprises — disponible sur toutes vos plateformes
          </p>
          {release && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '6px 14px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 999, fontSize: 12 }}>
              <span style={{ color: '#22c55e' }}>●</span>
              <span>{release.tag_name} · {formatDate(release.published_at)}</span>
            </div>
          )}
        </div>

        {/* Desktop */}
        <h2 style={sectionTitle}>💻 Applications Desktop</h2>
        <div style={cardGrid}>
          <DownloadCard icon="🍎" title="macOS Apple Silicon" subtitle="M1, M2, M3, M4" badge="DMG"
            url={release?.urls.mac_arm64} filename="Lemtel.Telecom-arm64.dmg"
            requirements="macOS Big Sur 11+" loading={loading}
            size={sizeOf((n) => n.includes('arm64') && n.endsWith('.dmg'))} />
          <DownloadCard icon="🍎" title="macOS Intel" subtitle="Mac Intel x64" badge="DMG"
            url={release?.urls.mac_x64} filename="Lemtel.Telecom-x64.dmg"
            requirements="macOS Big Sur 11+" loading={loading}
            size={sizeOf((n) => n.includes('x64') && n.endsWith('.dmg'))} />
          <DownloadCard icon="🪟" title="Windows" subtitle="Windows 10/11" badge="EXE"
            url={release?.urls.windows} filename="Lemtel.Telecom.Setup.exe"
            requirements="Windows 10 64-bit ou plus récent" loading={loading}
            size={sizeOf((n) => n.endsWith('.exe'))} />
          <DownloadCard icon="🐧" title="Linux" subtitle="AppImage universel" badge="AppImage"
            url={release?.urls.linux} filename="Lemtel.Telecom.AppImage"
            requirements="Ubuntu 18.04+ ou équivalent" loading={loading}
            size={sizeOf((n) => n.endsWith('.appimage'))} />
        </div>

        {/* Mobile */}
        <h2 style={sectionTitle}>📱 Applications Mobiles</h2>
        <div style={cardGrid}>
          <div style={cardStyle}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🍎</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>iPhone & iPad</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '4px 0 12px' }}>iOS 15 ou plus récent</p>
            <a href="https://apps.apple.com/app/lemtel-telecom" target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', padding: '10px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', textAlign: 'center', textDecoration: 'none', fontSize: 14 }}>
              App Store
            </a>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'center' }}>iOS — Bientôt disponible</p>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Android</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '4px 0 12px' }}>Android 8.0 ou plus récent</p>
            {release?.urls.android ? (
              <a href={release.urls.android}
                style={{ display: 'block', background: '#003DA6', color: '#fff', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                ⬇️ Télécharger APK
              </a>
            ) : (
              <a href="https://play.google.com/store/apps/details?id=com.lemtel.softphone" target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', padding: '10px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', textAlign: 'center', textDecoration: 'none', fontSize: 14 }}>
                Google Play
              </a>
            )}
          </div>
        </div>

        {/* Chrome */}
        <h2 style={sectionTitle}>🔌 Extension Chrome</h2>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 36 }}>🔌</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Lemtel Click-to-Dial</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '4px 0 12px' }}>
                Cliquez sur n'importe quel numéro de téléphone sur le web pour appeler directement
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {release?.urls.chrome && (
                  <a href={release.urls.chrome}
                    style={{ background: 'rgba(0,61,166,0.2)', border: '1px solid rgba(0,61,166,0.4)', color: '#fff', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 13 }}>
                    ⬇️ Télécharger ZIP
                  </a>
                )}
                <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 13 }}>
                  Chrome Web Store — Bientôt
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Requirements */}
        <h2 style={sectionTitle}>⚙️ Configuration requise</h2>
        <div style={cardGrid}>
          {[
            { platform: '🍎 macOS', req: 'Big Sur 11+, 4 GB RAM, 500 MB disque' },
            { platform: '🪟 Windows', req: 'Windows 10 64-bit, 4 GB RAM, 500 MB disque' },
            { platform: '🐧 Linux', req: 'Ubuntu 18.04+, 4 GB RAM, 500 MB disque' },
            { platform: '📱 iOS', req: 'iOS 15+, iPhone 8 ou plus récent' },
            { platform: '🤖 Android', req: 'Android 8.0+, 2 GB RAM minimum' },
          ].map(({ platform, req }) => (
            <div key={platform} style={{ ...cardStyle, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{platform}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{req}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            Powered by AVA AI · assistantvirtualai.com · support@assistantvirtualai.com
          </p>
          <a href={release?.html_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', marginTop: 8, color: 'rgba(0,61,166,0.9)', fontSize: 12 }}>
            Voir toutes les versions sur GitHub →
          </a>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
