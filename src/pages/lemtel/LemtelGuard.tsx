import { ReactNode } from 'react';
import { useLemtelAccess } from '@/hooks/useLemtelAccess';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

export function LemtelGuard({ children }: { children: ReactNode }) {
  const { isMember } = useLemtelAccess();
  if (!isMember) {
    return (
      <AppLayout>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <ShieldAlert className="w-12 h-12 text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">The Lemtel module is only available to Lemtel organization members.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }
  return <AppLayout>{children}</AppLayout>;
}
