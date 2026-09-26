import {
  CircleDot,
  BookOpen,
  NotebookPen,
  Database,
  Settings,
  Monitor,
  ChevronDown,
} from "lucide-react";
import { BrandMark } from "./Icons";
import type { ReactNode } from "react";
export type Page = "wheel" | "library" | "journal" | "memory" | "settings";
const nav = [
  ["wheel", "The wheel", CircleDot],
  ["library", "Idea library", BookOpen],
  ["journal", "Journal", NotebookPen],
  ["memory", "Memory", Database],
] as const;
export function Shell({
  page,
  onNavigate,
  children,
}: {
  page: Page;
  onNavigate: (p: Page) => void;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => onNavigate("wheel")}
          aria-label="Orbit home"
        >
          <BrandMark />
          <span>Orbit</span>
        </button>
        <nav aria-label="Main navigation">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-current={page === id ? "page" : undefined}
              className={`nav-link ${page === id ? "active" : ""}`}
              onClick={() => onNavigate(id)}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`nav-link ${page === "settings" ? "active" : ""}`}
            onClick={() => onNavigate("settings")}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="workspace-bar">
          <button className="mobile-brand" onClick={() => onNavigate("wheel")}>
            <BrandMark small />
            Orbit
          </button>
          <span className="workspace-label">
            <i />
            Your creative workspace
          </span>
          <button
            className="workspace-control"
            onClick={() => onNavigate("settings")}
          >
            <Monitor size={16} />
            <span>Local workspace</span>
            <ChevronDown size={14} />
          </button>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[...nav, ["settings", "Settings", Settings] as const].map(
          ([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => onNavigate(id)}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={20} />
              <span>
                {id === "library" ? "Ideas" : id === "wheel" ? "Wheel" : label}
              </span>
            </button>
          ),
        )}
      </nav>
    </div>
  );
}
