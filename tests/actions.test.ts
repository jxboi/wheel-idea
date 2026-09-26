import { describe, it, expect } from "vitest";
import * as actions from "../src/lib/actions";
import { pickCategory } from "../src/lib/wheel";
import { previewBrief } from "../src/lib/preview";
import {
  categories,
  emptyWorkspace,
  type Idea,
  type Workspace,
} from "../src/lib/schema";

let n = 0;
const clock = { now: () => "2026-09-26T00:00:00.000Z", id: () => `id${n++}` };
function idea(id: string): Idea {
  return {
    ...previewBrief("Games", "A weekend", ""),
    id,
    category: "Games",
    createdAt: "",
    provider: "preview",
    model: "",
    effort: "default",
    duration: "A weekend",
    saved: false,
    feedback: [],
    rating: null,
    researchStatus: "preview",
  };
}

describe("workspace actions", () => {
  it("records feedback on the idea and as forgettable memory", () => {
    let w: Workspace = actions.addIdea(
      structuredClone(emptyWorkspace),
      idea("a"),
    );
    w = actions.addFeedback(w, "a", "More co-op please", clock);
    expect(w.ideas[0].feedback[0].text).toBe("More co-op please");
    expect(w.memories[0]).toMatchObject({ source: "feedback", ideaId: "a" });
    w = actions.deleteIdea(w, "a");
    expect(w.ideas).toEqual([]);
    expect(w.memories).toEqual([]);
  });
  it("leaves untouched records with the same identity", () => {
    const w = actions.addIdea(
      actions.addIdea(structuredClone(emptyWorkspace), idea("a")),
      idea("b"),
    );
    const next = actions.updateIdea(w, { ...w.ideas[0], saved: true });
    expect(next.ideas[1]).toBe(w.ideas[1]);
    expect(next.ideas[0]).not.toBe(w.ideas[0]);
  });
  it("labels research honestly", () => {
    const url = "https://a.dev";
    expect(actions.researchStatusFor("preview", [])).toBe("preview");
    expect(actions.researchStatusFor("openai", [])).toBe("uncited");
    expect(
      actions.researchStatusFor("openai", [
        { title: "", url, verified: false },
      ]),
    ).toBe("unverified");
    expect(
      actions.researchStatusFor("openai", [
        { title: "", url, verified: false },
        { title: "", url, verified: true },
      ]),
    ).toBe("cited");
  });
});

describe("category selection", () => {
  const sequence = (values: number[]) => () => values.shift()!;
  it("only lands on enabled categories", () => {
    const index = pickCategory(["Wellness"], null, sequence([0, 3, 6]));
    expect(categories[index]).toBe("Wellness");
  });
  it("can skip the previous landing when others are enabled", () => {
    const index = pickCategory(
      ["Games", "Wellness"],
      "Games",
      sequence([1, 1, 6]),
    );
    expect(categories[index]).toBe("Wellness");
  });
  it("still lands on the only enabled category", () => {
    const index = pickCategory(["Games"], "Games", sequence([1]));
    expect(categories[index]).toBe("Games");
  });
  it("keeps equal odds among the remaining categories", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 8000; i++) {
      const c = categories[pickCategory(categories, "Games")];
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    expect(counts.has("Games")).toBe(false);
    for (const count of counts.values())
      expect(Math.abs(count - 8000 / 7)).toBeLessThan(200);
  });
});
