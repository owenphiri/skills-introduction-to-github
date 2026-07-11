import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";

const stats = [
  { value: 38500, suffix: "+", label: "Properties Sold" },
  { value: 92000, suffix: "+", label: "Happy Clients" },
  { value: 25, suffix: "", label: "Countries" },
  { value: 180, suffix: "+", label: "Cities" },
  { value: 12000, suffix: "+", label: "Agents" },
  { value: 4800, suffix: "+", label: "Investors" },
];

export function Stats() {
  return (
    <section aria-labelledby="stats-heading" className="border-y bg-card py-14">
      <h2 id="stats-heading" className="sr-only">
        PrimeAxis by the numbers
      </h2>
      <div className="container grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat, index) => (
          <Reveal key={stat.label} delay={index * 0.06} className="text-center">
            <p className="font-display text-3xl font-bold text-foreground lg:text-4xl">
              <CountUp end={stat.value} suffix={stat.suffix} />
            </p>
            <p className="mt-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
