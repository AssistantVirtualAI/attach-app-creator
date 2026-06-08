import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLatestRelease, type LatestRelease } from '@/lib/githubReleases';
import { useLanguage } from '@/context/LanguageContext';

const STR = {
  en: {
    breadcrumb_home: 'Home', breadcrumb_download: 'Download',
    title: 'Lemtel Telecom',
    subtitle: 'AI telephony for businesses — available on all your platforms',
    desktop: 'Desktop apps', mobile: 'Mobile apps', chrome: 'Chrome extension',
    requirements: 'System requirements', download: 'Download',
    notes: 'Release notes', noNotes: 'No release notes published yet.',
    viewAll: 'View all releases on GitHub →',
    appStore: 'App Store', playStore: 'Google Play',
    iosSoon: 'iOS — coming soon', chromeSoon: 'Chrome Web Store — coming soon',
    clickToDial: 'Lemtel Click-to-Dial',
    clickDesc: 'Click any phone number on the web to call directly.',
    downloadZip: 'Download ZIP', downloadApk: 'Download APK',
    poweredBy: 'Powered by AVA AI · assistantvirtualai.com · support@assistantvirtualai.com',
    loading: 'Loading…', noRelease: 'No release information available.',
    backHome: '← Back to home',
  },
  fr: {
    breadcrumb_home: 'Accueil', breadcrumb_download: 'Téléchargement',
    title: 'Lemtel Telecom',
    subtitle: 'Téléphonie IA pour entreprises — disponible sur toutes vos plateformes',
    desktop: 'Applications Desktop', mobile: 'Applications Mobiles', chrome: 'Extension Chrome',
    requirements: 'Configuration requise', download: 'Télécharger',
    notes: 'Notes de version', noNotes: 'Aucune note de version publiée pour le moment.',
    viewAll: 'Voir toutes les versions sur GitHub →',
    appStore: 'App Store', playStore: 'Google Play',
    iosSoon: 'iOS — Bientôt disponible', chromeSoon: 'Chrome Web Store — Bientôt',
    clickToDial: 'Lemtel Click-to-Dial',
    clickDesc: "Cliquez sur n'importe quel numéro de téléphone sur le web pour appeler directement.",
    downloadZip: 'Télécharger ZIP', downloadApk: 'Télécharger APK',
    poweredBy: 'Propulsé par AVA AI · assistantvirtualai.com · support@assistantvirtualai.com',
    loading: 'Chargement…', noRelease: 'Aucune information de version disponible.',
    backHome: '← Retour à l\'accueil',
  },
} as const;

const page: React.CSSProperties = {
  minHeight: '100vh', background: 'linear-gradient(180deg, #0A0E27 0%, #050818 100%)',
  color: '#fff', padding: '40px 24px', fontFamily: 'Inter, system-ui, sans-serif',
};
const container: React.CSSProperties = { maxWidth: 1100, margin: '0 auto' };
const sectionTitle: React.CSSProperties = { fontSize: 22, fontWeight: 700, margin: '48px 0 20px' };
const cardGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 };
const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 20 };

const formatSize = (bytes?: number) => (bytes ? `${Math.round(bytes / 1024 / 1024)} MB` : '');

interface DCProps { icon: string; title: string; subtitle: string; badge?: string; url?: string; filename?: string; requirements?: string; loading?: boolean; size?: number; downloadLabel: string; }
const DownloadCard = ({ icon, title, subtitle, badge, url, filename, requirements, loading, size, downloadLabel }: DCProps) => (
  <div style={cardStyle}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
      <span style={{ fontSize: 32 }}>{icon}</span>
      {badge && <span style={{ fontSize: 11, padding: '4px 8px', background: 'rgba(0,61,166,0.3)', borderRadius: 8 }}>{badge}</span>}
    </div>
    <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h3>
    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '4px 0 12px' }}>{subtitle}</p>
    {requirements && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 12px' }}>{requirements}</p>}
    {loading ? (
      <div style={{ height: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }} />
    ) : (
      <a href={url || '#'} download={filename} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: url ? 'linear-gradient(135deg, #003DA6, #7C3AED)' : 'rgba(255,255,255,0.1)',
        color: 'white', padding: '10px 20px', borderRadius: 10, textDecoration: 'none',
        fontSize: 14, fontWeight: 600, cursor: url ? 'pointer' : 'not-allowed', opacity: url ? 1 : 0.5,
      }}>
        ⬇️ {downloadLabel} {size ? `(${formatSize(size)})` : ''}
      </a>
    )}
  </div>
);

