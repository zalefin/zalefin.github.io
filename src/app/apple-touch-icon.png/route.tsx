import { ImageResponse } from "next/og";
import { logoTileSvg, svgDataUri } from "@/lib/logo";

// A route handler rather than the apple-icon convention, so the exported file
// keeps a .png extension and GitHub Pages serves it as image/png.
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={svgDataUri(logoTileSvg(180))} width={180} height={180} alt="" />,
    { width: 180, height: 180 },
  );
}
