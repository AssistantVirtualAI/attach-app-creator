import { Search, ArrowUpDown, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export type StatusFilter = "all" | "active" | "inactive";
export type SortField = "name" | "created_at" | "status";
export type SortOrder = "asc" | "desc";

interface ClientFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  totalCount: number;
  filteredCount: number;
}

export const ClientFilters = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortField,
  sortOrder,
  onSortChange,
  totalCount,
  filteredCount,
}: ClientFiltersProps) => {
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      onSortChange(field, sortOrder === "asc" ? "desc" : "asc");
    } else {
      onSortChange(field, "asc");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            <SelectItem value="active">Actifs uniquement</SelectItem>
            <SelectItem value="inactive">Inactifs uniquement</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <ArrowUpDown className="w-4 h-4" />
              Trier
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuRadioGroup
              value={`${sortField}-${sortOrder}`}
              onValueChange={(value) => {
                const [field, order] = value.split("-") as [SortField, SortOrder];
                onSortChange(field, order);
              }}
            >
              <DropdownMenuRadioItem value="name-asc">Nom (A → Z)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name-desc">Nom (Z → A)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="created_at-desc">Plus récent</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="created_at-asc">Plus ancien</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="status-asc">Statut (Actif → Inactif)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="status-desc">Statut (Inactif → Actif)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {filteredCount === totalCount
            ? `${totalCount} client${totalCount > 1 ? "s" : ""}`
            : `${filteredCount} sur ${totalCount} client${totalCount > 1 ? "s" : ""}`}
        </span>
        {statusFilter !== "all" && (
          <Badge variant="secondary" className="gap-1">
            {statusFilter === "active" ? "Actifs" : "Inactifs"}
            <button
              onClick={() => onStatusFilterChange("all")}
              className="ml-1 hover:text-foreground"
            >
              ×
            </button>
          </Badge>
        )}
        {search && (
          <Badge variant="secondary" className="gap-1">
            "{search}"
            <button
              onClick={() => onSearchChange("")}
              className="ml-1 hover:text-foreground"
            >
              ×
            </button>
          </Badge>
        )}
      </div>
    </div>
  );
};
