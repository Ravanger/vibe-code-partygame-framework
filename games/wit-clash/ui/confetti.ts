export interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  color: string;
}

const COLORS = ["var(--pink)", "var(--sun)", "var(--mint)", "var(--sky)", "var(--grape)"];

export function confettiPieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, index) => {
    const [color = ""] = COLORS.slice(index % COLORS.length);
    return {
      left: (index * 37) % 100,
      delay: ((index * 13) % 17) / 10,
      duration: 2.2 + ((index * 7) % 9) / 10,
      drift: ((index * 11) % 21) - 10,
      color,
    };
  });
}
