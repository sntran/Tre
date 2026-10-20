# Puzzles solved by doing (#104)

A puzzle is a side quest that a person offers on some days ("Puzzles, riddles, and the games of children" in `docs/DESIGN.md`). Its answer is an act in the world, never a word, so the rule of the world stays as it is. It is optional: nothing in the story waits for it, it sets no flag of the story, it has no count of mistakes, and the puzzle itself has no score of mastery. Each line is spoken, and a wave near its person gives the next hint (a hint is never a question).

| Part | File |
| --- | --- |
| The puzzles, the tales of later eras, and the sources | `data/world/puzzles.json` |
| The rules (the days, the boat, the wrong pairs, the pours, the check, the hints) | `src/core/puzzles.js` |
| The hooks: the tick, the acts of the button, the wave, the talk, the end of a crossing | `src/core/session.js` |
| The things | `skiff-mid`, `mark-side`, `pzpot-<n>-<level>`, `pzjar-<n>-<level>`, `drain`, `rice-spill` in `src/world/figures.js`; the traveler in `data/figures.json` |
| The lines | `puzzle.*` and `tale.*` in `i18n/vi.json` and `i18n/en.json` |
| The stories | `tests/stories/puzzle-ferry.json`, `tests/stories/puzzle-pots.json` |

**The days.** A puzzle comes on one day in `every`, by the seed of the world and the day (`puzzleDay`); the pots come only after the task of the healer. A story or the debug panel brings a puzzle today with the command `puzzle`. The places of a puzzle are cells from the top left corner of a map object (`anchor`: the boat by the river, the well). The person of a puzzle has a small paper scroll over the head (`mark-side`), not the star of the story. No act of a puzzle comes while a task, a raid, a folk game, or a screen is open.

## The ferry: a dog, a chicken, and a sack of rice

A traveler waits on the bank west of the boat of Phù Đổng with a dog, a chicken, and a sack of rice. He wears a khăn and carries a bundle on a pole (quang gánh), so that a child does not take him for the fisher. When the hero comes within `OFFER_NEAR` (12 half blocks, `src/core/puzzles.js`), he says the puzzle in three short lines, one at a time, each spoken (a tap on him says them again). The traveler says it as a puzzle of the travelers on the river, not as a Vietnamese tale. The ferry stands away from the ford, so that no stepping stones are in the view of the puzzle, and the boat is longer than the hero (#110).

- Next to a thing (nearer to it than to the landing), the big button takes it into the boat with no tap; a tap on a thing chooses it too. At the landing, a press crosses: the boat takes the hero and the thing (the ferry system of `src/core/world/systems/ferry.js`), and the thing steps onto the other bank. The picture of the button is the boat with what it carries. From the bank where all three things wait, an empty boat does not cross: the traveler says "Thuyền chưa chở gì." and points at the things.
- During the puzzle the view frames both landings, the boat, the things on each bank, and the traveler, and what stands in front of them fades. After each crossing, the traveler says what is on the bank that the hero left ("Bên kia còn con chó và bao gạo.").
- When a pair is left alone on the bank that the boat left, the world shows it at once and gently: the dog runs around the chicken, or the chicken pecks at the sack and a little rice spills. The traveler says it ("Ôi, chó đuổi gà rồi! Mình quay lại nhé."), and then the boat brings the hero and the thing back, and all are where they were before that crossing. No animal is hurt.
- When all three are on the far bank, the traveler thanks the child, turns to the hero, and gives two eggs with a line that names them ("Chú cho cháu hai quả trứng."). The ford leads back. The record keeps the crossings (`profile.puzzles.ferry.crossings`; seven is the least).
- A wave gets a hint only after the traveler said the puzzle, and only near him. The first hint is the rule again, with the traveler pointing at each pair ("Chó ở một mình với gà thì đuổi gà. Gà ở một mình với gạo thì mổ gạo."), and it comes again until a wrong crossing or a long wait (`WAIT_HINT`, 60 seconds). Then "Con gà đi trước.". The last hint is a demonstration, as at the well: the traveler takes the chicken across and back in the boat, and says "Mình có thể chở một thứ quay lại."
- A bubble of a puzzle goes when the hero walks more than 6 cells away from its person.
- While a puzzle goes on near its person, the stars and the arrows of the people of the story do not show, as at a task (`here` in `src/core/puzzles.js`; #110: the rice lay under the arrows at the edge, and a tap on it walked the hero to the woodcutter).

## The two pots at the well

After her task is done, on some days, the healer at the well (11:30 to 12:30) says: "Bà cần đúng bốn bát nước để sắc thuốc, mà chỉ có cái nồi năm bát với cái nồi ba bát."

- A tap on a pot and a press take it. With a pot in the hands: a tap on the bucket of the well and a press fill it; a tap on the other pot and a press pour until that pot is full or the pot in the hands is empty; a press at the drain empties it; a tap on the jar of the healer and a press is the check; a tap on the place of the pot in the hands (a ring of straw) and a press put it back there.
- Each pot shows its water through its side: a ring for each bowl, blue to the level (no numeral).
- The check: just right, and the healer thanks the child and gives an egg; too much, the jar runs over; too little, the jar stays low; she says which, and pours it back into the well. Each check is a skill event: `math.sub.10` for grades 1 and 2 (the need is two bowls: one pour), `math.addsub.100` from grade 3 (four bowls: a plan of several steps).
- The hints of a wave: "Đổ đầy cái nồi lớn trước.", "Đổ nồi lớn sang nồi nhỏ, rồi xem nồi lớn còn lại bao nhiêu nhé.", and then she shows the first two steps: the big pot fills, and then it pours into the small one.
- As at the ferry, a wave at the well gets a hint only after the healer said the puzzle, and only within `OFFER_NEAR` of her (#110).

## The tales of later eras

`tales` keeps the data of a tale for the chapter of its era: `era`, `tale` (true: a tale told of a real person), `who`, `source`, the skills, and the lines. A tale starts with "Người ta kể rằng …" and has the tag of a legend; it is never told as a fact. The first one is the elephant weighed with a boat, told of Lương Thế Vinh and the Ming envoy Chu Hy (`sci.water.float`, `math.addsub.1000`). It does not show in the first era, and its published record is still to find (question 113 in `docs/QUESTIONS.md`).
