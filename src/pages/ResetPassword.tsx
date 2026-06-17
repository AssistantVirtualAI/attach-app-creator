import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Consumes a Supabase recovery token from the URL hash
 * (`#access_token=...&refresh_token=...&type=recovery`) and lets the user
 * pick a new password. Public route — must NOT be behind an auth guard.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid' | 'success'>('loading');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ pw1?: string; pw2?: string }>({});

  // Hydrate session from the recovery hash exactly once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const type = params.get('type');
        const errDesc = params.get('error_description');

        if (errDesc) throw new Error(decodeURIComponent(errDesc.replace(/\+/g, ' ')));

        if (access_token && refresh_token && type === 'recovery') {
          const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
          if (setErr) throw setErr;
          // Strip the token from the URL so it isn't shared/copied.
          window.history.replaceState({}, '', window.location.pathname);
          if (!cancelled) setStatus('ready');
          return;
        }

        // Maybe Supabase already exchanged the token (PKCE flow) — check for an active session.
        const { data } = await supabase.auth.getSession();
        if (data.session) { if (!cancelled) setStatus('ready'); return; }

        if (!cancelled) setStatus('invalid');
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Invalid or expired reset link.');
          setStatus('invalid');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const strength = useMemo(() => scorePassword(pw1), [pw1]);

  const validate = (): boolean => {
    const e: typeof fieldError = {};
    if (!pw1) e.pw1 = 'Password is required.';
    else if (pw1.length < 8) e.pw1 = 'Password must be at least 8 characters.';
    else if (!/[A-Z]/.test(pw1) || !/[a-z]/.test(pw1) || !/\d/.test(pw1)) e.pw1 = 'Use upper-case, lower-case, and a number.';
    if (!pw2) e.pw2 = 'Please confirm your password.';
    else if (pw1 !== pw2) e.pw2 = 'Passwords do not match.';
    setFieldError(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: pw1 });
      if (updErr) throw updErr;
      // Sign out so the user must sign in with the new password explicitly.
      await supabase.auth.signOut();
      setStatus('success');
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('same') && msg.includes('password')) {
        setError('New password must be different from your current password.');
      } else if (msg.includes('weak')) {
        setError('Password is too weak. Try a longer phrase with mixed characters.');
      } else if (msg.includes('session')) {
        setError('Your reset link has expired. Please request a new one.');
      } else {
        setError(e?.message || 'Could not update password. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying your reset link…
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error || 'This reset link is invalid or has expired.'}</AlertDescription>
              </Alert>
              <Button className="w-full" onClick={() => navigate('/auth')}>Back to sign in</Button>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw1">New password</Label>
                <Input
                  id="pw1"
                  type="password"
                  value={pw1}
                  onChange={(e) => { setPw1(e.target.value); setFieldError((f) => ({ ...f, pw1: undefined })); }}
                  autoFocus
                  autoComplete="new-password"
                />
                {fieldError.pw1 && <p className="text-xs text-destructive">{fieldError.pw1}</p>}
                {pw1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-1 flex-1 bg-muted rounded overflow-hidden">
                      <div
                        className={`h-full transition-all ${strength.color}`}
                        style={{ width: `${(strength.score / 4) * 100}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground">{strength.label}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pw2">Confirm password</Label>
                <Input
                  id="pw2"
                  type="password"
                  value={pw2}
                  onChange={(e) => { setPw2(e.target.value); setFieldError((f) => ({ ...f, pw2: undefined })); }}
                  autoComplete="new-password"
                />
                {fieldError.pw2 && <p className="text-xs text-destructive">{fieldError.pw2}</p>}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={busy || !pw1 || !pw2}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {busy ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}

          {status === 'success' && (
            <div className="space-y-4 text-center py-2">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <h3 className="text-lg font-semibold">Password updated</h3>
              <p className="text-sm text-muted-foreground">
                Your password has been changed. Sign in to continue.
              </p>
              <Button className="w-full" onClick={() => navigate('/auth')}>Go to sign in</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function scorePassword(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['Too weak', 'Weak', 'Okay', 'Strong', 'Excellent'];
  const colors = ['bg-destructive', 'bg-destructive', 'bg-yellow-500', 'bg-green-500', 'bg-green-600'];
  return { score: s, label: labels[s], color: colors[s] };
}
