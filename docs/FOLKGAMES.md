# The folk games of the village children

The children of the villages play folk games, and the hero can join (#30): nhảy lò cò (hopscotch) on a court by the road outside the east gate of Phù Đổng, and nhảy dây (jump rope) at the feast of Xóm Ruộng. These are folk games that children played in the villages or along the way, in every era. The narrator says nothing about their age (no history note).

The math is inside the play. The child never reads a numeral or a question: the children say the numbers as words.

## Why

- **The court of nhảy lò cò is a number line.** The Vietnamese court has ten squares: 1 to 5 up one side and 6 to 10 back down the other, with a half circle to rest at the top ([Du lịch Việt Nam](https://www.dulichvn.org.vn/index.php/item/14698)). A linear number board game improves the number knowledge of young children, and a circular board does not ([Laski & Siegler 2014](https://siegler.tc.columbia.edu/wp-content/uploads/2019/02/2014-Laski-Siegler.pdf)).
- **Count on, not from one.** Children who counted on from the square of their piece improved; children who counted from one at each move did not (same source). So the children say the number of each square where the hero lands, never "one, two, three" of the hops.
- **The real body moves the most.** First graders who walked a number line on the floor learned more than with the same training with no whole-body movement ([Link et al. 2013](https://www.sciencedirect.com/science/article/abs/pii/S2211949313000197)). A tap on a tablet is not that, so the weekly note of the parent page suggests the real game.
- **Counting by groups** (2s, 5s, 10s, then 3s and 4s) is a strategy on the way to the facts of multiplication (`docs/research/learning-by-doing.md`).

## Nhảy lò cò

- **The court** (`hopscotch` and `hopscotch-to` in the places of `phu-dong`, `tools/maps/era1.py`): ten squares of one cell, drawn with a stick in the packed earth (the ink lines of `src/render/folk3d.js`), and the half circle at the top. No numeral is on the court. Three children of the village (`npc:loco-child`, Tí, and two friends) stand by it.
- **Join:** when the hero comes near, Tí asks in words ("Vào chơi lò cò với tụi mình đi!"). The action button (the picture of the talk) joins the game.
- **The call:** a child calls a square ("Ô bảy mươi bảy!"), or, at the levels of addition, a square as a number more than another one ("Ô năm, rồi thêm hai ô nữa!").
- **The throw:** the child holds the action button (the picture of the shard) and lets go. The longer the hold, the farther the shard goes (`rate` in `data/world/folkgames.json`), as the pour of the jar. In the called square: the hero goes. In another square: the children say the number of that square, and the turn goes to the next child. On a line or out: the children laugh, and the turn goes to the next child. Nothing is lost.
- **The hops:** each press of the jump button hops one square forward. The hero must never land on the square of the shard: a long press of the jump (`long`, in seconds) hops two squares, over it. A long hop over a square with no shard, a landing on the shard, or a press before the hero stands again (`settle`: a landing on a line) ends the turn, with no loss. At the half circle the hero turns; on the way back the hero picks up the shard from the square before it, and hops over its square again.
- **The numbers:** the children say the number of each square where the hero lands: "bảy mươi sáu, bảy mươi tám, bảy mươi chín" (count on past the shard).
- **A set:** three rounds there and back (`rounds`). In a practice, Tí then thanks the child, and the child chooses to stay or go back.

### By level

The skill of the game is the first skill of the game (in the order of the grades) that the child can learn now and does not know yet (`skillOf` in `src/core/folk-session.js`). Each skill has its courts (`levels`):

| Skill | Courts |
| --- | --- |
| `math.count.120` | a court of ten from one, or from a larger number that the children choose ("Hôm nay sân bắt đầu từ ba mươi sáu nhé."), so that the child counts on past a ten |
| `math.add.10`, `math.add.20` | the call is a number more than another one ("Ô năm, rồi thêm hai ô nữa!") |
| `math.addsub.100`, `math.place.1000` | a court that counts by tens, by fives, or by twos |
| `math.mul.10` | a court of twelve that counts by threes or by fours |

Other children, other courts, other starting numbers, and other calls make each set new. The numbers of a court go to 150 at most (the words `num.*` of the language files).

### The children as peers

The children are peers, not tutors, but they read the errors as the mentors do (#24): after two landings on the shard, or two long hops over a square with no shard, an older child shows the skip once, on another square (`demo`). After two presses too soon (mashing), the children draw a shorter court (`short`: eight squares) and say "Nhảy từ từ thôi."

## Nhảy dây

- **The rope** (`rope` and `rope-to` in the places of `xom-ruong`): two children (`npc:rope-child`, Cò, and a friend) turn a long rope at the feast of the new rice (#23), and in a practice of the rope. The rope touches the ground at each beat.
- **The goal:** the children name the number to reach ("Nhảy đến năm mươi nhé!").
- **The jumps:** a press of the jump on the beat (when the rope is at the bottom, within `window` seconds) is one group more, and the children chant it: "năm, mười, mười lăm, …". A jump between two beats, or no jump at a beat while the hero is in the rope, is a miss: the rope stops on the feet, then turns again a little slower (`slower`), and the chant goes on from the last good jump ("Đếm tiếp từ mười lăm nhé."). Nothing is lost.
- **By level:** twos (`math.count.120`, `math.add.10`), twos or fives (`math.add.20`), fives or tens (`math.addsub.100`, `math.place.1000`), threes or fours (`math.mul.10`), and six to nine (`math.mul.fluent`), ten jumps to a round. A clean round makes the next one a little faster.
- **Mashing:** two jumps off the beat in a row: the children turn the rope slower and say "Dây chạm đất thì nhảy."
- **A set:** two rounds.

## The learning log and the parent page

- Each throw and each turn of the court, and each round of the rope, is one event of the skill of its level (`skillEvent` in `src/core/session.js`: the learner and the learning log, as the other tasks).
- The profile keeps the day when the child last played each game (`profile.folk`). The weekly note of the parent page (#25) says so, with one line from the practice activity (`real`: `folk.real.nhay-lo-co`, `folk.real.nhay-day`): draw the same court with chalk and play it for real, and say the numbers aloud; jump rope for real, and count aloud by groups.

## Practice links

`?practice=nhay-lo-co` and `?practice=nhay-day` (`data/world/practice.json`) open each game at once, with the child who talks there.

## The parts

| Part | File |
| --- | --- |
| The rules (court, throw, hops, rope) | `src/core/folkgames.js`, `data/world/folkgames.json` |
| The games in the session (children, join, calls, mentor loop, log) | `src/core/folk-session.js` |
| The court lines and the rope | `src/render/folk3d.js` |
| The looks of the children and of the shard | `data/figures.json`, `thingLook` in `src/world/figures.js` |
| The jump: a press, and the length of the press (`jumpUp`) | `src/ui/village.js` |

## Tests

- `tests/folkgames.test.js`: the court in the Vietnamese order and the courts of the levels; the throw; the numbers said are the squares where the hero lands (count on); a landing on the shard, a press too soon, or a long hop over a square with no shard ends the turn; the rope counts a group for a jump on the beat, and a miss keeps the count.
- Stories: `practice-nhay-lo-co` (a throw, a press too soon on a line, the turn again, there and back over the shard three times) and `practice-nhay-day` (jumps on the beat by fives to fifty, one miss, two rounds). The laws of the stories check that no numeral shows in the world.
