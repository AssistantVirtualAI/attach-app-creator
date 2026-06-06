import React from 'react';
import { Empty } from './RecentsScreen';

export default function VoicemailScreen() {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 16px' }}>
      <h2 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 16px' }}>Voicemail</h2>
      <Empty label="No voicemail messages" />
    </div>
  );
}