const DownloadPage = () => {
  const { language } = useLanguage();
  const t = STR[language === 'fr' ? 'fr' : 'en'];
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });

  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getLatestRelease().then((r) => { setRelease(r); setLoading(false); }); }, []);

  const sizeOf = (predicate: (n: string) => boolean) =>
    release?.assets.find((a) => predicate(a.name.toLowerCase()))?.size;

  return (
    <div style={page}>
      <div style={container}>
        {/* Breadcrumb */}
        <nav style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>{t.breadcrumb_home}</Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <span style={{ color: '#fff' }}>{t.breadcrumb_download}</span>
        </nav>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📱</div>
          <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #fff, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t.title}</h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', maxWidth: 600, margin: '12px auto 0' }}>{t.subtitle}</p>
          {release && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '6px 14px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 999, fontSize: 12 }}>
              <span style={{ color: '#22c55e' }}>●</span>
              <span>{release.tag_name} · {formatDate(release.published_at)}</span>
            </div>
          )}
        </div>

        {/* Desktop */}
        <h2 style={sectionTitle}>💻 {t.desktop}</h2>
        <div style={cardGrid}>
          <DownloadCard icon="🍎" title="macOS Apple Silicon" subtitle="M1, M2, M3, M4" badge="DMG" url={release?.urls.mac_arm64} filename="Lemtel.Telecom-arm64.dmg" requirements="macOS Big Sur 11+" loading={loading} size={sizeOf((n) => n.includes('arm64') && n.endsWith('.dmg'))} downloadLabel={t.download} />
          <DownloadCard icon="🍎" title="macOS Intel" subtitle="Mac Intel x64" badge="DMG" url={release?.urls.mac_x64} filename="Lemtel.Telecom-x64.dmg" requirements="macOS Big Sur 11+" loading={loading} size={sizeOf((n) => n.includes('x64') && n.endsWith('.dmg'))} downloadLabel={t.download} />
          <DownloadCard icon="🪟" title="Windows" subtitle="Windows 10/11" badge="EXE" url={release?.urls.windows} filename="Lemtel.Telecom.Setup.exe" requirements="Windows 10 64-bit+" loading={loading} size={sizeOf((n) => n.endsWith('.exe'))} downloadLabel={t.download} />
          <DownloadCard icon="🐧" title="Linux" subtitle="AppImage" badge="AppImage" url={release?.urls.linux} filename="Lemtel.Telecom.AppImage" requirements="Ubuntu 18.04+" loading={loading} size={sizeOf((n) => n.endsWith('.appimage'))} downloadLabel={t.download} />
        </div>

        {/* Mobile */}
        <h2 style={sectionTitle}>📱 {t.mobile}</h2>
        <div style={cardGrid}>
          <div style={cardStyle}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🍎</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>iPhone & iPad</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '4px 0 12px' }}>iOS 15+</p>
            <a href="https://apps.apple.com/app/lemtel-telecom" target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', textAlign: 'center', textDecoration: 'none', fontSize: 14 }}>{t.appStore}</a>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'center' }}>{t.iosSoon}</p>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Android</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '4px 0 12px' }}>Android 8.0+</p>
            {release?.urls.android ? (
              <a href={release.urls.android} style={{ display: 'block', background: '#003DA6', color: '#fff', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>⬇️ {t.downloadApk}</a>
            ) : (
              <a href="https://play.google.com/store/apps/details?id=com.lemtel.softphone" target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', textAlign: 'center', textDecoration: 'none', fontSize: 14 }}>{t.playStore}</a>
            )}
          </div>
        </div>

        {/* Chrome */}
        <h2 style={sectionTitle}>🔌 {t.chrome}</h2>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 36 }}>🔌</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t.clickToDial}</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '4px 0 12px' }}>{t.clickDesc}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {release?.urls.chrome && (
                  <a href={release.urls.chrome} style={{ background: 'rgba(0,61,166,0.2)', border: '1px solid rgba(0,61,166,0.4)', color: '#fff', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 13 }}>⬇️ {t.downloadZip}</a>
                )}
                <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 13 }}>{t.chromeSoon}</a>
              </div>
            </div>
          </div>
        </div>

        {/* Release notes */}
        <h2 style={sectionTitle}>📝 {t.notes}</h2>
        <div style={cardStyle}>
          {loading ? (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{t.loading}</div>
          ) : !release ? (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{t.noRelease}</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{release.name || release.tag_name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{formatDate(release.published_at)}</div>
                </div>
                <a href={release.html_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#7C3AED', textDecoration: 'none' }}>{t.viewAll}</a>
              </div>
              {release.body ? (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'Fira Code, monospace', fontSize: 13, color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.25)', padding: 16, borderRadius: 10, maxHeight: 360, overflow: 'auto', margin: 0 }}>{release.body}</pre>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{t.noNotes}</div>
              )}
            </>
          )}
        </div>

        {/* Requirements */}
        <h2 style={sectionTitle}>⚙️ {t.requirements}</h2>
        <div style={cardGrid}>
          {[
            { p: '🍎 macOS', r: 'Big Sur 11+, 4 GB RAM, 500 MB' },
            { p: '🪟 Windows', r: 'Windows 10 64-bit, 4 GB RAM, 500 MB' },
            { p: '🐧 Linux', r: 'Ubuntu 18.04+, 4 GB RAM, 500 MB' },
            { p: '📱 iOS', r: 'iOS 15+, iPhone 8+' },
            { p: '🤖 Android', r: 'Android 8.0+, 2 GB RAM' },
          ].map(({ p, r }) => (
            <div key={p} style={{ ...cardStyle, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{r}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{t.poweredBy}</p>
          <Link to="/" style={{ display: 'inline-block', marginTop: 8, color: 'rgba(124,58,237,0.9)', fontSize: 12 }}>{t.backHome}</Link>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
