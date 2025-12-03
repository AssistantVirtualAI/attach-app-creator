import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Key, Trash2, Ban, Clock, CheckCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ApiKey } from '@/hooks/useApiKeys';

interface ApiKeysListProps {
  apiKeys: ApiKey[];
  onRevoke: (keyId: string) => void;
  onDelete: (keyId: string) => void;
}

export const ApiKeysList = ({ apiKeys, onRevoke, onDelete }: ApiKeysListProps) => {
  if (apiKeys.length === 0) {
    return (
      <div className="text-center py-12">
        <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Aucune clé API créée</p>
        <p className="text-sm text-muted-foreground mt-1">
          Créez une clé API pour intégrer vos services
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Clé</TableHead>
          <TableHead>Scopes</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Dernière utilisation</TableHead>
          <TableHead>Expire</TableHead>
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {apiKeys.map((key) => (
          <TableRow key={key.id}>
            <TableCell className="font-medium">{key.name}</TableCell>
            <TableCell>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {key.key_prefix}...
              </code>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {(key.scopes || []).slice(0, 2).map((scope) => (
                  <Badge key={scope} variant="outline" className="text-xs">
                    {scope.split(':')[1]}
                  </Badge>
                ))}
                {(key.scopes?.length || 0) > 2 && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-xs">
                        +{(key.scopes?.length || 0) - 2}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {key.scopes?.slice(2).join(', ')}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TableCell>
            <TableCell>
              {key.is_active ? (
                <Badge className="bg-green-500/10 text-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <Ban className="h-3 w-3 mr-1" />
                  Révoquée
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {key.last_used_at ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(key.last_used_at), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </span>
              ) : (
                'Jamais'
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {key.expires_at
                ? format(new Date(key.expires_at), 'dd MMM yyyy', { locale: fr })
                : 'Jamais'}
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                {key.is_active && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRevoke(key.id)}
                      >
                        <Ban className="h-4 w-4 text-orange-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Révoquer</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(key.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Supprimer</TooltipContent>
                </Tooltip>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
