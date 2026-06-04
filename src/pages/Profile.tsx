import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2, KeyRound, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const { user, updatePassword } = useAuth();
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t('profile.passwordTooShort') || 'Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('profile.passwordsDoNotMatch') || 'Passwords do not match');
      return;
    }
    setIsLoading(true);
    const { error } = await updatePassword(newPassword);
    setIsLoading(false);
    if (!error) {
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">{t('profile.title') || 'Profile'}</h1>
          <p className="text-muted-foreground">{t('profile.description') || 'Manage your account'}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserIcon className="w-5 h-5" /> {t('profile.account') || 'Account'}</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" /> {t('profile.changePassword') || 'Change Password'}</CardTitle>
            <CardDescription>{t('profile.changePasswordDesc') || 'Choose a strong password (min. 8 characters).'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('profile.newPassword') || 'New password'}</Label>
                <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('profile.confirmPassword') || 'Confirm password'}</Label>
                <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('profile.updatePassword') || 'Update password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
