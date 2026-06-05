import { Card, CardContent } from '@/components/ui/card';
import { LemtelSoftphone } from '@/components/lemtel/LemtelSoftphone';
import { Phone } from 'lucide-react';

export default function TelephonyWebphone() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Phone className="w-7 h-7" /> Softphone</h1>
        <p className="text-muted-foreground">Make and receive calls in the browser via WebRTC</p>
      </div>
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">The softphone widget is anchored to the bottom-right of your screen.</p>
          <p className="text-xs text-muted-foreground">Click the phone icon to expand, then register with your SIP credentials.</p>
        </CardContent>
      </Card>
      <LemtelSoftphone />
    </div>
  );
}
