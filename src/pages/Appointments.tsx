import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarIntegrationCard } from '@/components/calendar/CalendarIntegrationCard';
import { AppointmentsList } from '@/components/calendar/AppointmentsList';
import { BookAppointmentModal } from '@/components/calendar/BookAppointmentModal';
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';

const Appointments = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showBookModal, setShowBookModal] = useState(false);
  const { exchangeCode } = useCalendarIntegration();

  // Handle OAuth callback
  useEffect(() => {
    const callback = searchParams.get('callback');
    const code = searchParams.get('code');
    
    if (callback === 'google' && code) {
      exchangeCode.mutate(code);
      // Clean up URL
      setSearchParams({});
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Rendez-vous
          </h1>
          <p className="text-muted-foreground">
            Gérez vos rendez-vous et intégrations calendrier
          </p>
        </div>
        <Button onClick={() => setShowBookModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau rendez-vous
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CalendarIntegrationCard />
        </div>
        <div className="lg:col-span-2">
          <AppointmentsList />
        </div>
      </div>

      <BookAppointmentModal
        open={showBookModal}
        onOpenChange={setShowBookModal}
      />
    </div>
  );
};

export default Appointments;
