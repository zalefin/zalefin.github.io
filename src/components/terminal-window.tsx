/** A frosted-glass window with a terminal-style title bar. */
export function TerminalWindow({
  title,
  actions,
  children,
  className = "",
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-panel-border bg-panel shadow-[0_30px_80px_-30px_var(--shadow)] backdrop-blur-xl ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-panel-border px-4 py-2.5">
        <span className="size-3 shrink-0 rounded-full bg-red" />
        <span className="size-3 shrink-0 rounded-full bg-yellow" />
        <span className="size-3 shrink-0 rounded-full bg-green" />
        <span className="ml-2 truncate text-xs text-fg-faint">{title}</span>
        {actions && (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
