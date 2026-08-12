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
    <div className="nova-panel flex flex-col items-center gap-2 px-4 py-8 text-center">
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
    <div className="mb-2 flex items-center justify-between gap-3">
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
    <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border pb-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
