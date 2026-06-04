import { Building2, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganization } from '@/context/OrganizationContext';

export function OrgSwitcher() {
  const { organizations, selectedOrg, setSelectedOrgId } = useOrganization();

  if (!organizations || organizations.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 max-w-[160px] gap-1.5 px-2 hover:bg-muted"
        >
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="truncate text-xs font-medium">
            {selectedOrg?.name || 'Organisation'}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Organisations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setSelectedOrgId(org.id)}
            className="gap-2"
          >
            <Check
              className={`w-4 h-4 ${selectedOrg?.id === org.id ? 'opacity-100' : 'opacity-0'}`}
            />
            <span className="truncate">{org.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
