// The person and the place of the exams of a chapter (data/titles.json, examiners, #134). The
// place of an exam belongs to its time: in Era 1 the messenger of the Hùng King gives the tests at
// the village hall of Phù Đổng; from chapter 7 (the Lý) the exams are at Văn Miếu.

export const VANMIEU = { from: 7, speaker: 'examiner', placeKey: 'exam.place.vanmieu', lines: 'exam' };

// The chapter of the hero: the chapter of the region of the map of the hero (the start region for no
// map). world: src/world/regions.js.
export function chapterOf(world, profile) {
  const id = world?.regionOf?.(profile.world?.map) ?? world?.start?.region;
  return world?.region?.(id)?.chapter ?? 1;
}

// The examiner with the highest first chapter at or under the chapter of the hero:
// { from, speaker, placeKey, lines }.
export function examinerOf(data, profile) {
  const chapter = chapterOf(data.world, profile);
  const list = [...(data.titles.examiners ?? [])].sort((a, b) => b.from - a.from);
  return list.find((e) => e.from <= chapter) ?? VANMIEU;
}

// The examiner of Văn Miếu (the lines of exam.*).
export const vanMieuOf = (data) => (data.titles.examiners ?? []).find((e) => e.lines === 'exam') ?? VANMIEU;

// A line of the examiner: the lines of Văn Miếu (exam.passed), or the lines of the person
// (exam.messenger.passed).
export const lineOf = (ex, name) => `${ex.lines}.${name}`;
