import { categories, type Category } from "./schema";
export function landingRotation(previous: number, index: number, count = 8) {
  const target = 360 - (index + 0.5) * (360 / count);
  return previous + 360 * 5 + ((target - (previous % 360) + 360) % 360);
}
export function chooseCategory() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % 8;
}
/**
 * Pick a wheel index among the enabled categories with equal odds. Rejection
 * sampling keeps the draw unbiased. When `exclude` is set and another category is
 * enabled, that category is left out of the draw.
 */
export function pickCategory(
  enabled: readonly Category[],
  exclude: Category | null = null,
  random = chooseCategory,
) {
  const pool =
    exclude && enabled.some((c) => c !== exclude)
      ? enabled.filter((c) => c !== exclude)
      : enabled;
  if (!pool.length) throw new Error("Choose at least one category.");
  let index = random();
  while (!pool.includes(categories[index])) index = random();
  return index;
}
