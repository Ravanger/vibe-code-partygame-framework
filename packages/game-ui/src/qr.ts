import { encode } from "uqr";

export interface QrCode {
  size: number;
  path: string;
}

function rowPath(row: boolean[], y: number): string {
  let path = "";
  let x = 0;
  while (x < row.length) {
    if (!row[x]) {
      ++x;
      continue;
    }
    const start = x;
    while (row[x]) ++x;
    path += `M${start} ${y}h${x - start}v1h-${x - start}z`;
  }
  return path;
}

/** The dark modules of a QR code for `text`, as one SVG path in module units. */
export function qrCode(text: string): QrCode {
  const { data, size } = encode(text);
  return { size, path: data.map(rowPath).join("") };
}
