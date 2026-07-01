import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Cross-org isolation guard.
 *
 * Every admin-facing query targeting a tenant-scoped table must apply an
 * `organization_id` (or equivalent org scope) filter. This test scans the
 * admin pages source and fails if a `.from('<org-scoped table>')` chain
 * doesn't include an org filter in the same statement window.
 *
 * If you legitimately query a global/system table, add it to `GLOBAL_TABLES`.
 */

const ADMIN_DIRS = [
  'src/pages/lemtel',
  'src/pages/planipret/admin',
  'src/pages/admin',
].filter((p) => fs.existsSync(p));

const ORG_SCOPED_TABLES = [
  'organizations',
  'org_members',
  'organization_members',
  'org_contacts',
  'org_chat_channels',
  'org_chat_messages',
  'org_notifications',
  'org_exports',
  'lemtel_customers',
  'lemtel_softphone_users',
  'lemtel_sms_threads',
  'lemtel_dids',
  'lemtel_config',
  'lemtel_cdrs_cache',
  'planipret_profiles',
  'planipret_phone_calls',
  'planipret_phone_messages',
  'planipret_voicemails',
];

// Tables that are inherently global or scoped through another mechanism
// (RLS with SECURITY DEFINER, per-user, or joined via domain).
const GLOBAL_TABLES = new Set<string>([
  'user_roles',
  'profiles',
]);

const ORG_FILTER_RX = /\b(organization_id|org_id|\.eq\('organization_id'|\.eq\(`organization_id`|\.in\('organization_id')/;

function* walk(dir: string): Generator<string> {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(f.name)) yield p;
  }
}

describe('multi-tenant isolation: admin queries must scope by organization_id', () => {
  const files: string[] = [];
  for (const d of ADMIN_DIRS) for (const p of walk(d)) files.push(p);

  it('discovers admin source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    // find every .from('<table>') occurrence
    const rx = /\.from\(\s*['"`]([a-z0-9_]+)['"`]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(src))) {
      const table = m[1];
      if (!ORG_SCOPED_TABLES.includes(table)) continue;
      if (GLOBAL_TABLES.has(table)) continue;

      // Look at the next ~600 chars for an org filter, or previous 200
      // (some code builds the query in a variable first).
      const windowText = src.slice(Math.max(0, m.index - 200), m.index + 800);
      const hasOrgFilter = ORG_FILTER_RX.test(windowText);

      it(`${path.relative(process.cwd(), file)} — .from('${table}') applies organization_id`, () => {
        expect(hasOrgFilter, `Missing organization_id filter near .from('${table}') in ${file}`).toBe(true);
      });
    }
  }
});

describe('multi-tenant isolation: no wildcard cross-org selects', () => {
  it('does not select all rows without an org filter in admin pages', () => {
    const suspicious: string[] = [];
    for (const d of ADMIN_DIRS) {
      for (const file of walk(d)) {
        const src = fs.readFileSync(file, 'utf8');
        // .select('*') immediately followed by no eq/filter and no .single()
        const rx = /\.from\(\s*['"`]([a-z0-9_]+)['"`]\s*\)\s*\.select\(\s*['"`]\*['"`]\s*\)(?![^;]*\.(eq|in|match|filter|neq|is|contains))/g;
        let m: RegExpExecArray | null;
        while ((m = rx.exec(src))) {
          if (ORG_SCOPED_TABLES.includes(m[1])) {
            suspicious.push(`${file}: from('${m[1]}').select('*') without filter`);
          }
        }
      }
    }
    expect(suspicious, suspicious.join('\n')).toEqual([]);
  });
});
