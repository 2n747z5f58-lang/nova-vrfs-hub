import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="nova-panel flex flex-col items-center gap-2 px-6 py-10 text-center fade-in">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="nova-label">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border pb-4 fade-in">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-black tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="nova-panel px-4 py-4 text-center transition-all duration-200 hover:border-border-strong">
      <p className={accent ? "text-3xl font-black tabular-nums text-accent-green" : "text-3xl font-black tabular-nums text-foreground"}>
        {value}
      </p>
      <p className="nova-label mt-1">{label}</p>
    </div>
  );
}
