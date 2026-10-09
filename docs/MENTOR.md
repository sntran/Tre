# The mentor: the person who gives a task works with the child

The person who gives a task watches the child, reads the error, and changes the help or the task, as a teacher in real life does (rules 31 to 41 of `docs/DESIGN.md`; `docs/research/learning-by-doing.md`, "The person who gives the task is a teacher who watches").

| Part | File |
| --- | --- |
| The rules: observations, diagnoses, the help level, moves, memory, checks, and waves (pure, no DOM) | `src/core/mentor.js` |
| The families of tasks, the ladders of moves, and the mentor of each task | `data/world/mentors.json` |
| The mentors in the session: commits, actions, checks, waves, idle time, the log, and the scripts of the moves | `src/core/mentoring.js` |
| The moves in the world: a gesture, a mark, a demonstration, a part put for the child, the cue of Nghé | `src/core/world/systems/mentor.js` |

## The loop

After each commit (and after a plank too long on the bridge, which the world judges at once), and on idle time, the mentor of the task takes the observations, makes a diagnosis, and chooses one move.

**Observations:** the result and the size of the error; the time of the try (from the first action to the commit); resets; leaving the station soon after a miss; misses in a row; the misses of the same fact (the same target); P(L) of the skill before the commit; and the moves that helped this child before (the memory).

**Diagnoses** (each family of tasks says how it reads its commits: `reader` in the data):

| Diagnosis | Signs |
| --- | --- |
| `unsure` (does not know what to do) | No action for `idleStart` seconds at the start of a task |
| `missing` (a missing part) | Off by exactly the size of one part that the child could choose |
| `units` (counts the things, not their units) | As many things as the target, or all the things of the task for a target that is less than their units |
| `slip` | A small error (at most `slip` units) after a normal time |
| `counting` (counting all) | Right, but slower than `slowUnit` seconds for each unit |
| `guess` | Fast (under `fastUnit` seconds for each unit) and far off, or a miss with the mashing flag |
| `stuck` (stuck on a fact) | The same target missed twice |
| `frustrated` | `frustrated` misses in a row, or leaving the station soon after a miss |
| `bored` | `bored` fast clean commits in a row (the same number as for frustration, so that boredom gets an answer as soon) |
| `ready` (ready for more) | Fast and right, with P(L) over `ready` |

**Moves** (one at a time, by the person of the task, with a body and short words; number words are allowed, no digit, no operator, and no question mark):

