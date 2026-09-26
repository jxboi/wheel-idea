import {
  Laptop,
  Gamepad2,
  Sun,
  BookOpen,
  Paintbrush,
  Users,
  Leaf,
  Dices,
  type LucideIcon,
} from "lucide-react";
export const categoryIcons: LucideIcon[] = [
  Laptop,
  Gamepad2,
  Sun,
  BookOpen,
  Paintbrush,
  Users,
  Leaf,
  Dices,
];
export const categoryColors = [
  "#bfd7df",
  "#d9d3eb",
  "#f5e3b4",
  "#f2cbb9",
  "#d3dfc5",
  "#e8c7ce",
  "#f8e2d5",
  "#d5e3d8",
];
export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <svg
      className="brand-mark"
      width={small ? 32 : 48}
      height={small ? 32 : 48}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      {Array.from({ length: 20 }, (_, i) => (
        <path
          key={i}
          d={`M24 3v${i % 2 ? 10 : 14}`}
          transform={`rotate(${i * 18} 24 24)`}
          stroke="currentColor"
          strokeWidth="1.45"
        />
      ))}
    </svg>
  );
}
