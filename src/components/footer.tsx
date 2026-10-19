import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="fixed inset-x-0 bottom-4 text-center text-xs text-fg-faint opacity-70">
      built with next.js ·{" "}
      <a
        href={SITE.source}
        className="underline-offset-4 transition-colors hover:text-orange hover:underline"
      >
        source on github
      </a>
    </footer>
  );
}
