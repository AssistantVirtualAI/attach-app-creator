import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLatestRelease, type LatestRelease } from '@/lib/githubReleases';

const page: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #0A0E27 0%, #050818 100%)',
  color: '#fff',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const container: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '0 24px' };

const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '14px 28px',
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  textDecoration: 'none',
  background: primary ? 'linear-gradient(135deg, #003DA6, #7C3AED)' : 'rgba(255,255,255,0.08)',
  color: '#fff',
  border: primary ? 'none' : '1px solid rgba(255,255,255,0.15)',
});

const features = [
  { icon: '📞', title: 'Softphone multi-plateforme', desc: 'Mac, Windows, Linux, iOS, Android et navigateur web.' },
  { icon: '🤖', title: 'IA intégrée', desc: 'Transcription automatique, résumés et insights conversationnels.' },
  { icon: '🎧', title: 'Call center complet', desc: 'Files d\'attente, supervision en temps réel et wallboard.' },
  { icon: '📊', title: 'Analytics en temps réel', desc: 'Tableaux de bord, KPIs et rapports planifiés.' },
  { icon: '💬', title: 'SMS & messagerie', desc: 'Conversations bidirectionnelles avec modèles réutilisables.' },
  { icon: '🔒', title: 'Sécurisé & conforme', desc: 'Chiffrement, RLS, journaux d\'audit et conformité HIPAA/GDPR.' },
];

const LandingPage = () => {
  const [release, setRelease] = useState<LatestRelease | null>(null);
  useEffect(() => { getLatestRelease().then(setRelease); }, []);

  return (
    <div style={page}>
      {/* Hero */}
      <section style={{ ...container, paddingTop: 96, paddingBottom: 80, textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>📞</div>
        <h1 style={{ fontSize: 56, fontWeight: 800, margin: 0, lineHeight: 1.1, background: 'linear-gradient(135deg, #fff, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Lemtel Telecom
        </h1>
        <p style={{ fontSize: 22, color: 'rgba(255,255,255,0.85)', margin: '20px auto 8px', maxWidth: 720 }}>
          La téléphonie IA pour entreprises modernes
        </p>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', maxWidth: 640, margin: '0 auto 40px' }}>
          Gérez votre système téléphonique complet depuis un seul portail.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/login" style={btn(true)}>🚀 Commencer gratuitement</Link>
          <Link to="/download" style={btn()}>⬇️ Télécharger l'app</Link>
        </div>
        {release && (
          <p style={{ marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            Dernière version : <strong>{release.tag_name}</strong>
          </p>
        )}
      </section>

      {/* Features */}
      <section style={{ ...container, paddingBottom: 80 }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 40 }}>Tout ce qu'il vous faut</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {features.map((f) => (
            <div key={f.title} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Download badges */}
      <section style={{ ...container, paddingBottom: 80, textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Téléchargez sur toutes vos plateformes</h2>
        {release && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 28 }}>
            <span style={{ color: '#22c55e' }}>●</span> Version live {release.tag_name}
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {[
            { label: '🍎 macOS Apple Silicon', url: release?.urls.mac_arm64 },
            { label: '🍎 macOS Intel', url: release?.urls.mac_x64 },
            { label: '🪟 Windows', url: release?.urls.windows },
            { label: '🐧 Linux', url: release?.urls.linux },
            { label: '📱 iOS App Store', url: 'https://apps.apple.com/app/lemtel-telecom' },
            { label: '🤖 Google Play', url: 'https://play.google.com/store/apps/details?id=com.lemtel.softphone' },
          ].map((b) => (
            <a key={b.label} href={b.url || '#'} target={b.url?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
              style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', textDecoration: 'none', fontSize: 13 }}>
              {b.label}
            </a>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <Link to="/download" style={{ color: '#7C3AED', fontSize: 14 }}>Voir le centre de téléchargement complet →</Link>
        </div>
      </section>

      {/* Footer CTA */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ ...container, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
            Déjà client ? <Link to="/login" style={{ color: '#7C3AED', fontWeight: 600 }}>Se connecter</Link>
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
            Questions ? <a href="mailto:support@assistantvirtualai.com" style={{ color: '#7C3AED', fontWeight: 600 }}>support@assistantvirtualai.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
