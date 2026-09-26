// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WheelPage } from "../src/pages/WheelPage";
import { IdeaDetail } from "../src/components/IdeaDetail";
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
      status=""
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
