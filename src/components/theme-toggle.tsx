"use client";

import { useTheme } from "next-themes";

// Both icons are always rendered and CSS picks one from the .dark class, so
// the server-rendered markup never disagrees with the client's theme.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="group fixed top-4 right-4 z-20 grid size-10 cursor-pointer place-items-center rounded-full border border-panel-border bg-panel text-fg-muted backdrop-blur-md transition-colors hover:text-orange"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="col-start-1 row-start-1 size-5 scale-100 rotate-0 transition-all duration-500 dark:scale-0 dark:-rotate-90 dark:opacity-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="col-start-1 row-start-1 size-5 scale-0 rotate-90 opacity-0 transition-all duration-500 dark:scale-100 dark:rotate-0 dark:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}
