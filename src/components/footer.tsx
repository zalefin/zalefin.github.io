import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="px-4 pb-5 text-center text-xs text-fg-faint opacity-70">
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
