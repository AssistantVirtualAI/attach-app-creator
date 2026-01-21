import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTwilioIntegration, TwilioPhoneNumber, TwilioTwiMLApp } from '@/hooks/useTwilioIntegration';
import { useTranslation } from '@/hooks/useTranslation';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: TwilioPhoneNumber;
  twimlApps: TwilioTwiMLApp[];
}

export function PhoneNumberConfigModal({ open, onOpenChange, phoneNumber, twimlApps }: Props) {
  const { t } = useTranslation();
  const { updateNumber } = useTwilioIntegration();

  const [friendlyName, setFriendlyName] = useState(phoneNumber.friendly_name);
  const [voiceUrl, setVoiceUrl] = useState(phoneNumber.voice_url || '');
  const [voiceMethod, setVoiceMethod] = useState(phoneNumber.voice_method);
  const [voiceFallbackUrl, setVoiceFallbackUrl] = useState(phoneNumber.voice_fallback_url || '');
  const [voiceFallbackMethod, setVoiceFallbackMethod] = useState(phoneNumber.voice_fallback_method);
  const [statusCallback, setStatusCallback] = useState(phoneNumber.status_callback || '');
  const [statusCallbackMethod, setStatusCallbackMethod] = useState(phoneNumber.status_callback_method);
  const [smsUrl, setSmsUrl] = useState(phoneNumber.sms_url || '');
  const [smsMethod, setSmsMethod] = useState(phoneNumber.sms_method);
  const [smsFallbackUrl, setSmsFallbackUrl] = useState(phoneNumber.sms_fallback_url || '');
  const [smsFallbackMethod, setSmsFallbackMethod] = useState(phoneNumber.sms_fallback_method);
  const [voiceApplicationSid, setVoiceApplicationSid] = useState(phoneNumber.voice_application_sid || '');
  const [smsApplicationSid, setSmsApplicationSid] = useState(phoneNumber.sms_application_sid || '');

  useEffect(() => {
    setFriendlyName(phoneNumber.friendly_name);
    setVoiceUrl(phoneNumber.voice_url || '');
    setVoiceMethod(phoneNumber.voice_method);
    setVoiceFallbackUrl(phoneNumber.voice_fallback_url || '');
    setVoiceFallbackMethod(phoneNumber.voice_fallback_method);
    setStatusCallback(phoneNumber.status_callback || '');
    setStatusCallbackMethod(phoneNumber.status_callback_method);
    setSmsUrl(phoneNumber.sms_url || '');
    setSmsMethod(phoneNumber.sms_method);
    setSmsFallbackUrl(phoneNumber.sms_fallback_url || '');
    setSmsFallbackMethod(phoneNumber.sms_fallback_method);
    setVoiceApplicationSid(phoneNumber.voice_application_sid || '');
    setSmsApplicationSid(phoneNumber.sms_application_sid || '');
  }, [phoneNumber]);

  const handleSave = async () => {
    await updateNumber.mutateAsync({
      phoneSid: phoneNumber.sid,
      friendly_name: friendlyName,
      voice_url: voiceApplicationSid ? undefined : voiceUrl,
      voice_method: voiceMethod,
      voice_fallback_url: voiceApplicationSid ? undefined : voiceFallbackUrl,
      voice_fallback_method: voiceFallbackMethod,
      status_callback: statusCallback,
      status_callback_method: statusCallbackMethod,
      sms_url: smsApplicationSid ? undefined : smsUrl,
      sms_method: smsMethod,
      sms_fallback_url: smsApplicationSid ? undefined : smsFallbackUrl,
      sms_fallback_method: smsFallbackMethod,
      voice_application_sid: voiceApplicationSid || undefined,
      sms_application_sid: smsApplicationSid || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('twilio.phoneNumbers.configureNumber')} {phoneNumber.phone_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t('twilio.phoneNumbers.friendlyName')}</Label>
            <Input
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="Mon numéro principal"
            />
          </div>

          <Tabs defaultValue="voice">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="voice">{t('twilio.phoneNumbers.voiceSettings')}</TabsTrigger>
              <TabsTrigger value="sms">{t('twilio.phoneNumbers.smsSettings')}</TabsTrigger>
            </TabsList>

            <TabsContent value="voice" className="space-y-4 mt-4">
              <div>
                <Label>{t('twilio.phoneNumbers.voiceApp')}</Label>
                <Select value={voiceApplicationSid} onValueChange={setVoiceApplicationSid}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('twilio.phoneNumbers.selectApp')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('twilio.phoneNumbers.noApp')}</SelectItem>
                    {twimlApps.map((app) => (
                      <SelectItem key={app.sid} value={app.sid}>
                        {app.friendly_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!voiceApplicationSid && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label>{t('twilio.phoneNumbers.voiceUrl')}</Label>
                      <Input
                        value={voiceUrl}
                        onChange={(e) => setVoiceUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <Label>{t('twilio.phoneNumbers.method')}</Label>
                      <Select value={voiceMethod} onValueChange={setVoiceMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="GET">GET</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label>{t('twilio.phoneNumbers.voiceFallbackUrl')}</Label>
                      <Input
                        value={voiceFallbackUrl}
                        onChange={(e) => setVoiceFallbackUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <Label>{t('twilio.phoneNumbers.method')}</Label>
                      <Select value={voiceFallbackMethod} onValueChange={setVoiceFallbackMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="GET">GET</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label>{t('twilio.phoneNumbers.statusCallback')}</Label>
                  <Input
                    value={statusCallback}
                    onChange={(e) => setStatusCallback(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label>{t('twilio.phoneNumbers.method')}</Label>
                  <Select value={statusCallbackMethod} onValueChange={setStatusCallbackMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="GET">GET</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sms" className="space-y-4 mt-4">
              <div>
                <Label>{t('twilio.phoneNumbers.smsApp')}</Label>
                <Select value={smsApplicationSid} onValueChange={setSmsApplicationSid}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('twilio.phoneNumbers.selectApp')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('twilio.phoneNumbers.noApp')}</SelectItem>
                    {twimlApps.map((app) => (
                      <SelectItem key={app.sid} value={app.sid}>
                        {app.friendly_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!smsApplicationSid && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label>{t('twilio.phoneNumbers.smsWebhookUrl')}</Label>
                      <Input
                        value={smsUrl}
                        onChange={(e) => setSmsUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <Label>{t('twilio.phoneNumbers.method')}</Label>
                      <Select value={smsMethod} onValueChange={setSmsMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="GET">GET</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label>{t('twilio.phoneNumbers.smsFallbackUrl')}</Label>
                      <Input
                        value={smsFallbackUrl}
                        onChange={(e) => setSmsFallbackUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <Label>{t('twilio.phoneNumbers.method')}</Label>
                      <Select value={smsFallbackMethod} onValueChange={setSmsFallbackMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="GET">GET</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={updateNumber.isPending}>
            {updateNumber.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
