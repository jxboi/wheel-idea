import { Rocket, type LucideIcon } from "lucide-react";

export type Project = {
  id: string;
  title: string;
  summary: string;
  kind: string;
  /** Same-origin pages (served from public/) or full URLs. Always opens in a new tab. */
  href: string;
  icon: LucideIcon;
};

/** Standalone projects linked from the Ideas tab. Add an entry to list another. */
export const projects: Project[] = [
  {
    id: "rocket-launch",
    title: "Rocket launch",
    summary: "An animated 3D launch, from the pad up through the clouds.",
    kind: "3D scene",
    href: "/rocket-launch.html",
    icon: Rocket,
  },
];
