# The work of the story in Era 1

After the Five Trials, the story of Gióng has four more tasks with the hands. They are work in the village, on the same system as the trials (`docs/TRIALS.md`): the things lie in the world, the child carries them or taps them, and the world answers each commit. No question, no answer field, and no numeral show. A person says a number as a word.

| Part | File |
| --- | --- |
| The numbers of each task, by level, and the skill of each level | `data/trials.json` (the entries with `"kind": "task"`) |
| The pure rules (the bowls in the pot, the lumps in the hearth, the equal pieces, the share) | `src/core/world/trials.js` |
| The things of the tasks in the world, the puts, the timed parts, and the commits | `src/core/world/systems/work.js` |
| The start from a talk (or from the end of a raid), the taps, the flag, and the done talk | `src/core/session.js` |
| The places on the map | `tools/maps/era1.py` (`rice-trays`, `giong-pot`, `horse-ore`, `staffs-stem`) |
| The loot of each raid | `loot` in `data/raids.json` |
| The figures | `workThing` in `src/world/figures.js`; the looks in `data/figures.json` |
| The stories | `tests/stories/rice-giong.json`, `forge-horse.json`, `staffs-bamboo.json`, and the share in `raid-soldiers.json` and `raid-boss.json` |

## The order in the story

1. The iron horse (the quest "The iron horse", after the child finds six pieces of iron).
2. Rice for Gióng (after the horse; Gióng grows up).
3. The loot after each soldier raid.
4. The bamboo staffs (after the two soldier raids; the general comes only after the staffs).
5. The loot after the boss, and then the farewell of Gióng.

## The four tasks

| Task | The work | The commit | The world answers | Skill by level (1, 2, 3) |
| --- | --- | --- | --- | --- |
| The iron horse (the smith) | The smith takes the six pieces of iron that the child found and puts them on a heap by the forge, with three lumps of old iron. The child carries lumps into the hearth and can take a lump out again. | A tap on the bellows. | Six lumps: the fire burns high, and the iron lies on the anvil. Too few: the fire puffs and dies. Too many: the fire chokes, and the extra lumps roll back to the heap. Then the iron glows and dims as in the trial of the smith (a sound when it turns hot); a tap drops it into the water: at the right moment it becomes the iron horse; too early or too late, it bends and goes back into the fire. | The bellows: count to 120 (levels 1, 1, 2). The water: states of matter (levels 1, 2, 2). |
| Rice for Gióng (the mother) | Trays of three bowls and of five bowls lie at the edge of the paddies. The child carries one tray at a time to the pot in front of the house of Gióng. A tray that goes into the pot comes back full to the path. | Each full ten in the pot. | Each ten bowls, Gióng eats and grows one head taller; the rest stays in the pot, and the pot shows it as bowls. The count shows on his height, not as a number. Two heads at level 1, three at level 2, four at level 3. | add to 10; add to 20; place value. Solved: the pot came to exactly ten. Efficient: with the fewest trays. |
| The bamboo staffs (the woodcutter) | A green bamboo stem lies by the north hedge, with a ring at each half block. A tap on the stem slashes it at the nearest ring, at once: no chalk, and no taking back. | The last slash (one less than the staffs). | Equal pieces tie into a bundle of staffs for the men of the village. If not, the short piece breaks, and a new stem comes. Two staffs from ten half blocks at level 1, four from twelve at level 2, six from eighteen at level 3. | shapes (equal parts); shapes; unit fractions |
| The loot (after a won raid) | A pile of coins lies behind the wall, and three mats: the basket of the hero, Nghé, and Gióng. The child carries coins from the pile to the mats, and from a mat back. | The hands are empty, and the pile has too few coins to even out the mats. | Equal mats, with fewer coins in the pile than friends: all are happy, the coins of the hero fly to the counter, and the rest stays for the village. If not, Nghé turns away and shakes her head until the share is fair. Seven coins after the first soldiers, ten after the second, twelve after the boss. | count to 120; add to 20; division (levels 1, 1, 1) |

The level comes from the grade that the player gave, as for the trials.

## Notes

- The crafting screen of the iron horse is gone: its recipe, its element rules, and its texts are removed. The forge work replaces it.
- The soldier raids and the boss give no coins as a gift now: their coins are the loot. The scouts still give iron (for the horse) and coins.
- Gióng stands at the side of the hero in the soldier raids too, so that he is there for the share.
- A share is judged only when the pile cannot even out the mats any more. So a child who fills one mat after the other (four, four, then two with two coins left) is not judged before the last coins go down.
