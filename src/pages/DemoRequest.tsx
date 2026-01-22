import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Navbar } from "@/components/landing/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const demoRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  expectedClients: z.string().trim().max(40).optional().or(z.literal("")),
  currentPlatform: z.string().trim().max(80).optional().or(z.literal("")),
  requirements: z.string().trim().max(2000).optional().or(z.literal("")),
});

type DemoRequestValues = z.infer<typeof demoRequestSchema>;

export default function DemoRequestPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const defaultValues = useMemo<DemoRequestValues>(
    () => ({
      name: "",
      email: "",
      company: "",
      phone: "",
      expectedClients: "",
      currentPlatform: "",
      requirements: "",
    }),
    []
  );

  const form = useForm<DemoRequestValues>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues,
    mode: "onBlur",
  });

  const onSubmit = async (values: DemoRequestValues) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        company: values.company || undefined,
        phone: values.phone || undefined,
        expectedClients: values.expectedClients || undefined,
        currentPlatform: values.currentPlatform || undefined,
        requirements: values.requirements || undefined,
      };

      const { error } = await supabase.functions.invoke("send-contact-sales", {
        body: payload,
      });

      if (error) throw error;

      toast({
        title: "Request sent / Demande envoyée",
        description: "We’ll reply within 24–48h. / Réponse sous 24–48h.",
      });
      form.reset(defaultValues);
    } catch (e: any) {
      toast({
        title: "Error / Erreur",
        description: e?.message ?? "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Navbar />
      <main className="pt-24">
        <section className="py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
          <div className="container mx-auto px-6 relative z-10">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-bold">Book a demo</h1>
                <p className="text-sm text-muted-foreground mt-2">Demander une démo</p>
                <p className="text-muted-foreground mt-4">
                  Tell us about your needs and we’ll contact you.
                </p>
                <p className="text-sm text-muted-foreground">
                  Décrivez votre besoin et on vous recontacte.
                </p>
              </div>

              <Card className="bg-card/50 backdrop-blur-xl border-border/60">
                <CardHeader>
                  <CardTitle>Contact details / Coordonnées</CardTitle>
                  <CardDescription>
                    Required: name + email. / Requis : nom + email.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name / Nom</Label>
                        <Input id="name" autoComplete="name" {...form.register("name")} />
                        {form.formState.errors.name ? (
                          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
                        {form.formState.errors.email ? (
                          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company">Company / Société</Label>
                        <Input id="company" {...form.register("company")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone / Téléphone</Label>
                        <Input id="phone" {...form.register("phone")} />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expectedClients"># Clients (expected) / # clients</Label>
                        <Input id="expectedClients" {...form.register("expectedClients")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currentPlatform">Current platform / Plateforme actuelle</Label>
                        <Input id="currentPlatform" {...form.register("currentPlatform")} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="requirements">Requirements / Besoins</Label>
                      <Textarea
                        id="requirements"
                        rows={6}
                        placeholder="Tell us what you want to build… / Décrivez votre projet…"
                        {...form.register("requirements")}
                      />
                      {form.formState.errors.requirements ? (
                        <p className="text-sm text-destructive">{form.formState.errors.requirements.message}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-end">
                      <Button type="button" variant="outline" onClick={() => navigate("/")}>Back / Retour</Button>
                      <Button
                        type="submit"
                        className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                        disabled={submitting}
                      >
                        {submitting ? "Sending… / Envoi…" : "Submit / Envoyer"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />
    </div>
  );
}
