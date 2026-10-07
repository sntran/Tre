# Raids: the defense of the village

The raids replace the battle screen. A raid is light real-time play on the map of the village: the enemies walk on the road to the gate, and the child stops them with the hands, the slingshot, the gate, the villagers, Nghé, and the elements. No question, no answer, no menu, and no numeral shows. `docs/DESIGN.md` ("Battles: defense of the village") is the source of truth.

| Part | File |
| --- | --- |
| The numbers of the raids, the enemies, the places, and the skills | `data/raids.json` |
| The pure rules (the arc, the hits, the traps, the gate, the tells, the elements, the phases) | `src/core/world/raids.js` |
| The raid in the world state (enemies, stones, torches, fires, posts, traps, sources) | `src/core/world/systems/raid.js` |
| The start from an encounter, the taps, the drags, the end, and the loss | `src/core/session.js` |
| The slingshot drag with its counted band, the flow of an element, the dots over the enemies | `src/ui/raid.js` |
| The figures of the raid | `raidThing` in `src/world/figures.js` |
| The stories | `tests/stories/raid-*.json` |

Units: half blocks (one map cell is 2) and seconds. The places in the data are in map cells.

## How a raid goes

1. The child taps an enemy of the map (an encounter). The narrator says one line, and the raid starts on this map: the hero stands at the wall (the slingshot spot), and the enemies come from the end of the road, one wave after the other. The first time that a tool comes, the elder or the smith says one line about it (the flag `raid.tool.<tool>`), and in a raid with traps a villager names the post for a trap.
2. The enemies walk to the gate on a straight path. They never run. Each enemy has dots over its head, one for each hit that it can still take.
3. An enemy with no hits left retreats and walks away. A creature (the river serpent) becomes calm and swims away. An enemy at the gate takes a bowl of rice from the store and leaves (nothing at grade 1; see the loss rule below).
4. The map of the country only pauses the raid: one line says where the enemies are ("The scouts are at the gate."), and there is no travel. Nobody is hurt. Nothing that the child built is changed.
5. The raid ends when the last enemy is gone. It is won when no more than `allow` enemies (and torches) got in. A win gives its flags and gifts, a short note with its seal (Legend or History), and its talks. A raid with loot leaves a pile of small sacks of rice behind the wall: the child shares it with Nghé and Gióng (`docs/TASKS.md`), and the talks come after the share. A lost raid comes again at the next dawn (the flag `raid.<id>.back`), so that the child sleeps on it.

The time limit never sends the hero home in a raid: the rest waits until the raid is over.

## A raid that a child can win (#55)

The story never stops at a raid. The session counts the raids of each tool (the flag `raid.used.<tool>`) and the lost raids of each kind (`raid.<id>.lost`), and `createRaid` in `src/core/world/raids.js` takes the rule (`easy`):

- **The first two raids of a tool, and every raid after a loss:** each enemy stops at each post for some seconds (4; 6 after a loss), so that the child can count the post and press. The next wave comes only when no enemy walks to the gate.
- **After a loss:** the next raid of that kind has one enemy less (one always comes).
- **After two losses:** a helper stands at the wall (the fisher at the river, the smith in the village; Gióng does not move before the envoy comes) and gives each enemy one hit when it comes, and the child can still win.
- **One new tool in a raid:** the first raid of the slingshot has no gate, whichever raid comes first.

## The tools of the child

The tools come one raid after the other (rule 11: one new part at a time). A tool that is not in the raid is not on the map.

| Raid | Tools |
| --- | --- |
| `scouts` (the first raid) | the slingshot, the gate |
| `patrol` | + the traps |
| `soldier1` | + the villagers, Nghé (no gate at the crossroads) |
| `soldier2` | + water, fire |
| `boss` | + lightning, the bamboo |
| `river` | the slingshot, with rice balls |

