import { describe, it, expect } from 'vitest';
import { mergeIncoming, mergeOnFetch, type ChatMessage } from '../orgChatMerge';

const msg = (id: string, channel_id = 'C1', created_at = `2026-01-01T00:00:${id.padStart(2, '0')}Z`, content = `m-${id}`): ChatMessage => ({
  id, channel_id, sender_id: 'u', sender_name: 'U', content, created_at,
});

describe('OrgChatView merge helpers (regression — messages must never disappear)', () => {
  describe('mergeIncoming (realtime inserts)', () => {
    it('appends a new realtime message to existing list', () => {
      const prev = [msg('1'), msg('2')];
      const out = mergeIncoming(prev, [msg('3')], 'C1');
      expect(out.map((m) => m.id)).toEqual(['1', '2', '3']);
    });

    it('dedupes by id when the same realtime row arrives twice', () => {
      const prev = [msg('1')];
      const out1 = mergeIncoming(prev, [msg('2')], 'C1');
      const out2 = mergeIncoming(out1, [msg('2')], 'C1');
      expect(out2.map((m) => m.id)).toEqual(['1', '2']);
    });

    it('ignores messages from other channels', () => {
      const prev = [msg('1')];
      const out = mergeIncoming(prev, [msg('99', 'C2')], 'C1');
      expect(out).toEqual(prev);
    });

    it('returns the same array reference when nothing changes (no re-render churn)', () => {
      const prev = [msg('1'), msg('2')];
      const out = mergeIncoming(prev, [msg('1')], 'C1');
      expect(out).toBe(prev);
    });

    it('sorts merged messages chronologically', () => {
      const prev = [msg('2', 'C1', '2026-01-01T00:00:02Z')];
      const out = mergeIncoming(prev, [msg('1', 'C1', '2026-01-01T00:00:01Z')], 'C1');
      expect(out.map((m) => m.id)).toEqual(['2', '1'].sort()); // ['1','2']
    });
  });

  describe('mergeOnFetch (initial channel load)', () => {
    it('NEVER clears existing messages even when fetched is empty', () => {
      const prev = [msg('a'), msg('b')];
      const out = mergeOnFetch(prev, [], 'C1');
      expect(out.map((m) => m.id)).toEqual(['a', 'b']);
    });

    it('keeps realtime inserts that arrived during the fetch (dedupe by id)', () => {
      // Realtime delivered "rt" before the fetch resolved.
      const prev = [msg('rt', 'C1', '2026-01-01T00:00:05Z', 'realtime')];
      // Fetch returns older messages plus the same "rt" row.
      const fetched = [
        msg('1', 'C1', '2026-01-01T00:00:01Z'),
        msg('rt', 'C1', '2026-01-01T00:00:05Z', 'fetched-version'),
      ];
      const out = mergeOnFetch(prev, fetched, 'C1');
      expect(out.map((m) => m.id)).toEqual(['1', 'rt']);
      // The realtime copy wins (was first in the map).
      expect(out.find((m) => m.id === 'rt')?.content).toBe('realtime');
    });

    it('drops prev messages from other channels (channel switch isolation)', () => {
      const prev = [msg('x', 'C-OLD')];
      const out = mergeOnFetch(prev, [msg('y', 'C1')], 'C1');
      expect(out.map((m) => m.id)).toEqual(['y']);
    });

    it('merges fetched + prev without duplicates and in chronological order', () => {
      const prev = [msg('3', 'C1', '2026-01-01T00:00:03Z')];
      const fetched = [
        msg('1', 'C1', '2026-01-01T00:00:01Z'),
        msg('2', 'C1', '2026-01-01T00:00:02Z'),
        msg('3', 'C1', '2026-01-01T00:00:03Z'),
      ];
      const out = mergeOnFetch(prev, fetched, 'C1');
      expect(out.map((m) => m.id)).toEqual(['1', '2', '3']);
    });
  });
});
