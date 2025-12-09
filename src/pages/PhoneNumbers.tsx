import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Phone, Plus, Search, MoreHorizontal, Trash2, Settings, CheckCircle, RefreshCw, Globe } from 'lucide-react';
import { usePhoneNumbers } from '@/hooks/usePhoneNumbers';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { toast } from 'sonner';

export default function PhoneNumbers() {
  const { phoneNumbers, isLoading, searchNumbers, purchaseNumber, addSipNumber, deleteNumber, isSearching, searchResults } = usePhoneNumbers();
  const [isAddTwilioOpen, setIsAddTwilioOpen] = useState(false);
  const [isAddSipOpen, setIsAddSipOpen] = useState(false);
  const [searchCountry, setSearchCountry] = useState('US');
  const [searchAreaCode, setSearchAreaCode] = useState('');
  const [sipNumber, setSipNumber] = useState('');
  const [sipProvider, setSipProvider] = useState('');
  const [sipFriendlyName, setSipFriendlyName] = useState('');

  const handleSearchNumbers = async () => {
    try {
      await searchNumbers.mutateAsync({ country: searchCountry, areaCode: searchAreaCode });
    } catch (error) {
      toast.error('Erreur lors de la recherche');
    }
  };

  const handlePurchaseNumber = async (phoneNumber: string) => {
    try {
      await purchaseNumber.mutateAsync({ phoneNumber });
      setIsAddTwilioOpen(false);
      toast.success('Numéro acheté avec succès');
    } catch (error) {
      toast.error('Erreur lors de l\'achat');
    }
  };

  const handleAddSipNumber = async () => {
    if (!sipNumber || !sipProvider) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    try {
      await addSipNumber.mutateAsync({
        phone_number: sipNumber,
        provider: sipProvider,
        friendly_name: sipFriendlyName
      });
      setIsAddSipOpen(false);
      setSipNumber('');
      setSipProvider('');
      setSipFriendlyName('');
      toast.success('Numéro SIP ajouté');
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
    }
  };

  const handleDeleteNumber = async (id: string) => {
    if (confirm('Supprimer ce numéro ?')) {
      try {
        await deleteNumber.mutateAsync(id);
        toast.success('Numéro supprimé');
      } catch (error) {
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <h1 className="text-3xl font-bold">Numéros de téléphone</h1>
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
            <h1 className="text-3xl font-bold">Numéros de téléphone</h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos numéros Twilio et SIP pour les campagnes
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddSipOpen} onOpenChange={setIsAddSipOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Globe className="mr-2 h-4 w-4" />
                  Ajouter SIP
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un numéro SIP</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Numéro de téléphone</Label>
                    <Input
                      placeholder="+33 1 23 45 67 89"
                      value={sipNumber}
                      onChange={(e) => setSipNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Provider SIP</Label>
                    <Select value={sipProvider} onValueChange={setSipProvider}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vonage">Vonage</SelectItem>
                        <SelectItem value="bandwidth">Bandwidth</SelectItem>
                        <SelectItem value="plivo">Plivo</SelectItem>
                        <SelectItem value="signalwire">SignalWire</SelectItem>
                        <SelectItem value="custom">Autre SIP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nom (optionnel)</Label>
                    <Input
                      placeholder="Ligne principale"
                      value={sipFriendlyName}
                      onChange={(e) => setSipFriendlyName(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddSipNumber} className="w-full">
                    Ajouter le numéro
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddTwilioOpen} onOpenChange={setIsAddTwilioOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Acheter Twilio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Acheter un numéro Twilio</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <Label>Pays</Label>
                      <Select value={searchCountry} onValueChange={setSearchCountry}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="US">États-Unis</SelectItem>
                          <SelectItem value="CA">Canada</SelectItem>
                          <SelectItem value="GB">Royaume-Uni</SelectItem>
                          <SelectItem value="FR">France</SelectItem>
                          <SelectItem value="DE">Allemagne</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>Indicatif (optionnel)</Label>
                      <Input
                        placeholder="415"
                        value={searchAreaCode}
                        onChange={(e) => setSearchAreaCode(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleSearchNumbers} disabled={isSearching}>
                        {isSearching ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {searchResults && searchResults.length > 0 && (
                    <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Numéro</TableHead>
                            <TableHead>Capacités</TableHead>
                            <TableHead>Prix/mois</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.map((result: { phoneNumber: string; capabilities: { voice: boolean; sms: boolean }; monthlyPrice: number }) => (
                            <TableRow key={result.phoneNumber}>
                              <TableCell className="font-mono">{result.phoneNumber}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {result.capabilities.voice && (
                                    <Badge variant="secondary">Voix</Badge>
                                  )}
                                  {result.capabilities.sms && (
                                    <Badge variant="secondary">SMS</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>${result.monthlyPrice?.toFixed(2) || '1.15'}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => handlePurchaseNumber(result.phoneNumber)}
                                  disabled={purchaseNumber.isPending}
                                >
                                  Acheter
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {searchResults && searchResults.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun numéro disponible
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Mes numéros ({phoneNumbers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {phoneNumbers.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun numéro</h3>
                <p className="text-muted-foreground mb-4">
                  Achetez un numéro Twilio ou ajoutez un numéro SIP
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Coût/mois</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phoneNumbers.map((phone) => (
                    <TableRow key={phone.id}>
                      <TableCell className="font-mono font-medium">
                        {phone.phone_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {phone.provider}
                        </Badge>
                      </TableCell>
                      <TableCell>{phone.friendly_name || '-'}</TableCell>
                      <TableCell>
                        {phone.status === 'active' ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Actif
                          </Badge>
                        ) : phone.status === 'pending' ? (
                          <Badge variant="secondary">En attente</Badge>
                        ) : (
                          <Badge variant="destructive">Inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {phone.monthly_cost ? `$${phone.monthly_cost.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Settings className="mr-2 h-4 w-4" />
                              Configurer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteNumber(phone.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
