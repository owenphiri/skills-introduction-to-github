"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const leadSchema = z.object({
  name: z.string().min(2, "Please enter your full name"),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .min(7, "Please enter a valid phone number")
    .regex(/^[+\d][\d\s\-()]{6,19}$/, "Digits, spaces, +, - and () only"),
  interest: z.string().min(1, "Please select what you're looking for"),
  budget: z.string().min(1, "Please select a budget range"),
  message: z.string().max(1000, "Message must be under 1,000 characters").optional(),
  // Honeypot field — bots fill it, humans never see it.
  company: z.string().max(0).optional(),
});

type LeadForm = z.infer<typeof leadSchema>;

export function Cta() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeadForm>({ resolver: zodResolver(leadSchema) });

  const onSubmit = async (data: LeadForm) => {
    if (data.company) return; // honeypot triggered — silently drop
    // Simulated API call; wire to /api/leads with rate limiting + CAPTCHA in production.
    await new Promise((resolve) => setTimeout(resolve, 900));
    setSubmitted(true);
    toast.success("Consultation request received!", {
      description: "A PrimeAxis advisor will reach out within one business day.",
    });
  };

  return (
    <section
      id="cta"
      aria-labelledby="cta-heading"
      className="relative overflow-hidden bg-[#0F172A] py-24 text-white"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0F172A] to-[#1E3A8A]/70"
      />
      <div
        aria-hidden="true"
        className="absolute -left-32 top-0 size-[420px] rounded-full bg-emerald-500/15 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-24 right-0 size-[380px] rounded-full bg-amber-500/10 blur-[130px]"
      />

      <div className="container relative grid items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <span className="section-eyebrow border-white/20 bg-white/10 text-emerald-300">
            Let&apos;s get started
          </span>
          <h2 id="cta-heading" className="section-title text-white">
            Ready to find your dream property?
          </h2>
          <p className="mt-4 max-w-lg text-slate-300">
            Tell us what you&apos;re looking for and a dedicated advisor will curate a
            shortlist of verified properties, arrange viewings, and negotiate on
            your behalf — at no cost to buyers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" variant="glass" className="text-white">
              Explore Listings
            </Button>
            <Button size="lg" variant="gold">
              Contact Sales
            </Button>
          </div>
          <p className="mt-8 inline-flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
            Your details are encrypted and never shared. Protected against spam
            (CAPTCHA-ready).
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="glass-strong rounded-3xl p-6 text-foreground shadow-lift sm:p-8">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
                className="flex min-h-[380px] flex-col items-center justify-center text-center"
                role="status"
              >
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 16 }}
                  className="flex size-16 items-center justify-center rounded-full bg-accent/15 text-accent"
                >
                  <CheckCircle2 className="size-9" aria-hidden="true" />
                </motion.span>
                <h3 className="mt-5 font-display text-2xl font-bold">You&apos;re all set!</h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  Your consultation request is in. Expect a call from your
                  dedicated advisor within one business day.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Book a consultation">
                <h3 className="font-display text-xl font-bold">Book a free consultation</h3>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="lead-name" className="mb-1.5 block text-xs font-semibold">
                      Full name
                    </label>
                    <Input
                      id="lead-name"
                      autoComplete="name"
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? "lead-name-error" : undefined}
                      {...register("name")}
                    />
                    {errors.name && (
                      <p id="lead-name-error" role="alert" className="mt-1 text-xs text-rose-500">
                        {errors.name.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="lead-phone" className="mb-1.5 block text-xs font-semibold">
                      Phone
                    </label>
                    <Input
                      id="lead-phone"
                      type="tel"
                      autoComplete="tel"
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? "lead-phone-error" : undefined}
                      {...register("phone")}
                    />
                    {errors.phone && (
                      <p id="lead-phone-error" role="alert" className="mt-1 text-xs text-rose-500">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="lead-email" className="mb-1.5 block text-xs font-semibold">
                      Email
                    </label>
                    <Input
                      id="lead-email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? "lead-email-error" : undefined}
                      {...register("email")}
                    />
                    {errors.email && (
                      <p id="lead-email-error" role="alert" className="mt-1 text-xs text-rose-500">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="lead-interest" className="mb-1.5 block text-xs font-semibold">
                      I&apos;m looking to
                    </label>
                    <Select
                      id="lead-interest"
                      defaultValue=""
                      aria-invalid={!!errors.interest}
                      {...register("interest")}
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      <option>Buy a home</option>
                      <option>Rent</option>
                      <option>Invest</option>
                      <option>Sell / list a property</option>
                      <option>Register as an agent</option>
                      <option>Register as a developer</option>
                    </Select>
                    {errors.interest && (
                      <p role="alert" className="mt-1 text-xs text-rose-500">
                        {errors.interest.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="lead-budget" className="mb-1.5 block text-xs font-semibold">
                      Budget
                    </label>
                    <Select
                      id="lead-budget"
                      defaultValue=""
                      aria-invalid={!!errors.budget}
                      {...register("budget")}
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      <option>Under $100k</option>
                      <option>$100k – $500k</option>
                      <option>$500k – $1M</option>
                      <option>$1M – $5M</option>
                      <option>$5M+</option>
                    </Select>
                    {errors.budget && (
                      <p role="alert" className="mt-1 text-xs text-rose-500">
                        {errors.budget.message}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="lead-message" className="mb-1.5 block text-xs font-semibold">
                      Anything else? <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <textarea
                      id="lead-message"
                      rows={3}
                      className="flex w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm shadow-soft placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Preferred locations, timelines, must-haves…"
                      {...register("message")}
                    />
                  </div>
                  {/* Honeypot — hidden from humans and screen readers */}
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hidden"
                    {...register("company")}
                  />
                </div>
                <Button type="submit" size="lg" className="mt-6 w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden="true" />
                      Sending…
                    </>
                  ) : (
                    "Request consultation"
                  )}
                </Button>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
