/**
 * Serializes a CSS value the way the DOM under test does (e.g. jsdom 31
 * writes `min(640px, 100vw - 2rem)` as `min(640px, -2rem + 100vw)` and
 * `translateZ(0)` as `translateZ(0px)`), so assertions compare exact values
 * without depending on one engine's serialization.
 */
export function cssValue(property: string, value: string): string {
  const probe = document.createElement('div');
  probe.style.setProperty(property, value);
  return probe.style.getPropertyValue(property);
}
