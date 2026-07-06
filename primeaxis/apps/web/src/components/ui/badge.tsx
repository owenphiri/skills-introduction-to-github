import { cn } from '@/lib/utils';

const tones = {
  neutral: 'bg-surface-2 text-muted-foreground border-border',
  good: 'bg-good/10 text-good border-good/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  critical: 'bg-critical/10 text-critical border-critical/30',
  brand: 'bg-primary/10 text-primary border-primary/30',
} as const;

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
