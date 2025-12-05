import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const createOrganizationForNewUser = async (userId: string, email: string, fullName?: string) => {
    try {
      // Create organization
      const orgName = fullName ? `${fullName}'s Agency` : `Agency ${email.split('@')[0]}`;
      const orgSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now();

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          slug: orgSlug,
          onboarding_completed: false,
        })
        .select('id')
        .single();

      if (orgError) throw orgError;

      // Add user as org member
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          user_id: userId,
          organization_id: org.id,
          accepted_at: new Date().toISOString(),
        });

      if (memberError) throw memberError;

      // Assign org_admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          organization_id: org.id,
          role: 'org_admin',
        });

      if (roleError) throw roleError;

      // Create billing config with 7-day trial
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      const { error: billingError } = await supabase
        .from('billing_config')
        .insert({
          organization_id: org.id,
          plan_tier: 'trial',
          trial_ends_at: trialEndsAt.toISOString(),
          subscription_status: 'trialing',
          client_limit: 1,
        });

      if (billingError) throw billingError;

      return { error: null };
    } catch (error: any) {
      console.error('Error creating organization:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // Create organization for new user after signup
      if (data.user) {
        // Use setTimeout to defer to avoid auth deadlock
        setTimeout(async () => {
          await createOrganizationForNewUser(data.user!.id, email, fullName);
        }, 0);
      }

      toast({
        title: "Inscription réussie",
        description: "Bienvenue ! Votre essai gratuit de 7 jours est activé.",
      });
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erreur d'inscription",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur AVA Statistics",
      });
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erreur de connexion",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erreur de connexion Google",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });

      if (error) throw error;

      toast({
        title: "Email envoyé",
        description: "Vérifiez votre boîte mail pour réinitialiser votre mot de passe",
      });
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Mot de passe mis à jour",
        description: "Votre mot de passe a été changé avec succès",
      });
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({
        title: "Déconnexion réussie",
        description: "À bientôt !",
      });
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erreur de déconnexion",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    resetPassword,
    updatePassword,
    signOut,
  };
};
