import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollText, RefreshCw, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { formatDistanceToNow } from 'date-fns';

export default function AuditLogs() {
  const { selectedOrgId, organizations } = useOrganization() as any;
  const [orgFilter, setOrgFilter] = useState<string>('current');
  const [resourceFilter, setResourceFilter] = useState<string>('agents');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const effectiveOrgId = orgFilter === 'current' ? selectedOrgId : orgFilter;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit-logs', effectiveOrgId, resourceFilter, actionFilter],
    enabled: !!effectiveOrgId,
    queryFn: async () => {
      let q = supabase
        .from('audit_logs')
        .select('id, created_at, action, resource_type, resource_id, user_id, organization_id, metadata, ip_address, user_agent')
        .eq('organization_id', effectiveOrgId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (resourceFilter !== 'all') q = q.eq('resource_type', resourceFilter);
      if (actionFilter !== 'all') q = q.eq('action', actionFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return data || [];
    const s = search.toLowerCase();
    return (data || []).filter(r =>
      JSON.stringify(r).toLowerCase().includes(s)
    );
  }, [data, search]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <PortalPageHeader
            title="Audit Logs"
            description="Track who listed, created, or fetched agents (and other resources) per organization."
            icon={ScrollText}
          />
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger><SelectValue placeholder="Organization" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current org</SelectItem>
                {(organizations || []).map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger><SelectValue placeholder="Resource" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All resources</SelectItem>
                <SelectItem value="agents">Agents</SelectItem>
                <SelectItem value="clients">Clients</SelectItem>
                <SelectItem value="conversations">Conversations</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search metadata…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Resource</th>
                    <th className="px-4 py-3">Org</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No audit log entries.</td></tr>
                  ) : filtered.map(row => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {row.created_at ? formatDistanceToNow(new Date(row.created_at), { addSuffix: true }) : '—'}
                      </td>
                      <td className="px-4 py-3"><Badge variant="outline">{row.action}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.resource_type}</div>
                        {row.resource_id && <div className="text-xs text-muted-foreground font-mono">{row.resource_id}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">{row.organization_id}</td>
                      <td className="px-4 py-3 text-xs font-mono">{row.user_id || '—'}</td>
                      <td className="px-4 py-3 max-w-md">
                        <pre className="text-xs whitespace-pre-wrap break-all text-muted-foreground">
                          {row.metadata ? JSON.stringify(row.metadata, null, 0) : '—'}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
