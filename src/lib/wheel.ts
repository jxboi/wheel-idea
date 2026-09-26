export function landingRotation(previous: number, index: number, count = 8) {
  const target = 360 - (index + 0.5) * (360 / count);
  return previous + 360 * 5 + ((target - (previous % 360) + 360) % 360);
}
export function chooseCategory() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % 8;
}
