import { ReactNode } from 'react';
import { SyncStatusPill } from './SyncStatusPill';
import { ImpersonationBanner } from './ImpersonationBanner';

function ShellHeader({ label }: { label: string }) {
  return (
    <div className="glass-panel flex items-center justify-between rounded-xl border border-border/50 bg-card/50 backdrop-blur-xl px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
        <h2 className="text-sm font-semibold tracking-tight bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          {label}
        </h2>
      </div>
      <SyncStatusPill />
    </div>
  );
}

export function AdminPortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <div className="space-y-5">
        <ShellHeader label="Lemtel Communications · Admin Portal" />
        {children}
      </div>
    </>
  );
}

export function UserPortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <div className="space-y-5">
        <ShellHeader label="My Workspace" />
        {children}
      </div>
    </>
  );
}
