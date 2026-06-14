import React from 'react';

/**
 * Inline error state for failed data fetches.
 * Replaces silent empty-array / mock-fallback behaviour so the user can
 * understand something is wrong and retry, instead of seeing fake records.
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
      justifyContent: 'center', gap: 8, padding: '24px 16px',
      color: 'var(--text-muted, #94a3b8)', fontSize: 13, textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, color: 'var(--text, #e2e8f0)' }}>
        {message || 'Impossible de charger les données.'}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 6, padding: '6px 14px', borderRadius: 8,
            background: 'rgba(0,82,204,0.18)', border: '1px solid rgba(0,82,204,0.35)',
            color: '#cfe1ff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
