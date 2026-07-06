import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-card border border-border bg-surface px-3 text-sm',
        'placeholder:text-faint-foreground focus-visible:outline-2 focus-visible:outline-primary',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block text-sm font-medium text-muted-foreground', className)}
      {...props}
    />
  );
}
