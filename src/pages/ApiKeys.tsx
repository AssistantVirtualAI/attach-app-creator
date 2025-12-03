import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApiKeysList } from '@/components/api-keys/ApiKeysList';
import { CreateKeyModal } from '@/components/api-keys/CreateKeyModal';
import { useApiKeys } from '@/hooks/useApiKeys';
import { usePermissions } from '@/hooks/usePermissions';
import { Key, Plus, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ApiKeys = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { apiKeys, isLoading, createApiKey, revokeApiKey, deleteApiKey, availableScopes } = useApiKeys();
  const { can } = usePermissions();

  const canManageApiKeys = can('manage:api_keys');

  if (!canManageApiKeys) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Key className="h-8 w-8 text-primary" />
              Clés API
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos clés d'accès à l'API
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle clé
          </Button>
        </div>

        {/* Info Alert */}
        <Alert>
          <Key className="h-4 w-4" />
          <AlertDescription>
            Les clés API permettent d'accéder à vos données programmatiquement. 
            Gardez-les secrètes et ne les partagez jamais publiquement.
          </AlertDescription>
        </Alert>

        {/* API Keys List */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Vos clés API</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : (
              <ApiKeysList
                apiKeys={apiKeys}
                onRevoke={(keyId) => revokeApiKey.mutate(keyId)}
                onDelete={(keyId) => deleteApiKey.mutate(keyId)}
              />
            )}
          </CardContent>
        </Card>

        {/* API Documentation */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Utilisation de l'API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Utilisez votre clé API dans l'en-tête <code className="bg-muted px-1 rounded">Authorization</code> de vos requêtes :
            </p>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
              <code className="text-sm">
{`curl -X GET "https://api.avastatistics.com/v1/conversations" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
              </code>
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Create Modal */}
      <CreateKeyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={async (data) => {
          const result = await createApiKey.mutateAsync(data);
          return { key: result.key };
        }}
        availableScopes={availableScopes}
        isLoading={createApiKey.isPending}
      />
    </AppLayout>
  );
};

export default ApiKeys;
