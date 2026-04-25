const COLOR_LABELS = [
  { name: 'rossi', r: 220, g: 70, b: 70 },
  { name: 'verdi', r: 80, g: 190, b: 90 },
  { name: 'blu', r: 70, g: 120, b: 220 },
  { name: 'gialli', r: 220, g: 200, b: 70 },
  { name: 'viola', r: 150, g: 90, b: 200 },
  { name: 'grigi', r: 130, g: 130, b: 130 },
];

function closestColorName(rgb) {
  let best = COLOR_LABELS[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const sample of COLOR_LABELS) {
    const d =
      (sample.r - rgb.r) ** 2 +
      (sample.g - rgb.g) ** 2 +
      (sample.b - rgb.b) ** 2;
    if (d < bestDist) {
      best = sample;
      bestDist = d;
    }
  }
  return best.name;
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Adapter inspired by ai-powered-video-analyzer-main:
// collect frame features -> aggregate -> create short narrative summary.
export function buildVisionNarrative(frameSamples = []) {
  if (!frameSamples.length) {
    return 'Vista inattiva: nessun frame analizzato.';
  }

  const brightness = avg(frameSamples.map((s) => s.brightness || 0));
  const motion = avg(frameSamples.map((s) => s.motion || 0));
  const reds = Math.round(avg(frameSamples.map((s) => s.red || 0)));
  const greens = Math.round(avg(frameSamples.map((s) => s.green || 0)));
  const blues = Math.round(avg(frameSamples.map((s) => s.blue || 0)));
  const dominantColor = closestColorName({ r: reds, g: greens, b: blues });

  let lightDesc = 'luce equilibrata';
  if (brightness < 70) lightDesc = 'ambiente buio';
  else if (brightness > 170) lightDesc = 'ambiente molto luminoso';

  let motionDesc = 'poco movimento';
  if (motion > 45) motionDesc = 'movimento intenso';
  else if (motion > 20) motionDesc = 'movimento moderato';

  return `Vista Echo: ${lightDesc}, ${motionDesc}, colori prevalenti ${dominantColor}.`;
}
