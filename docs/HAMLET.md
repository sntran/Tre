# The activities of Xóm Ruộng and the feast of the new rice

After the planting (`docs/PLANTING.md`), Xóm Ruộng has three more activities. Each one has its own picture of multiplication and its own action of the child. All four use the one memory of the facts. The feast of the new rice links them.

| Activity | The picture of multiplication | The action of the child | The person |
| --- | --- | --- | --- |
| The planting | Rows and columns (an array) | Carry bundles to the plot | The planter |
| Feeding the ducks (cho vịt ăn) | Equal groups (each duck eats the same) | Hold the action button at the jar to pour feed into a trough | The duck girl |
| The fish traps (đặt lờ) | A missing factor (how many traps) | Put traps at the stakes in the stream | The fisher uncle |
| The drum dance (múa trống) | Skip counting (the multiples, in time) | Press the action button at the bronze drum on the beats | The old drummer |

| Part | File |
| --- | --- |
| The rules of the three activities and of the feast (pure, no DOM) | `src/core/hamlet.js` |
| The numbers | `data/world/hamlet.json` |
| The activities in the world: the trough, the traps, the dance | `src/core/world/systems/hamlet.js` (the system `hamlet`, before `work`) |
| The sets in the session, the memory, the lines, the feast table, the feast | `src/core/hamlet-session.js` |
| The small example of each station (the numbers, the script, the places) | `src/core/examples.js`, `examples` in `data/world/hamlet.json` |
| The places on the map (trough, jar, traps, spots, weir, drums, dancers) | map E in `tools/maps/era1.py`, `data/maps/xom-ruong.json` (the houses of the duck girl and of the planter stand away from the stations, so that the view can see each station with no house in front, #38) |
| The names of the people (Cô Năm, Chị Ba, Chú Tư, Ông Cả) | `kin` and `order` in `data/npcs.json`, `data/world/naming.json` (`docs/WORLD.md`, "The names of people") |
| The looks: trough, feed, jar, traps, spots, weir, bronze drum, feast table, dancers | `thingLook` and `workThing` in `src/world/figures.js`, `data/figures.json` |
| The hop of a dancer | `src/render/figure3d.js` |

## Feeding the ducks

- The talk of the duck girl opens a set. A line of ducks stands along a long trough on the shore of the pond. In a bubble, the duck girl says the share of one duck ("Mỗi con ăn ba gáo."). Big ducks eat twice the share of a small duck.
- **The child holds the jar** (the finger stays on the jar, or the command `hold`). While the child holds it, the feed fills the trough one scoop at a time (two and a half scoops a second), with a small sound for each scoop. Each fifth scoop has a notch on the side of the trough, and each tenth scoop has a bigger notch. The child lets go at the total.
- The feed runs along the trough, and each duck eats its share in turn:
  - **just right:** every duck eats, and the trough is clean; the duck girl says the total as a word;
  - **too few:** the last ducks have nothing and look at the child; the next pour goes on from where it stopped;
  - **too much:** the extra feed stays at the end of the trough, and the chickens come for it.
- **Forms:** equal groups (ducks by scoops); twice as much (big ducks, at most half a line); two kinds of ducks in one line (white ducks eat two, brown ducks eat five: the sum of two products).
- **Link:** each duck that ate lays an egg at the next dawn; the eggs go to the feast table.

## The fish traps

- The talk of the fisher uncle opens a set. In a bubble he says the fish that the feast needs ("Mâm cỗ cần hai mươi con cá."). His traps lie on the bank. A small trap catches two fish, a middle one five, and a big one ten: the rings on a trap show its size.
- **The child carries traps** to the stakes in the stream (the place system and the zone rule `spots`: one trap at each stake; a ghost of the trap shows at the free stake in front of the hero, and the button puts it there). With empty hands, the button at a trap in the stream takes it up again.
- The action button at the fisher uncle (the weir) opens the gate of the small weir upstream; the fisher uncle opens it. The traps fill one after another, each with its number of fish:
  - **just right:** the fish are what the feast needs, and no trap is empty;
  - **too few:** the full traps stay; the fisher waits for another trap;
  - **too many:** the fisher keeps the fish of the feast, and the extra fish swim on, free.
- **Forms:** traps of one size (a missing factor: the feast needs twenty, the traps catch five); traps of two sizes (more than one placement is right); at the top, the fisher has room for only a given number of traps, and the child chooses their sizes.
- **Skill:** `math.div.10` for the traps of one size, always with a friendly size (two, five, or ten); `math.mul.10` for the other forms. The facts go to the one memory.
- **Link:** the fish go to the feast table.

## The drum dance

- The talk of the old drummer opens a set. The dancers stand in a line in the đình yard, and the number of dancers in a group is its number. In a bubble, the drummer says the group ("Nhóm này có ba người. Cứ ba nhịp thì nhảy một lần.").
- The first press of the button at the bronze drum starts the slow beat of the drummer on his small drum. **The child presses the button at the bronze drum on the beats where the dancers jump** (three, six, nine, and on, up to ten times the number). A press counts for a beat in the window of the beat.
  - On a right beat, the dancers of the group jump.
  - On a missed or wrong beat, the dancers stop with a laugh, and the drummer starts again from the last good jump, a little slower.
  - When the child does not press for two targets, the drummer stops and waits; the next press starts again from the last good jump.
- No score and no fail. The beat follows the child: slower after a miss, a little faster after a clean run, never faster than the fastest beat. The beat stays for the next dance (`period` in the profile).
- **Forms:** one group (the multiples of one number); the middle of the song (from five times the number); two groups at once, each with its bronze drum: on a common multiple a beat on either drum makes both groups jump.
- **The memory:** a dance is one commit. The fact of the group goes to the memory (right when the run is clean), and so does the fact of each beat that the child missed.

## A small example first

At the start of the first round of a visit, the person of a station does the work one time on a smaller instance next to the station, and then the child does the own round (#37). Pointing is not enough for a child who has never seen the task: guided doing with worked examples wins over discovery with no help (Alfieri et al. 2011), and rule 9 of `docs/research/learning-by-doing.md` says to show on another instance.

| Station | The example |
| --- | --- |
| The planter | A small plot of two rows of two seedlings beside her, one bundle for each row; she says the count as words |
| The duck girl | A line of two ducks at a small trough of her own; she pours the feed scoop by scoop and counts, and the ducks eat in turn |
| The fisher uncle | A small order: two traps of two in the stream, upstream of the plank bridge; the weir opens, and he counts the fish |
| The old drummer | One short dance with a small drum and dancers of his own: the dancers jump on every second beat, three times |

- **The button picture of each act** shows over the person while the person does it (the world event `shows`; the view puts the picture in a bubble over the line of the person): pick, put, plant, pour, the weir, the drum.
- **The numbers of the example are never the numbers of the round of the child.** When the round of the child has the same fact or the same total (for the dance: the same group), the example takes the next try of `tries` in `data/world/hamlet.json` (two rows of three, two ducks of three scoops, two traps of five, a group of three), else other small numbers (`exampleNumbers`).
- **The example never touches the place of the child.** Its things stand at their own place (`examples` in `data/world/hamlet.json`: a place of the station, moved by `dx` and `dz`), on free ground that the camera sees, away from where the child stands to talk. The round of the child waits until the example ends; then the example goes, with all its things, and the round starts (the world event `example` with `done`).
- **One time in a visit** for each station. The same rule holds for a new station: give it a place and tries in `examples`, and its steps in `exampleSteps`.

## One memory, and the people point to each other

- All four activities use the memory of the facts of the planting (`profile.facts['math.mul.10']`). There is one round of the commits of all the activities (`profile.factRound`). A missed fact comes back in a few commits, in any activity and in another picture: a fact missed as an array comes back as equal groups.
- At the end of a set, the person of the station points to another station in one bubble ("Chị Ba ở ao đang cần người cho vịt ăn đấy."). The line points to the activity of a missed fact, but never to the station where the child missed it; with no missed fact, it points to the station that the child played least. The child is never sent; the child chooses.
- **The mentors** (`data/world/mentors.json`, `docs/MENTOR.md`): the duck girl (`trial-ducks`, the plain family; she counts the scoops of the first duck aloud), the fisher uncle (`trial-traps`, the groups family; he counts the rings of the traps in the stream, puts one trap or some traps for the child, or shows other traps on the bank), and the old drummer (`trial-drum`, the plain family; he counts the beats with the child). Each one says another station when a picture fits the error better, helps less after each success, and remembers what helped this child.

## The feast of the new rice

- **The feast table** stands in the yard. It shows what the activities gave: eggs (from the ducks, at the dawn after a feeding), fish (from the traps), and a sheaf of the new rice for each plot that the child planted. Nothing is locked; the child goes to any station at any time.
- **At dusk of a day when the table has eggs, fish, and new rice**, and the child is in the hamlet, the feast begins: the old drummer says one line, the people of the hamlet stand around the table in two rings, and the rings jump in turn on the beats of the drum, for an hour and a half of the game. After the feast the table is empty again.
- A first feeding of the ducks gives no feast that dusk: the eggs come the next morning.

## Repeatable, never the same

Each activity takes its fact from the memory and its form from the level and the forms of the set (no form three times in a row; a form that the child did many times comes less often). Each set has one small event at most, from the seed, never the same in two sets in a row: a duck runs off to the path, a kingfisher sits on a stake, a child of the hamlet comes to watch the dance. Each event is a bubble of the person and a thing for the round. A set ends at a natural stop: the rounds of the set (four, four, and three), noon, or the rain.

## The rule of the world

No question, no number field, no digit, and no score in the world. The numbers are what the child can see (ducks, notches, rings, dancers) and the words of the people. Each commit goes to the log with the time to commit and the efficient first-try success (rule 19). The parent sees one table of the facts, filled by all four activities.

## Practice links

`cho-vit-an` (the duck girl), `dat-lo` (the fisher uncle), and `mua-trong` (the old drummer), each with one set and the choice to stay or go back. `xom-ruong` starts in the yard with no prologue: the head of the hamlet greets the child, says that each person here has work, and points at the four stations one after the other (`docs/WORLD.md`). A star stands over each person of a station, and the child walks to any station.

## Tests and stories

`tests/hamlet-tasks.test.js` covers these rules:
- the ducks: the share of each duck, the hungry ducks, the extra feed, and the pour that goes on;
- the traps: the fish of each trap, more than one right placement, the extra fish, and the given traps;
- the drum: a beat right only on a multiple, a miss that starts again from the last good jump, slower, a clean run that ends faster, and two groups together on the common multiples;
- the feast: the eggs at the next dawn, and the feast only at dusk of a day with all three;
- one memory: a fact missed in the planting comes back in the ducks;
- the small events.

`tests/examples.test.js` checks the small examples: the numbers are never the numbers of the round of the child, each act has its button picture, the round of the child waits for the end of the example, and after the example the place of the child has no part of it. `tests/plant.test.js` checks the one round of the memory. `tests/practice.test.js` checks the practice links and the greeting of the whole hamlet. The stories are `practice-cho-vit-an`, `practice-dat-lo`, `practice-mua-trong`, and `xom-ruong-feast`.
