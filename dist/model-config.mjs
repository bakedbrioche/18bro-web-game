// Saved appearance preference; asset availability is owned by the renderer.
export const DEFAULT_MODEL_SET = 'original';
export function normalizeModelSet(value) {
  return value === 'refreshed' ? 'refreshed' : DEFAULT_MODEL_SET;
}
