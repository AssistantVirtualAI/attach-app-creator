import { useState } from 'react';
import { Phone, Plus, Settings, Trash2, Search, Loader2, RefreshCw, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTwilioIntegration, TwilioPhoneNumber, AvailableNumber } from '@/hooks/useTwilioIntegration';
import { useAgentsForTwilio } from '@/hooks/useAgentsForTwilio';
import { PhoneNumberConfigModal } from './PhoneNumberConfigModal';
import { useTranslation } from '@/hooks/useTranslation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function TwilioPhoneNumbersTab() {
  const { t } = useTranslation();
  const {
    phoneNumbers,
    loadingNumbers,
    refetchNumbers,
    twimlApps,
    searchNumbers,
    purchaseNumber,
    releaseNumber,
  } = useTwilioIntegration();
  
  const { agents, getAgentByTwilioNumber } = useAgentsForTwilio();

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<TwilioPhoneNumber | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Search form
  const [searchCountry, setSearchCountry] = useState('US');
  const [searchAreaCode, setSearchAreaCode] = useState('');
  const [searchContains, setSearchContains] = useState('');
  const [searchType, setSearchType] = useState('Local');
  const [searchResults, setSearchResults] = useState<AvailableNumber[]>([]);

  const handleSearch = async () => {
    const results = await searchNumbers.mutateAsync({
      country: searchCountry,
      areaCode: searchAreaCode || undefined,
      contains: searchContains || undefined,
      type: searchType,
    });
    setSearchResults(results);
  };

  const handlePurchase = async (number: AvailableNumber) => {
    await purchaseNumber.mutateAsync({
      phoneNumber: number.phone_number,
      friendlyName: number.friendly_name,
    });
    setShowSearchModal(false);
    setSearchResults([]);
  };

  const handleDelete = async (phoneSid: string) => {
    await releaseNumber.mutateAsync(phoneSid);
    setDeleteConfirm(null);
  };

  const openConfig = (number: TwilioPhoneNumber) => {
    setSelectedNumber(number);
    setShowConfigModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('twilio.phoneNumbers.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('twilio.phoneNumbers.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchNumbers()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('common.refresh')}
          </Button>
          <Button onClick={() => setShowSearchModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('twilio.phoneNumbers.purchase')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            {t('twilio.phoneNumbers.yourNumbers')}
          </CardTitle>
          <CardDescription>
            {phoneNumbers.length} {t('twilio.phoneNumbers.numbersCount')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingNumbers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : phoneNumbers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('twilio.phoneNumbers.noNumbers')}</p>
              <Button variant="link" onClick={() => setShowSearchModal(true)}>
                {t('twilio.phoneNumbers.purchaseFirst')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('twilio.phoneNumbers.number')}</TableHead>
                  <TableHead>{t('twilio.phoneNumbers.name')}</TableHead>
                  <TableHead>{t('twilio.phoneNumbers.assignedAgent')}</TableHead>
                  <TableHead>{t('twilio.phoneNumbers.capabilities')}</TableHead>
                  <TableHead>{t('twilio.phoneNumbers.voiceConfig')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phoneNumbers.map((number) => {
                  const assignedAgent = getAgentByTwilioNumber(number.phone_number);
                  return (
                    <TableRow key={number.sid}>
                      <TableCell className="font-mono">{number.phone_number}</TableCell>
                      <TableCell>{number.friendly_name}</TableCell>
                      <TableCell>
                        {assignedAgent ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="default" className="gap-1 cursor-pointer">
                                  <Bot className="w-3 h-3" />
                                  {assignedAgent.name}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('twilio.phoneNumbers.platform')}: {assignedAgent.platform}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('twilio.phoneNumbers.notAssigned')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {number.capabilities.voice && <Badge variant="secondary">Voice</Badge>}
                          {number.capabilities.sms && <Badge variant="secondary">SMS</Badge>}
                          {number.capabilities.mms && <Badge variant="secondary">MMS</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {number.voice_application_sid ? (
                          <Badge variant="outline">
                            App: {twimlApps.find(a => a.sid === number.voice_application_sid)?.friendly_name || number.voice_application_sid.slice(0, 10)}
                          </Badge>
                        ) : number.voice_url ? (
                          <span className="text-sm text-muted-foreground truncate">{number.voice_url}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('twilio.phoneNumbers.notConfigured')}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openConfig(number)}>
                              <Settings className="w-4 h-4 mr-2" />
                              {t('twilio.phoneNumbers.configure')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeleteConfirm(number.sid)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('twilio.phoneNumbers.release')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Search & Purchase Modal */}
      <Dialog open={showSearchModal} onOpenChange={setShowSearchModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('twilio.phoneNumbers.searchTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('twilio.phoneNumbers.country')}</Label>
                <Select value={searchCountry} onValueChange={setSearchCountry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">États-Unis (+1)</SelectItem>
                    <SelectItem value="CA">Canada (+1)</SelectItem>
                    <SelectItem value="FR">France (+33)</SelectItem>
                    <SelectItem value="GB">Royaume-Uni (+44)</SelectItem>
                    <SelectItem value="DE">Allemagne (+49)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('twilio.phoneNumbers.type')}</Label>
                <Select value={searchType} onValueChange={setSearchType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Local">Local</SelectItem>
                    <SelectItem value="TollFree">Toll-Free</SelectItem>
                    <SelectItem value="Mobile">Mobile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('twilio.phoneNumbers.areaCode')}</Label>
                <Input
                  value={searchAreaCode}
                  onChange={(e) => setSearchAreaCode(e.target.value)}
                  placeholder="415"
                />
              </div>
              <div>
                <Label>{t('twilio.phoneNumbers.contains')}</Label>
                <Input
                  value={searchContains}
                  onChange={(e) => setSearchContains(e.target.value)}
                  placeholder="555"
                />
              </div>
            </div>
            <Button onClick={handleSearch} disabled={searchNumbers.isPending} className="w-full">
              {searchNumbers.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              {t('twilio.phoneNumbers.search')}
            </Button>

            {searchResults.length > 0 && (
              <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('twilio.phoneNumbers.number')}</TableHead>
                      <TableHead>{t('twilio.phoneNumbers.location')}</TableHead>
                      <TableHead>{t('twilio.phoneNumbers.capabilities')}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((number) => (
                      <TableRow key={number.phone_number}>
                        <TableCell className="font-mono">{number.phone_number}</TableCell>
                        <TableCell>{number.locality}, {number.region}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {number.capabilities.voice && <Badge variant="secondary">V</Badge>}
                            {number.capabilities.sms && <Badge variant="secondary">S</Badge>}
                            {number.capabilities.mms && <Badge variant="secondary">M</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            onClick={() => handlePurchase(number)}
                            disabled={purchaseNumber.isPending}
                          >
                            {purchaseNumber.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              t('twilio.phoneNumbers.buy')
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Config Modal */}
      {selectedNumber && (
        <PhoneNumberConfigModal
          open={showConfigModal}
          onOpenChange={setShowConfigModal}
          phoneNumber={selectedNumber}
          twimlApps={twimlApps}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('twilio.phoneNumbers.releaseConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('twilio.phoneNumbers.releaseConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('twilio.phoneNumbers.releaseConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