| Tool | What the child does | What the world does |
| --- | --- | --- |
| The slingshot | The big button: each press adds one post to the pull (five half blocks, one red band); the stone flies one second after the last press, or at once after a tap on the hero (#55). Or a finger on the hero, pull back, let go: the fine pull. While the child sets a pull, the posts up to the pull light up (also at night), and a small ring lies on the road at the count. | The band stretches in steps of one half block: a tick at each step and a red band at every fifth, the same marks as the posts. No arc shows before the shot. The stone flies from the wall along the road on a real arc and lands exactly at the count. It hits the enemy there (within 1.5 half blocks); a stone that misses lies on the road for a moment, so short or long shows against the posts. The hero walks back to the wall for a shot. |
| The prediction | Before the first shot of a raid, tap the post nearest the enemy. | The posts have yellow caps until the tap. The prediction (the post, the distance of the enemy, the count of the first shot, and the result) goes to the log. A first shot with no tap skips it. |
| The distance posts | (They stand by the road.) | Four posts at 5, 10, 15, and 20 half blocks from the wall, with one, two, three, and four red bands. No numeral. |
| Bamboo traps | Carry a trap from the pile, and tap the road. | The trap snaps to the middle of the road on the half-block grid. A scout or a soldier that steps on it sits down for some seconds, and the trap snaps shut. The general breaks a trap. A villager names one post ("Put a trap at the third post"); a trap put there is counting. |
| The gate bar | Tap the gate. | The bar comes down for three seconds, then it lifts. A torch that lands on the bar falls on the road and burns there. |
| Villagers | Tap a straw flag by the road. | A villager walks to the spot. Each enemy that passes stops for a moment, once. |
| Nghé | Tap Nghé (once in a raid). | Nghé runs at the first enemy, butts it (one hit), and pushes it back along the road. |
| Water | Drag from the jar to a point. | The ground there is wet for some seconds; a fire there goes out. |
| Fire | Drag from the brazier (or a torch that burns on the road) to a point. | A soldier there raises his wet shield (stones bounce off it for some seconds, and it drips: wet ground). Other enemies take a hit. Fire on wet ground dries it. |
| Lightning | Drag from the forge to a point. | Into wet ground: every enemy in the wet ground is shocked (one hit each). On dry ground: only a spark. |
| The bamboo | Tap it (the last phase of the boss). | Gióng pulls it up and strikes; every enemy retreats. |
| Rice balls | The same pull, at the river. | A little river serpent that eats two swims away calm. No stones at creatures. |

## Tells and reactions

- A scout near the gate lights a torch and holds it up for two seconds (the tell), then throws it at the gate. Over an open gate the torch lands inside and costs one loss.
- A stone that misses lies on the road for a moment.
- A soldier raises his wet shield after fire.
- The general lifts his staff for two seconds before a big blow. The hero in reach is pushed back, and Nghé lowers her horns. (The art rules give soldiers blunt staffs, no blades.)
- A scout on a trap sits down. A trap snaps with a sound.
- A hit pops up as red dots over the enemy.
- An enemy at the gate takes a bowl of rice: it flies from the basket of the HUD to the enemy.

## The raids of Era 1

| Raid | Map | The road | Enemies | After a win |
| --- | --- | --- | --- | --- |
| `scouts` | Phù Đổng | The east road to the gate | Four scouts with torches | `scouts.won`, iron (for the iron horse) and rice, the talk `scouts.won` |
| `soldier1` | Trâu Sơn | The north field path to the crossroads | Three soldiers (Gióng at the side of the hero) | `soldier1.won`, the loot: seven sacks of rice to share |
| `soldier2` | Trâu Sơn | The south field path to the crossroads | Three soldiers (Gióng at the side of the hero) | `soldier2.won`, the loot: ten sacks of rice to share |
| `boss` | Trâu Sơn | The path from the camp at the foot of the mountain (after the bamboo staffs) | Three soldiers, then the general | `era1.boss.won`, the loot: twelve sacks of rice to share, the note and the fact of history, the talk `giong.north` |
| `river` | Phù Đổng | The river to the ford | Two little river serpents (they become calm) | `river.calmed`, the talks of Sóng |
| `patrol` | Phù Đổng | The east road to the gate | Two scouts (again and again) | Rice and bamboo |

The boss has phases: the soldiers first; then the general comes (Gióng stands at the side of the hero); after three hits the general stands stunned, the iron whip breaks (the talk `staff.breaks`), and a bamboo clump grows by the path. A tap on it: Gióng pulls it up (the talk `bamboo.found`) and strikes, and the raid is won.

The second soldier raid has a jar and a brazier, and the boss adds the small forge of the smith by the crossroads ("I brought my forge to the crossroads"), so that the child can use the whole chain of the elements there.

## Skill events

Each commit is one skill event for the learner (the child never sees it):

| Commit | Skill | Solved | Level |
| --- | --- | --- | --- |
| The first shot at an enemy | `math.count.120` (at raid level 3: `math.add.20`) | The stone hit that enemy | 1 up to 20 half blocks, else 2 |
| The next shot after a miss at the same enemy (a correction: the difference on the road) | `math.count.120` at raid level 1, else `math.add.20` | The stone hit | By the size of the correction: up to 5, up to 10, more |
| A trap put at the post that the villager named (once in a raid) | `math.count.120` | Yes | 1 |
| Lightning | `sci.matter.states` | Wet ground was there | 1 (efficient: two or more enemies) |

The gate is timing: it sends the fact `gated` and no skill event. A trap put anywhere else, and a trap that snaps, send nothing. The prediction before the first shot is a `prediction` event of the log. The raid level comes from the grade that the player gave (`grades` in `data/raids.json`): grade 1 and lower is level 1.

## The loss rule

An enemy at the gate takes what the raid says (`take`, one bowl of rice; nothing at the river), by the loss rule of the profile (`lossLevel` in `src/core/profile.js`): nothing at grade 1 and lower, twice as much when a parent sets the losses to "normal". Never a friend, a machine, or a title. The rice never goes below zero.
