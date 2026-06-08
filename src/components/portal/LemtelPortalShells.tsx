import { ReactNode } from 'react';
import { SyncStatusPill } from './SyncStatusPill';
import { AppLayout } from '@/components/layout/AppLayout';

export function AdminPortalLayout({ children }: { children: ReactNode }) {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Lemtel Communications · Admin Portal</h2>
          <SyncStatusPill />
        </div>
        {children}
      </div>
    </AppLayout>
  );
}

export function UserPortalLayout({ children }: { children: ReactNode }) {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">My Workspace</h2>
          <SyncStatusPill />
        </div>
        {children}
      </div>
    </AppLayout>
  );
}
