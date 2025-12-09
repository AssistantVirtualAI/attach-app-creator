import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useLeads } from '@/hooks/useLeads';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { AddLeadModal } from '@/components/leads/AddLeadModal';
import { Button } from '@/components/ui/button';
import { Plus, Users, UserCheck, Phone, Trophy, XCircle } from 'lucide-react';
import { TableSkeleton } from '@/components/LoadingSkeleton';

export default function Leads() {
  const { leads, stats, isLoading } = useLeads();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLeads = leads.filter(lead => {
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    const matchesSearch = !searchQuery || 
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery);
    return matchesStatus && matchesSource && matchesSearch;
  });

  const sources = [...new Set(leads.map(l => l.source).filter(Boolean))];

  const statCards = [
    { label: 'Total', value: stats.total, icon: Users, color: 'text-foreground' },
    { label: 'Nouveaux', value: stats.new, icon: Plus, color: 'text-blue-500' },
    { label: 'Qualifiés', value: stats.qualified, icon: UserCheck, color: 'text-yellow-500' },
    { label: 'Contactés', value: stats.contacted, icon: Phone, color: 'text-purple-500' },
    { label: 'Convertis', value: stats.converted, icon: Trophy, color: 'text-green-500' },
    { label: 'Perdus', value: stats.lost, icon: XCircle, color: 'text-red-500' },
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <h1 className="text-3xl font-bold">Leads</h1>
          <TableSkeleton rows={5} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leads</h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos prospects et suivez leur progression
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau lead
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-card/50 ${stat.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <LeadFilters
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          sourceFilter={sourceFilter}
          onSourceChange={setSourceFilter}
          sources={sources as string[]}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Table */}
        <LeadsTable leads={filteredLeads} />

        <AddLeadModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      </div>
    </AppLayout>
  );
}
