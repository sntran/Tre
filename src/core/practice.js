// The practice links: a link ?practice=<id> takes a child straight to one activity of the world
// (data/world/practice.json), with the own profile of the child. Pure functions, no DOM.
//
// The link holds only the id of the activity: never a name, a profile, or any data of a child.
// The visit puts the hero and Nghé at the place of the activity. At the end of a set, the child
// chooses to stay or to go back; "go back" takes the hero to the place before the visit. The
// position of the profile in the world does not change by a practice unless the child stays.
import { heroPlace } from './world/save.js';
import { levelFor } from './world/trials.js';

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

// The id in the address (location.search). Only the parameter "practice" is read. A bad id is
// null.
export function linkIdOf(search) {
  const id = new URLSearchParams(search ?? '').get('practice');
  return id && ID.test(id) ? id : null;
}

// The activity of an id, or null.
export function activityOf(practice, id) {
  return practice?.activities?.find((a) => a.id === id) ?? null;
}

// The link of an activity: the address of the game (base, with no query) and the id.
export function linkOf(base, id) {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('practice', id);
  return url.toString();
}

// The minute when the visit starts: now, in the hours of the visits (hours: [from, to) of the
// day); at other hours the night goes by, to the first hour of the next morning.
export function visitClock(minutes, hours = [7, 17]) {
  const inDay = ((minutes % 1440) + 1440) % 1440;
  const [from, to] = hours;
  if (inDay >= from * 60 && inDay < to * 60) return minutes;
  const day = minutes - inDay;
  return inDay < from * 60 ? day + from * 60 : day + 1440 + from * 60;
}

// The level of the next round (0, 1, or 2), from the commits of the last round: with no fail it
// goes up, with more fails than half of the commits it goes down, and else it stays.
export function nextLevel(level, { commits = 0, fails = 0 } = {}, top = 2) {
  if (commits > 0 && fails === 0) return Math.min(top, level + 1);
  if (fails * 2 > commits) return Math.max(0, level - 1);
  return level;
}

// The start of a visit for a profile: the map and the cell of the place (on the plane), the
// clock, and the state of the practice for the session: the activity, the place before the visit
// (back: { map, x, y }, or null when the profile has no place yet), and the level of the first
// round (the level of the last visit, or the level of the grade).
export function practiceStart(data, profile, activity) {
  const [frame, x, y] = activity.at;
  const [px, py] = data.world.at(frame, x, y);
  const place = heroPlace(profile.world);
  const back = place.x === null ? null : { map: place.map, x: place.x, y: place.y };
  const last = profile.practice?.[activity.id];
  const level = Number.isInteger(last?.level) ? last.level : levelFor(data.trials, profile.grade);
  return {
    map: data.world.regionOf(frame),
    at: { x: px, y: py },
    clock: visitClock(profile.world.clock.minutes, data.practice?.hours),
    practice: { id: activity.id, trial: activity.trial, task: activity.task, person: activity.person, set: activity.set, level, back },
  };
}

// The rows of the parent page: each activity with its texts, its skills, and its link. All
// activities are there, whatever the era of the child: the parent decides.
export function practiceLinks(practice, base) {
  return (practice?.activities ?? []).map((a) => ({ id: a.id, titleKey: a.titleKey, lineKey: a.lineKey, skills: [...a.skills], link: linkOf(base, a.id) }));
}
