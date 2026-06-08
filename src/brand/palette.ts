// palette.ts — Cue's LOCKED palette. Cream enamel + one stock-brown/aubergine ink +
// one ember/paprika-gold accent. NO RED, EVER. A boil-over is amber + a wooden-spoon
// tap; the safety-halt is the score going "cool and still" (a desaturated stock grey).
export const PAL = {
  cream: '#F6F1E7', // base enamel (warm ivory) — the ground
  creamHi: '#FDFAF2', // lit enamel highlight / sheen peak
  panel: '#EFE7D6', // card enamel, one layer down
  panel2: '#E6DBC6', // recessed enamel
  rim: '#D8CBB2', // rolled enamel rim / deckle
  ink: '#3A2A22', // stock-brown / aubergine — primary ink
  ink2: '#5E463A', // mid warm brown (secondary linework, robin body)
  ink3: '#7A6152', // lighter brown (thin construction lines)
  inkSoft: '#9A8571', // faint labels on enamel
  ember: '#E39A3C', // paprika-gold — the accent (heat, "now", gauges, robin breast)
  emberHi: '#F4C67D', // ember highlight / molten peak
  emberDp: '#BC7723', // ember shadow / seam recess
  brass: '#C79A54', // tag plate + the wooden-spoon baton (muted antique brass)
  brassHi: '#E1C185',
  brassDp: '#8C6B2E',
  deep: '#2A1D17', // deepest aubergine (split-flap tiles, night, wing shadow)
  stage: '#33241C', // recessed cook-space / stove-back
  stage2: '#412E23', // stage mid
  still: '#8E877A', // "gone cool and still" — the safety-halt state (never red)
  stillDp: '#5C564C',
  fleck: '#3A2A22', // enamel spatter fleck
};

export type PaletteToken = keyof typeof PAL;
