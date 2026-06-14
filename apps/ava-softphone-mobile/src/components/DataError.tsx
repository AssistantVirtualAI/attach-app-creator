import React from 'react';

/**
 * Inline error state for failed data fetches in the mobile app.
 * Replaces silent fallback-to-mock behaviour.
 */
export default function DataError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 10, padding: '32px 20px',
      color: 'rgba(226,232,240,0.7)', fontSize: 14, textAlign: 'center',
    }}>
      <div style={{ fontSize: 15, color: '#e2e8f0' }}>
        {message || 'Impossible de charger les données.'}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 8, padding: '10px 18px', borderRadius: 20,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
