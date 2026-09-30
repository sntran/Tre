# Raids: the defense of the village

The raids replace the battle screen. A raid is light real-time play on the map of the village: the enemies walk on the road to the gate, and the child stops them with the hands, the slingshot, the gate, the villagers, Nghé, and the elements. No question, no answer, no menu, and no numeral shows. `docs/DESIGN.md` ("Battles: defense of the village") is the source of truth.

| Part | File |
| --- | --- |
| The numbers of the raids, the enemies, the places, and the skills | `data/raids.json` |
| The pure rules (the arc, the hits, the traps, the gate, the tells, the elements, the phases) | `src/core/world/raids.js` |
| The raid in the world state (enemies, stones, torches, fires, posts, traps, sources) | `src/core/world/systems/raid.js` |
| The start from an encounter, the taps, the drags, the end, and the loss | `src/core/session.js` |
| The slingshot drag, the dotted arc, the flow of an element, the dots over the enemies | `src/ui/raid.js` |
| The figures of the raid | `raidThing` in `src/world/figures.js` |
| The stories | `tests/stories/raid-*.json` |

Units: half blocks (one map cell is 2) and seconds. The places in the data are in map cells.

## How a raid goes

1. The child taps an enemy of the map (an encounter). The narrator says one line, and the raid starts on this map: the hero stands at the wall (the slingshot spot), and the enemies come from the end of the road, one wave after the other.
2. The enemies walk to the gate on a straight path. They never run. Each enemy has dots over its head, one for each hit that it can still take.
3. An enemy with no hits left retreats and walks away. A creature (the river serpent) becomes calm and swims away. An enemy at the gate takes a coin and leaves (nothing at grade 1; see the loss rule below).
4. The map of the country pauses the raid (the world waits while the map is open). Nobody is hurt. Nothing that the child built is changed.
5. The raid ends when the last enemy is gone. It is won when no more than `allow` enemies (and torches) got in. A win gives its flags and gifts, a short note with its seal (Legend or History), and its talks. A lost raid can come again.

The time limit never sends the hero home in a raid: the rest waits until the raid is over.

## The tools of the child

| Tool | What the child does | What the world does |
| --- | --- | --- |
| The slingshot | A finger on the hero, pull back, let go. | The stone flies on a real arc at one angle; the pull gives the speed. The dotted line shows only the first part of the arc. The stone hits the enemy where it lands (within 1.5 half blocks). |
| The distance posts | (They stand by the road.) | Four posts at 5, 10, 15, and 20 half blocks from the wall, with one, two, three, and four red bands. No numeral. |
| Bamboo traps | Carry a trap from the pile by the gate, and tap the road. | The trap snaps to the middle of the road on the half-block grid. A scout or a soldier that steps on it sits down for some seconds, and the trap snaps shut. The general breaks a trap. |
| The gate bar | Tap the gate. | The bar comes down for three seconds, then it lifts. A torch that lands on the bar falls on the road and burns there. |
| Villagers | Tap a straw flag by the road. | A villager walks to the spot. Each enemy that passes stops for a moment, once. |
| Nghé | Tap Nghé (once in a raid). | Nghé runs at the first enemy, butts it (one hit), and pushes it back along the road. |
| Water | Drag from the jar to a point. | The ground there is wet for some seconds; a fire there goes out. |
| Fire | Drag from the brazier (or a torch that burns on the road) to a point. | A soldier there raises his wet shield (stones bounce off it for some seconds, and it drips: wet ground). Other enemies take a hit. Fire on wet ground dries it. |
| Lightning | Drag from the forge to a point. | Into wet ground: every enemy in the wet ground is shocked (one hit each). On dry ground: only a spark. |
| The bamboo | Tap it (the last phase of the boss). | Gióng pulls it up and strikes; every enemy retreats. |

## Tells and reactions

- A scout near the gate lights a torch and holds it up for two seconds (the tell), then throws it at the gate. Over an open gate the torch lands inside and costs one loss.
- A soldier raises his wet shield after fire.
- The general lifts his staff for two seconds before a big blow. The hero in reach is pushed back, and Nghé lowers her horns. (The art rules give soldiers blunt staffs, no blades.)
- A scout on a trap sits down. A trap snaps with a sound.
- A hit pops up as red dots over the enemy.
- An enemy at the gate takes a coin: the coin flies from the counter to the enemy.

## The raids of Era 1

| Raid | Map | The road | Enemies | After a win |
| --- | --- | --- | --- | --- |
| `scouts` | Phù Đổng | The east road to the gate | Four scouts with torches | `scouts.won`, iron and coins, the talk `scouts.won` |
| `soldier1` | Trâu Sơn | The north field path to the crossroads | Three soldiers | `soldier1.won`, coins and iron |
| `soldier2` | Trâu Sơn | The south field path to the crossroads | Three soldiers | `soldier2.won`, coins and iron |
| `boss` | Trâu Sơn | The path from the camp at the foot of the mountain | Three soldiers, then the general | `era1.boss.won`, coins, the note and the fact of history, the talk `giong.north` |
| `river` | Phù Đổng | The river to the ford | Two little river serpents (they become calm) | `river.calmed`, the talks of Sóng |
| `patrol` | Phù Đổng | The east road to the gate | Two scouts (again and again) | Coins and bamboo |

The boss has phases: the soldiers first; then the general comes (Gióng stands at the side of the hero); after three hits the general stands stunned, the iron staff breaks (the talk `staff.breaks`), and a bamboo clump grows by the path. A tap on it: Gióng pulls it up (the talk `bamboo.found`) and strikes, and the raid is won.

The soldier raids and the boss have a jar, a brazier, and a small forge by the crossroads, so that the child can use the chain of the elements there.

## Skill events

Each commit is one skill event for the learner (the child never sees it):

| Commit | Skill | Solved | Level |
| --- | --- | --- | --- |
| The first shot at an enemy | `math.count.120` (at raid level 3: `math.add.20`) | The stone hit that enemy | 1 up to 20 half blocks, else 2 |
| The next shot after a miss at the same enemy (a correction) | `math.count.120` at raid level 1, else `math.add.20` | The stone hit | By the size of the correction: up to 5, up to 10, more |
| A trap snaps under an enemy | `math.count.120` | Yes | 1 |
| A torch at the gate, when the child tapped the bar for it | `math.count.120` | The bar was down | 1 (efficient: the bar came down after the tell) |
| Lightning | `sci.matter.states` | Wet ground was there | 1 (efficient: two or more enemies) |

The raid level comes from the grade that the player gave (`grades` in `data/raids.json`): grade 1 and lower is level 1.

## The loss rule

An enemy at the gate takes what the raid says (`take`, one coin), by the loss rule of the profile (`lossLevel` in `src/core/profile.js`): nothing at grade 1 and lower, twice as much when a parent sets the losses to "normal". Never a friend, a machine, or a title. The coin never goes below zero.
