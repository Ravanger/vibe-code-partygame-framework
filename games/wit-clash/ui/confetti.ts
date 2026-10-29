export interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  color: string;
}

const COLORS = [
  "var(--color-1)",
  "var(--color-2)",
  "var(--color-3)",
  "var(--color-4)",
  "var(--accent)",
];

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
