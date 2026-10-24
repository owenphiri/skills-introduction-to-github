"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, FileBarChart, Loader2, Mail, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const newsletterSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type NewsletterForm = z.infer<typeof newsletterSchema>;

const perks = [
  { label: "Weekly market newsletter", icon: Newspaper },
  { label: "Quarterly investment reports", icon: FileBarChart },
  { label: "Instant property alerts", icon: Bell },
];

export function Newsletter() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterForm>({ resolver: zodResolver(newsletterSchema) });

  const onSubmit = async (data: NewsletterForm) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    toast.success("Subscribed!", {
      description: `Market intelligence is on its way to ${data.email}.`,
    });
    reset();
  };

  return (
    <section aria-labelledby="newsletter-heading" className="py-24">
      <div className="container">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-secondary via-[#1E3A8A] to-[#0F172A] p-8 text-white shadow-lift sm:p-14">
            <div
              aria-hidden="true"
              className="absolute -right-20 -top-20 size-72 rounded-full bg-emerald-400/20 blur-[100px]"
            />
            <div className="relative grid items-center gap-10 lg:grid-cols-2">
              <div>
                <h2 id="newsletter-heading" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  Market intelligence, delivered
                </h2>
                <p className="mt-3 max-w-md text-slate-300">
                  Join 120,000+ subscribers receiving property alerts, investment
                  reports, and our weekly market briefing.
                </p>
                <ul className="mt-6 space-y-2.5">
                  {perks.map((perk) => (
                    <li key={perk.label} className="flex items-center gap-2.5 text-sm text-slate-200">
                      <perk.icon className="size-4 text-emerald-300" aria-hidden="true" />
                      {perk.label}
                    </li>
                  ))}
                </ul>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Newsletter signup">
                <div className="glass-strong flex flex-col gap-3 rounded-2xl p-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Mail
                      aria-hidden="true"
                      className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <label htmlFor="newsletter-email" className="sr-only">
                      Email address
                    </label>
                    <Input
                      id="newsletter-email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="border-0 bg-transparent pl-10 shadow-none"
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? "newsletter-error" : undefined}
                      {...register("email")}
                    />
                  </div>
                  <Button type="submit" disabled={isSubmitting} className="sm:px-8">
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      "Subscribe"
                    )}
                  </Button>
                </div>
                {errors.email && (
                  <p id="newsletter-error" role="alert" className="mt-2 text-sm text-rose-300">
                    {errors.email.message}
                  </p>
                )}
                <p className="mt-3 text-xs text-slate-400">
                  No spam, ever. Unsubscribe in one click.
                </p>
              </form>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
