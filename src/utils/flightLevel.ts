// Flight Level color gradient: White -> Yellow -> Orange -> Red -> Magenta -> Blue (low to high)
export function flToColor(fl: number | null, minFL: number, maxFL: number, lightMode = false): string | null {
  if (fl === null || minFL === Infinity || maxFL === -Infinity) return null;
  
  const range = maxFL - minFL;
  if (range === 0) return lightMode ? '#333333' : '#ffffff';
  
  const ratio = (fl - minFL) / range;
  
  // Light mode uses darker, more saturated colors for visibility on light backgrounds
  const stops = lightMode ? [
    { pos: 0.0, r: 0, g: 100, b: 0 },      // Dark green (lowest)
    { pos: 0.25, r: 0, g: 150, b: 136 },   // Teal
    { pos: 0.5, r: 33, g: 150, b: 243 },   // Blue
    { pos: 0.65, r: 156, g: 39, b: 176 },  // Purple
    { pos: 0.8, r: 233, g: 30, b: 99 },    // Pink
    { pos: 1.0, r: 183, g: 28, b: 28 },    // Dark red (highest)
  ] : [
    { pos: 0.0, r: 255, g: 255, b: 255 },  // White (lowest)
    { pos: 0.25, r: 255, g: 255, b: 0 },   // Yellow
    { pos: 0.5, r: 255, g: 165, b: 0 },    // Orange
    { pos: 0.65, r: 255, g: 0, b: 0 },     // Red
    { pos: 0.8, r: 255, g: 0, b: 255 },    // Magenta
    { pos: 1.0, r: 0, g: 100, b: 255 },    // Blue (highest)
  ];
  
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  
  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio >= stops[i].pos && ratio <= stops[i + 1].pos) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  
  const localRatio = (ratio - lower.pos) / (upper.pos - lower.pos);
  const r = Math.round(lower.r + (upper.r - lower.r) * localRatio);
  const g = Math.round(lower.g + (upper.g - lower.g) * localRatio);
  const b = Math.round(lower.b + (upper.b - lower.b) * localRatio);
  
  return `rgb(${r},${g},${b})`;
}
