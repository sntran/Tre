# Xóm Ruộng and the planting of a paddy

Xóm Ruộng is a quiet hamlet north of Phù Đổng for the activities of multiplication. Its first activity is the planting of a paddy (cấy lúa): the child brings just enough seedlings for a marked plot, and the planter plants them row by row. Rows of seedlings are an array, the picture of multiplication. The other activities of the hamlet (the ducks, the fish traps, the drum dance) and the feast of the new rice that links them are in `docs/HAMLET.md`; they share the memory of the facts. Each plot that the child plants gives a sheaf of the new rice to the feast table.

| Part | File |
| --- | --- |
| The hamlet (a hand-made stamp, its frame, and its road) | `tools/maps/era1.py` (map E), `data/maps/xom-ruong.json`, `data/world/land-giong.json` |
| The people of the stations | `data/npcs.json`, `data/world/people.json`, `data/figures.json` |
| The rules of the plots, the memory of the facts, and the judge (pure, no DOM) | `src/core/planting.js` |
| The numbers | `data/world/planting.json` |
| The plots in the world: stakes, bundles, the commit, the rows | `src/core/world/systems/plant.js` |
| The sets in the session: rounds, places in the field, lines, events, the end of a set, growth | `src/core/planting-session.js` |
| The looks: rows of seedlings, bundles, stakes | `thingLook` and `workThing` in `src/world/figures.js` |
| The table of the facts for the parent | `drawFacts` in `src/ui/parent.js` |

## The hamlet

- **A small hand-made stamp near Phù Đổng**, the same in every world (not a historical place, no name of a real person): three houses on stilts around one open yard, a paddy field with a seedbed, a duck pond, a stream with a small bamboo bridge, and a đình yard with a bronze drum (the prop `drum`). A small road goes from the north gate of Phù Đổng to the south edge of the hamlet.
- **Quiet and easy to walk.** Each station is 8 to 12 cells from the middle of the yard, on a wide straight path with no prop in the way. Only the people of the stations live there, and each one stays at the station by day: the planter on the dike of the paddy, the duck girl at the pond, the fisher uncle at the stream, and the old drummer in the đình yard. The frame is quiet (`quiet` in `data/world/land-giong.json`): no hamlet of the land comes within 16 cells of it.
- **The field** of the plots is still water with no seedlings (the ground of a ditch) until the child and the planter plant it. A dike goes across it, so that the field has two bands of plots; each plot stands on a dike, where the child can reach its edge. The seedbed is a field south of the dike, and the bundles lie on the dike by it.
- **The practice links:** `xom-ruong` starts in the yard, and the child walks to any station; `cay-lua` starts at the planter (`data/world/practice.json`). The other people start their own activities (`docs/HAMLET.md`).

## What the child does

1. The talk of the planter opens a set. A round has two plots that are ready (and a bigger plot at levels two and three, for pride, never needed): each one has a bamboo stake for each row along one edge and one for each column along the dike. The child sees the rows and the columns and can count them; nothing is written.
2. The bundles (bó mạ) lie on the dike by the seedbed: at the first level, a bundle has the size of one row of a plot; at the higher levels, bundles of ten and loose bunches of one.
3. The child carries bundles to the edge of a plot (the place rule `exact` of the work system).
4. A tap on the planter is the commit. The planter plants row by row from the bundles at the edge, with a soft sound for each row:
   - **Just right:** the plot is full and no seedling is left; the planter says the total as a word ("Hai mươi bốn cây, vừa đủ!").
   - **Too few:** the planting stops where the seedlings end, the empty cells show, and the planter waits for the rest.
   - **Too many:** the plot is full, and the extra seedlings lie on the dike; the planter takes them back to the seedbed.
5. The next round comes at once. The planted plots stay as paddies: green on the next day, tall after three days, and gold after six (`growth`; `season` is the hook for the harvest of a later issue). When the field is full, the oldest paddy goes (the planter harvests it).

A set has six plots. It ends at a natural stop (rule 28): the end of the six plots, noon, or the rain. Then the planter thanks the child, and a practice ends with the choice to stay or go back.

## Levels and forms

The level of each round is the level of `math.mul.10` that the learner chooses (`levelFor` in `src/core/learner.js`; rule 15). The factor ranges are those of `data/skills.json`; a factor of one is not a plot.

| Level | Factors | Bundles | Forms |
| --- | --- | --- | --- |
| 1 | up to five | one row each; the planter plants the first row as an example | product, rest |
| 2 | up to ten by five | tens and ones | product, rest, choose, turned |
| 3 | up to ten by ten, more hard facts (six to nine) | tens and ones | product, rest, lshape, split, turned, choose |

The forms: **product** (bring the seedlings for a marked plot), **rest** (some rows are planted already: bring the rest), **lshape** (two arrays in one), **split** (two plots side by side, five columns and the rest, with a path between them), **turned** (the same fact turned; the planter says that it has as many as the plot before), **choose** (two marked plots and bundles for only one at the edge: the child taps a stake of the plot that the bundles fill), and **divide** (when `math.div.10` is open: fixed bundles and columns; the child moves the row stakes so that the bundles fill the plot exactly).

## Repeatable, never the same

- **The memory of the facts** belongs to the skill, not to the activity (`profile.facts[<skill>]`): a × b and b × a are one fact. A missed fact comes back later in the same set, in another form; a fact done right goes up one box and comes back after 1, 3, 7, 14, or 30 days (rule 24). A set starts with a sure fact, then mixes the facts to learn with known ones. A fact done right in a set does not come again in that set, and two plots of the same table never come one after another.
- **The form changes while the fact stays:** no form comes three times in a row; a set with fewer than three forms takes a new one; a form that the child did many times comes less often.
- **The child chooses** between the plots that are ready.
- **The field changes:** the plots are a patchwork along the dikes, and the planted plots of the last visits stay and grow.
- **One small event in a set at most**, from the seed, never the same in two sets in a row: ducks walk into the field, a heron on a stake, a neighbor child planted one row, Nghé lies in the mud of the seedbed, a planting song, rice balls at noon, a buffalo plows the next plot (a line of the planter, and a thing for the round).
- Everything is the same for the same seed and the same history.

## The planter works with the child

The planter is a mentor (`trial-plant` in `data/world/mentors.json`; `docs/MENTOR.md`): she waits for the first try, reads the error, and answers with one move of the ladder of her family (`groups`): she points at the empty part, counts the bundles at the edge aloud, shows on another place, puts a bundle or half of what is missing, says that the duck girl puts the ducks into equal flocks (the picture of equal groups), or offers a bigger plot. She helps less after each success and remembers what helped this child.

## The rule of the world

No question, no number field, and no digit in the world. The numbers are the stakes, the bundles, and the words of the planter. A set ends with a thank you and the green paddies, not with a score. The log keeps each commit (the task `trial-plant`, the skill, the parts, the target, and the efficient first-try success; rule 19), and the parent page shows the table of the facts (ten by ten, in three states: exploring, getting there, confident; rule 27).

## Tests and stories

`tests/planting.test.js` (the stakes and the size of a plot, the judge, two plots side by side, the other way, a fact and its turned fact, a missed fact comes back sooner than a known one, no two plots of the same table one after another, at least three forms in a set at a high level and no form three times in a row, the sure first fact and the choice, the events of the sets, the same seed and history), `tests/plant.test.js` (the commit in the world, the memory in the profile, the growth and the save), `tests/hamlet.test.js` (the stations, the straight paths, the people), and the stories `walk-xom-ruong`, `practice-xom-ruong`, `practice-cay-lua`, and `plant-grow`.
