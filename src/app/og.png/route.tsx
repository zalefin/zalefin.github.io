import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { logoTileSvg, svgDataUri } from "@/lib/logo";
import { OG_IMAGE_SIZE, SITE } from "@/lib/site";

// A route handler rather than the opengraph-image convention, so the exported
// file keeps a .png extension and GitHub Pages serves it as image/png.
export const dynamic = "force-static";

const fontFile = (weight: number) =>
  readFile(
    join(
      process.cwd(),
      `node_modules/@fontsource/source-code-pro/files/source-code-pro-latin-${weight}-normal.woff`,
    ),
  );

export async function GET() {
  const [regular, semibold] = await Promise.all([fontFile(400), fontFile(600)]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: "0 80px",
        background: "#282828",
        backgroundImage:
          "radial-gradient(circle at 20% 30%, rgba(254,128,25,0.16), transparent 45%), radial-gradient(circle at 85% 80%, rgba(142,192,124,0.12), transparent 45%)",
        fontFamily: "Source Code Pro",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={svgDataUri(logoTileSvg(240))} width={240} height={240} alt="" />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: 88,
            fontWeight: 600,
            color: "#ebdbb2",
            letterSpacing: -2,
          }}
        >
          {SITE.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 26,
            color: "#bdae93",
          }}
        >
          {SITE.tagline}
          <div
            style={{
              width: 16,
              height: 30,
              marginLeft: 6,
              background: "#fe8019",
            }}
          />
        </div>
        <div style={{ fontSize: 26, color: "#928374", marginTop: 12 }}>
          zachlef.in
        </div>
      </div>
    </div>,
    {
      width: OG_IMAGE_SIZE.width,
      height: OG_IMAGE_SIZE.height,
      fonts: [
        { name: "Source Code Pro", data: regular, weight: 400 },
        { name: "Source Code Pro", data: semibold, weight: 600 },
      ],
    },
  );
}
