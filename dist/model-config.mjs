// Saved appearance preference; asset availability is owned by the renderer.
export const DEFAULT_MODEL_SET = 'refreshed';
export function normalizeModelSet(value) {
  return value === 'original' || value === 'refreshed' ? value : DEFAULT_MODEL_SET;
}
