export const DEFAULT_PICTURE_MODE = 'clear';
export const DEFAULT_FONT_STYLE = 'arcade';

export function normalizePictureMode(value) {
  if (value === 'clear' || value === 'retro' || value === 'low') return value;
  return value === 'sharp' ? 'clear' : DEFAULT_PICTURE_MODE;
}

export function normalizeFontStyle(value) {
  return value === 'sticker' ? 'sticker' : DEFAULT_FONT_STYLE;
}