| Move | In the world |
| --- | --- |
| `wait` | Nothing. The default; the first try belongs to the child. |
| `show` | The person points at the heap, then at the place, with marks on the ground: the action, not the math. |
| `mark` | The person points at each part on the place in turn and says the running total as a word (counting pace), then marks the empty part or the part too many. |
| `cue` | Nghé shows the place: at the bridge, Nghé stands at the near end of the planks and stretches its neck toward the gap (the hint ladder of Nghé is now a source of moves). |
| `demo` | A demonstration on another instance, next to the person, never on the same place: for the cart, another cart with its mud, and the stones of another number, the biggest first, then counting on. A wave ends it after its key part (half of the parts) has shown. The demonstration comes at most one time in a task; after that the move is `smaller` (#69). The teacher ends it with "Đủ mười que, thầy buộc được." (`demoDone`). |
| `smaller` | The person puts one part into the place, and the child does the rest. The teacher puts his rods one at a time, counts them aloud, and then says how many he put ("Thầy đặt hai que. Con đặt tiếp nhé.", `smallerPut`, #69). |
| `share` | The person puts about half of what is still missing, and the child does the rest. Never the whole task. The teacher shows the half with the rods: "Thầy đặt năm que, con đặt năm que nhé." (`sharePut`, #69). |
| `picture` | The person says that another station is there (the child is never sent; the child chooses). When the trial of that station is done (`pictureUnless`), the person says only to rest (`mentor.break`, #57). |
| `raise` | A bigger task next time, once in a task: the next round of a practice is one level higher, and the next event of the same kind is one level higher. A move never makes the task in progress bigger (#32); a help move can make it smaller, and says so. |
| `break` | A break in the story (a rice ball). |
| `count` | The answer of the world to each wrong try, before any other move (#64): the parts on the place counted aloud with the mark of what went wrong, or at the fisher the widest gap of the row, which glows. |
| `tryFirst` | The answer to the first wave before any act of the child in the task: the person watches. A second wave before any act gets `show` (the child is stuck). |
| `offer` | A small offer of help to a child who is stuck after a miss and does not wave (after `offerAfter` seconds). |

**The contingent rule:** after a miss, the help level goes one up; after a success, one down; at mastery (P(L) at or over `mastery`) the person only watches (`wait`), except for boredom and a child ready for more. A miss climbs the ladder of its diagnosis with the help level; the other diagnoses climb with each repeat.

## The voice of the bubbles

A child of six may not read yet, so the voice says every line of a person in a bubble, in the voice of that person (#60, `src/core/bubblevoice.js`): the hints, the waits, and each word of a count. The lines wait for their turn: a hint waits while the talk box speaks, and the words of a count keep their order, so that one number never cuts the last one. A greeting of a person who walks by goes when the voice is busy. A bubble stays while its line waits or is spoken. A tap on a bubble, or on its person while the bubble shows, says the line again.

## The person remembers the child

`profile.mentors[<task>]` keeps the moves that were tried and the moves that helped (a right next commit), for each diagnosis, the usual errors, the self-corrections, and the lift of the task. In a new task, the move that helped this child comes first for its diagnosis, and the person says so as information ("Hôm trước nhìn kỹ chỗ sai là cháu làm được ngay.").

## The checking goes to the child

- **A check is an action:** with empty hands, a tap on a thing that lies on the place of a task (a rod on the mat, a bunch in the basket) is a check. A tap on the place itself (a child who walks to it) is not a check, and a put is never a self-correction (#64: the parent note counted a child who could not find the basket as a child who checked the work). A change after a check that takes a thing off the place, or changes its kind, before the commit is a **self-correction**.
- **The marks fade into the child's own looking:** at first the person marks what went wrong after a miss. After `handover[0]` self-corrections, the person first waits `look` seconds; if the child looks (a check), the mark does not come. After `handover[1]` self-corrections, the person only watches.
- **A wave asks for help, and a wave always helps (#64):** the wave button (a hand, next to the buttons that turn the view) shows at a task with a mentor. Only at the first wave before any act of the child in the task does the person say "Cháu thử trước đã, để xem nào." and watch; a second wave before any act gets `show`, because the child is stuck. After an act, or after a right try, the person shows the next step (`show`: points at the next thing and says it). After a miss, the person answers with the next move of the ladder; a move that does not help (a wait, the offer, try first, the picture of another station) becomes `show`, and a wave never gets a nod. After two same answers in a row, the next wave gets another move that shows the next step (`share` or `demo`), so that the line is not the same again and again. A wave during a count or a demo waits for its end, and no idle move (the offer "Cần giúp thì vẫy tay nhé.") comes in the `AFTER_WAVE` seconds after a wave.

## The count comes first (#64)

After each wrong try, the world answers first with the count of the child's own work, at each help level and before any move of the person (`count`, `countSteps` in `src/core/mentoring.js`): the teacher counts the rods on the mat, the healer counts each row that she lays out, and the fisher points at the widest gap of the row, which glows. At the woodcutter, the two pieces lie side by side, so that the child sees which one is short. The move of the person comes `COUNT_GAP` seconds after the count. While a count or a demo plays, no idle move starts, and no move ends it. A move that waits never starts before the count ends, and while a talk box is open (the world waits), the moves that wait and the idle time wait too (#69: a box stopped the count at four, and then the demo came; the child took four as the count of the mat). After the count of a wrong bundle the teacher says what happens next: with too many rods, "Thừa hai que, thầy để lại đống." while the extra rods roll back slowly one at a time; with too few, "Chiếu còn chỗ trống." while the empty places of the frame glow. He never says the target as a count after a wrong try.
- The pause to look before a commit: the person turns to the place while the child works (the gesture of the moves). There is no timer.

## The log

`help` (the task, the diagnosis, the move, P(L) before, and the next commit: success, efficient), `check` (and whether a change followed it), and `ask` (before or after a try, and the move). The researcher view has the block "Which help works" (`qHelp` in `src/core/learnlog.js`).

## The first users

The bridge (the fisher, and Nghé for the cue), the small events of each day (the carter, the farmer, the seller), and the Five Trials (the teacher, the smith, the fisher, the healer, the woodcutter). The planter of Xóm Ruộng (`trial-plant`, `docs/PLANTING.md`) is one too, and so are the duck girl (`trial-ducks`), the fisher uncle (`trial-traps`), and the old drummer (`trial-drum`; `docs/HAMLET.md`). A mentor can have its own line for a move (`lines` of the mentor), in place of the common line.

## Tests and stories

`tests/mentor.test.js` (the contingent shift, the diagnoses of made-up commits, boredom as fast as frustration, no answer to the same instance, no digit in a line, the memory, the handover, the wave, the offer, the save), `tests/mentoring.test.js` (the log of each move with its outcome, a wave before any try, a self-correction, a tap on the place that is no check), `tests/count.test.js` (the count first after a wrong tie and a wrong give, a wave during a count, a talk box in the middle of a count, the hero beside the stem), `tests/teacher.test.js` (#69: the words after a count, the extra rods that roll back, the glow of the empty places, one demonstration, the rods of the teacher counted, the frame of ten, no offer in the middle of the presses), `tests/learnlog.test.js` (the roll-ups of help, check, and ask), and the stories `mentor-bridge` (a missing plank, a mark, then success and only watching), `mentor-cart` (all the nets as if each is one stone, then a demonstration on another cart), `mentor-bored` (three fast clean bundles, then a bigger task), and `mentor-share` (three misses in a row, then a shared task).
