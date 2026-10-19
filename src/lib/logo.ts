// The Zach Lefin mark, from the original Inkscape logo (logo_final.svg).
// The brand colors are fixed; they don't follow the theme.

export const LOGO_VIEWBOX = "49 92 112 112";

export const LOGO_TILE_COLOR = "#fbf1c7";

type LogoPiece = {
  id: string;
  d: string;
  fill: string;
  // Where the piece starts before snapping into place, in viewBox units.
  from: { x: number; y: number; rotate: number };
};

export const LOGO_PIECES: LogoPiece[] = [
  {
    id: "top-bar",
    d: "m 53.275526,95.96863 v 21.42308 l 78.025214,0.21646 21.25968,-20.99029 z",
    fill: "#292929",
    from: { x: 0, y: -60, rotate: -8 },
  },
  {
    id: "z-stroke",
    d: "M 155.6286,100.08025 53.38511,201.03137 c 26.190992,0 -13.036567,0 78.57296,0 l 0.21922,-18.5023 H 95.575688 l 60.272142,-59.5103 z",
    fill: "#de7723",
    from: { x: 60, y: 60, rotate: 10 },
  },
  {
    id: "l-stem",
    d: "m 156.28611,129.07802 -15.67077,15.47265 v 13.74148 h -13.91737 l -12.16404,12.01025 h 25.31432 v 30.40437 h 16.87622 z",
    fill: "#292929",
    from: { x: 70, y: 0, rotate: 12 },
  },
  {
    id: "wedge",
    d: "m 53.71392,124.31717 h 67.28559 l -67.504817,66.65154 z",
    fill: "#999999",
    from: { x: -70, y: 10, rotate: -12 },
  },
];

/** The logo on its tile as a standalone SVG string, for icons and OG images. */
export function logoTileSvg(size: number): string {
  const paths = LOGO_PIECES.map(
    (p) => `<path d="${p.d}" fill="${p.fill}"/>`,
  ).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${LOGO_VIEWBOX}">` +
    `<rect x="49" y="92" width="112" height="112" rx="22" fill="${LOGO_TILE_COLOR}"/>` +
    `<g transform="translate(105 148) scale(0.78) translate(-105 -148)">${paths}</g>` +
    `</svg>`
  );
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
