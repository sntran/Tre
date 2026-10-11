// The near view of the child (#84): a band by grade (data/config/game.json, "view"), or the band
// that the parent chose (settings.view). The view sets it at the start of a game and when the child
// comes back from the parent area, never during play (src/world/view.js, setNearView).

// The choices of the parent: by grade, or one of the bands.
export const VIEW_CHOICES = Object.freeze(['grade', 'very-near', 'near', 'middle', 'far']);

// The band of a grade (the band of the nearest grade when a grade has none).
export function bandOf(grade, cfg) {
  const bands = cfg?.bands ?? [];
  const exact = bands.find((b) => b.grades.includes(grade));
  if (exact) return exact;
  const all = bands.flatMap((b) => b.grades.map((g) => ({ g, b })));
  all.sort((a, b) => Math.abs(a.g - grade) - Math.abs(b.g - grade) || a.g - b.g);
  return all[0]?.b ?? null;
}

// The near view (world units on a phone of 390 x 844) of a profile, or null with no bands.
export function nearOf(profile, cfg) {
  const choice = profile?.settings?.view ?? 'grade';
  const band = choice === 'grade' ? bandOf(profile?.grade ?? 1, cfg) : (cfg?.bands ?? []).find((b) => b.id === choice) ?? bandOf(profile?.grade ?? 1, cfg);
  return band?.near ?? null;
}
