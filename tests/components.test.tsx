// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WheelPage } from "../src/pages/WheelPage";
import { IdeaDetail } from "../src/components/IdeaDetail";
import { ActivityPanel } from "../src/features/generation/ActivityPanel";
import { applyEvent, newActivity } from "../src/features/generation/activity";
import { previewBrief } from "../src/lib/preview";
import {
  defaultPreferences,
  defaultSettings,
  type Idea,
  type Preferences,
} from "../src/lib/schema";

afterEach(cleanup);
// jsdom has no modal dialog support; the real browser path is covered in QA.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
};

function renderWheel(preferences: Preferences = defaultPreferences) {
  const onPreferences = vi.fn();
  const onSpin = vi.fn();
  render(
    <WheelPage
      settings={defaultSettings}
      preferences={preferences}
      onPreferences={onPreferences}
      busy={false}
      rotation={0}
      selected={null}
      landed={false}
      activity={null}
      error=""
      onSpin={onSpin}
      onSettings={() => {}}
      onJournal={() => {}}
      onOpenJournal={() => {}}
      onMemory={() => {}}
      onCancel={() => {}}
    />,
  );
  return { onPreferences, onSpin };
}

describe("wheel page", () => {
  it("saves mood and time budget as preferences", () => {
    const { onPreferences } = renderWheel();
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), {
      target: { value: "tiny tools" },
    });
    expect(onPreferences).toHaveBeenLastCalledWith({
      ...defaultPreferences,
      mood: "tiny tools",
    });
    fireEvent.click(screen.getByRole("button", { name: "Go big" }));
    expect(onPreferences).toHaveBeenLastCalledWith({
      ...defaultPreferences,
      duration: "Go big",
    });
  });
  it("keeps at least one category and can avoid repeats", () => {
    const { onPreferences } = renderWheel({
      ...defaultPreferences,
      enabled: ["Games"],
    });
    expect(screen.getByText(/1 of 8 categories/)).toBeTruthy();
    fireEvent.click(screen.getByText(/1 of 8 categories/));
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    expect(onPreferences).toHaveBeenLastCalledWith({
      ...defaultPreferences,
      enabled: ["Games"],
    });
    fireEvent.click(screen.getByRole("switch"));
    expect(onPreferences).toHaveBeenLastCalledWith({
      ...defaultPreferences,
      enabled: ["Games"],
      avoidRepeat: true,
    });
  });
});

describe("idea detail provenance", () => {
  it("labels which sources the search actually found", () => {
    const idea: Idea = {
      ...previewBrief("Games", "A weekend", ""),
      sources: [
        { title: "Real", url: "https://real.dev/a", verified: true },
        { title: "Claimed", url: "https://claimed.dev/b", verified: false },
      ],
      id: "i",
      category: "Games",
      createdAt: "",
      provider: "openai",
      model: "m",
      effort: "default",
      duration: "A weekend",
      saved: false,
      feedback: [],
      rating: null,
      researchStatus: "cited",
    };
    render(
      <IdeaDetail
        idea={idea}
        onClose={() => {}}
        onUpdate={() => {}}
        onFeedback={() => {}}
        toast={() => {}}
      />,
    );
    expect(screen.getByText(/real\.dev · Found by search/)).toBeTruthy();
    expect(
      screen.getByText(/claimed\.dev · Not confirmed by search/),
    ).toBeTruthy();
  });
});

describe("activity panel", () => {
  const base = newActivity({
    duration: "A weekend",
    mood: "tiny tools",
    memory: { notes: 3, recentIdeas: 0, journal: 1, photos: 0 },
  });
  const panel = (activity = base, landed = true) =>
    render(
      <ActivityPanel
        activity={activity}
        landed={landed}
        selected="Games"
        settings={defaultSettings}
      />,
    );
  it("keeps the landing a surprise until the wheel stops", () => {
    panel(base, false);
    expect(screen.getByText("Spinning the wheel…")).toBeTruthy();
    expect(screen.queryByText(/Games/)).toBeNull();
  });
  it("shows what the user shared and what the model is doing", () => {
    let a = applyEvent(base, { type: "started", local: false });
    a = applyEvent(a, { type: "search", query: "cozy puzzle trends" });
    a = applyEvent(a, {
      type: "pages",
      pages: [{ url: "https://www.example.com/post", title: "Post" }],
    });
    a = applyEvent(a, {
      type: "draft",
      text: '{"title":"Pocket Puzzles","summary":"Small daily',
    });
    panel(a);
    expect(screen.getByText("Landed on Games")).toBeTruthy();
    for (const chip of [
      "A weekend",
      "“tiny tools”",
      "3 notes",
      "1 journal entry",
    ])
      expect(screen.getByText(chip)).toBeTruthy();
    expect(screen.getByText("“cozy puzzle trends”")).toBeTruthy();
    const link = screen.getByRole("link", { name: "example.com" });
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("Pocket Puzzles")).toBeTruthy();
    expect(screen.getByText("Writing your brief…")).toBeTruthy();
  });
  it("tells apart pages that share a host", () => {
    const a = applyEvent(applyEvent(base, { type: "started", local: false }), {
      type: "pages",
      pages: [
        { url: "https://www.example.com/trends/2026-report", title: "A" },
        {
          url: "https://example.com/blog/meaning-over-measurement/",
          title: "B",
        },
        { url: "https://other.dev/x", title: "C" },
      ],
    });
    panel(a);
    for (const name of [
      "example.com/2026-report",
      "example.com/meaning-over-measurement",
      "other.dev",
    ])
      expect(screen.getByRole("link", { name })).toBeTruthy();
  });
  it("says so when memory is off", () => {
    panel({ ...base, ingredients: { ...base.ingredients, memory: null } });
    expect(screen.getByText("Memory off")).toBeTruthy();
  });
});
