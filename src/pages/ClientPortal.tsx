import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { ClientProvider, useClient } from '@/context/ClientContext';
import { ClientLayout } from '@/components/client-portal/ClientLayout';
import { Loader2 } from 'lucide-react';

const ClientPortalContent = () => {
  const { isAuthenticated, isLoading } = useClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/client/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ClientLayout>
      <Outlet />
    </ClientLayout>
  );
};

const ClientPortal = () => {
  return (
    <ClientProvider>
      <ClientPortalContent />
    </ClientProvider>
  );
};

export default ClientPortal;
