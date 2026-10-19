import type { Metadata, Viewport } from "next";
import { Source_Code_Pro } from "next/font/google";
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";
import { OG_IMAGE_SIZE, SITE } from "@/lib/site";
import "./globals.css";

const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code-pro",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: SITE.name,
  description: SITE.tagline,
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.tagline,
    images: [
      {
        url: "/og.png",
        ...OG_IMAGE_SIZE,
        alt: `${SITE.name}: ${SITE.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.tagline,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf1c7" },
    { media: "(prefers-color-scheme: dark)", color: "#282828" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the theme class before hydration.
    <html lang="en" className={sourceCodePro.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-mono antialiased">
        <Providers>
          <ThemeToggle />
          {children}
        </Providers>
      </body>
    </html>
  );
}
