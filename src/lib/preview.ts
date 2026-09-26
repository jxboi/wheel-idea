import type { Brief, Category } from "./schema";
const seeds: Record<Category, [string, string, string[]]> = {
  Productivity: [
    "One Good Thing",
    "A calm daily planner that helps people finish one meaningful task instead of managing an endless to-do list.",
    [
      "Choose one daily focus and break it into three steps",
      "A distraction-free focus timer",
      "An end-of-day reflection with a gentle progress calendar",
    ],
  ],
  Games: [
    "Tiny Worlds",
    "A cozy daily puzzle where players connect little islands into a thriving miniature ecosystem.",
    [
      "A deterministic daily island puzzle",
      "Drag bridges between islands with clear constraints",
      "A shareable spoiler-free result and local streak",
    ],
  ],
  Lifestyle: [
    "The Somewhere List",
    "A personal field guide to the little places you keep meaning to visit in your own city.",
    [
      "Capture a place with a photo and a note",
      "Filter discoveries by mood and available time",
      "Keep a visual journal of places you have explored",
    ],
  ],
  Learning: [
    "Explain It Simply",
    "A pocket-sized learning journal that turns a confusing concept into a clear explanation in your own words.",
    [
      "Capture a concept and your first explanation",
      "Reveal progressive hints instead of full answers",
      "Revisit concepts with a spaced repetition queue",
    ],
  ],
  "Creative tools": [
    "Palette Walk",
    "A color notebook for collecting unexpected palettes from the everyday world.",
    [
      "Extract five colors from an uploaded photo",
      "Name and annotate a palette with its story",
      "Export accessible CSS color tokens and a palette image",
    ],
  ],
  Community: [
    "Small Circles",
    "An intimate check-in space for a small group of people quietly building things together.",
    [
      "Create a circle with a weekly intention",
      "Post a tiny update: built, learned, or stuck",
      "Give thoughtful encouragement without likes or rankings",
    ],
  ],
  Wellness: [
    "A Little Outside",
    "A gentle invitation to take a small outdoor break and notice something you would otherwise miss.",
    [
      "Choose a two-, five-, or ten-minute break",
      "Receive a simple observation prompt",
      "Save a small photo journal of moments outdoors",
    ],
  ],
  Wildcard: [
    "The Side Quest",
    "A playful generator of tiny real-world adventures for an otherwise ordinary afternoon.",
    [
      "Choose your energy, time, and comfort zone",
      "Draw one achievable creative challenge",
      "Capture the outcome in a personal adventure log",
    ],
  ],
};
export function previewBrief(
  category: Category,
  duration: string,
  mood: string,
): Brief {
  const [title, summary, features] = seeds[category];
  return {
    title,
    summary,
    features,
    whyNow:
      "This is a curated offline example, not a researched trend. Connect an AI provider to discover timely ideas with live web sources and personal context.",
    sources: [],
    prompt: `# Build ${title}\n\n## The idea\n${summary}\n\nCreate a mobile-first ${category.toLowerCase()} web app. The build budget is ${duration.toLowerCase()}. ${mood ? `The builder’s direction: ${mood}` : ""}\n\n## Who it is for\nPeople who prefer an intentional, approachable experience with a clear purpose. Design the first session so they experience the main benefit in under a minute.\n\n## Core experience\n${features.map((f, i) => `${i + 1}. ${f}.`).join("\n")}\n\n## Product and visual direction\nUse expressive editorial typography, generous breathing room, and a restrained, accessible palette. Design for a 390px phone first and expand thoughtfully to desktop. Make each action obvious. Avoid generic dashboard cards and unnecessary onboarding. Use subtle motion to communicate change, with a reduced-motion alternative.\n\n## Architecture and data\nUse React and TypeScript with feature-based components. Separate the domain model, persistence, and UI so the app can grow. Start with IndexedDB for personal data. Define versioned schemas and an export path. Keep credentials server-side for any external integrations. Include intentional loading, empty, success, and error states.\n\n## Scope\n${duration === "A few hours" ? "Build one excellent local-first core flow. Defer accounts, cloud sync, analytics, and AI to a later iteration." : duration === "A weekend" ? "Deliver the three core features with local persistence and polished responsive interactions. Defer collaboration and subscriptions." : "Deliver the core flows first, then add authenticated cloud sync behind a separate storage adapter. Ship incrementally."}\n\n## Accessibility and validation\nUse semantic HTML, visible keyboard focus, labels on controls, 44px touch targets, and sufficient contrast. Test the core flow with keyboard and touch, verify saved data survives a reload, and handle corrupt imports without losing existing work.\n\n## Acceptance criteria\n- The primary journey works end-to-end on a phone and desktop.\n- Data persists after refresh, and errors are recoverable.\n- There is no horizontal overflow at 360px.\n- The production build passes and can be deployed to Vercel.\n\n---\nOffline preview: this brief is a curated template. It has not used live search or AI personalization.`,
  };
}
