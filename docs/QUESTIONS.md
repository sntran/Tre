# Open questions

This list has the questions that the design does not answer, and the choice that the first slice uses for each question. The owner can change each choice. Most values are in `data/config/learning.json` and `data/config/game.json`.

## Questions from the design

1. **How many correct answers in a row move a skill up, and how many mistakes give more practice?**
   - Choice: the mastery model (Bayesian Knowledge Tracing) decides, with extra rules. The values are in `learning.json` (start 0.2, learn 0.03, slip 0.1, guess 0.2). A skill is "mastered" only when all these are true: p is 0.95 or more, the player gave 8 answers or more, 2 or more correct answers were at the highest level, and the last 10 answers have 1 mistake or fewer (no mistake in fewer than 10 answers). Near mastery, the problems use the highest level. A mastered skill stays mastered until p falls below 0.7 ("almost"). So one mistake does not remove the mastery.
   - Simulation (1000 learners for each value; the test `tests/learning.test.js` runs 400): a learner who is always right needs 8 answers. A learner who is right 90 percent of the time needs about 10 answers (median), 80 percent about 13, 70 percent about 24, and 60 percent about 55. Only 18 percent of the learners who are right 60 percent of the time get mastery in 20 answers.
   - The rule "1 mistake or fewer in the last 10 answers" sets the pace of mastery, not the BKT values. With these BKT values, 3 correct answers in a row give p = 0.96, so a learner who is right 60 percent of the time gets p above 0.95 after about 12 answers. The rule keeps such a learner at "learning" or "almost" until the last answers show about 90 percent correct. To change the pace, change `recentAnswers` and `recentMistakes` in `learning.json`, and run the simulation test again. A change of the BKT values alone changes the pace very little.
   - The difficulty rating (Elo) chooses the level: the hardest level with an expected success from 75 to 85 percent (`targetLow`, `targetHigh`).
2. **How much health does one mistake cost, and how many hints does a battle give?**
   - Choice: the hero has 5 hearts. One mistake costs 1 heart. Each battle gives 2 hints with no cost. After each mistake, the game also gives a hint, then a worked example, then a similar problem. A hint tells a method. It never tells the answer or the card to use. A worked example uses other numbers. A problem solved after a hint does not count as correct on the first try.
3. **Which small items can a player lose, and how many?**
   - Choice: coins and bamboo only. "Small" loss: 10 percent, at least 1, at most 3 of each. "Normal" loss: 25 percent, at most 10. Grade 1 has no loss unless the parent changes the setting. Iron is not in the list, because the iron horse quest needs it.
4. **Which creature friends go in each era?**
   - Choice for Era 1: Nghé, a young water buffalo. It hid in the reeds from the river creatures, and it comes with the hero after the river battle. Help: one more heart in each battle. Nghé has a "ride" block in `data/friends.json` for later eras (it is not used yet).
   - The player gives a name to each new friend (the usual name is ready in the box). The texts use the chosen name.
   - Second friend (optional): Sóng, a calm little river serpent (thuồng luồng). After the river battle, the player can take Sóng or let it stay with the river. Help: a water shield that blocks the health loss of the first mistake in each battle.
5. **Does the game use all six old exam titles (with Thám hoa and Hoàng giáp), or the simple list of five?**
   - Choice: the simple list of five (Tú tài, Cử nhân, Tiến sĩ, Bảng nhãn, Trạng nguyên), one for each era. Note: in the real exam system, Bảng nhãn was the second place of the palace exam, and Tiến sĩ was the general degree. The order in the game is not the historical order. A history reviewer must decide.
6. **Which ranks of Common Core and NGSS skills go into Era 1?**
   - Choice: see `data/skills.json` (the field `std`). Era 1 math: 1.NBT.A.1 (count to 120), 1.NBT.B.3 (compare), 1.OA.C.6 (add and subtract within 10), 2.OA.B.2 (add and subtract within 20), 1.G.A.1 (shapes). Era 1 science: 2-PS1-4 (heating and cooling), 2-PS1-1 (materials), 2-ESS2-3 (water), 2-LS2-1 and 1-LS1-1 (plants and animals), K-ESS2-1 (weather), 2-ESS1-1 (land).
7. **Who checks the history notes and the Vietnamese text?**
   - Open. The list for the reviewer is in `docs/REVIEW.md`.
8. **Do we record voice for the story parts, or use the browser voice only?**
   - Choice: the browser voice now. `speak(key)` plays `audio/<lang>/<key>.mp3` first when the key is in `audio/<lang>/index.json`. So recordings can replace the browser voice key by key, with no code change.
   - Each kind of person has a voice profile in `data/config/game.json` ("voices"): man, woman, boy, girl, elder man, elder woman, and creature. The profiles change the pitch and the speed of the browser voice, and they choose a male or a female browser voice when the device has one. Many devices have only one Vietnamese voice, so the pitch makes most of the difference. Recorded voices are better for the story parts.
9. **Do two players share a party, or does each player have a hero in the battle?**
   - Not in the first slice. The battle rules keep the party as data, and the random numbers can fork for a second player (`rng.fork`), so a second hero can come later.

## Questions from the first slice

10. **Subject exam or era exam for the first title?** The design says that the era exam gives a scholar title, and the slice says "one subject exam for math, the first title". Choice: the math exam with the Era 1 math skills gives the title Tú tài. The exam engine can also build a mixed era exam later.
11. **Which players take the placement exam?** Choice: players who give grade 3 or higher, right after the Five Trials. It is a math exam over grades 1 to 5. It starts near the grade of the player (the base rating of the grade, minus 100). Its result sets the level of each math skill, but it never lowers a skill that is mastered. Players of grades 1 and 2 play Era 1 and take the Era 1 exam.
12. **What is the pass mark of the Era 1 exam?** Choice: the pass ability is 1000. That is about "add within 20" at the first level, half of the time. The exam gives the maximum likelihood ability of all answers. A simulation of 4000 exams at the pass ability sets the pass mark (998, the median result). So a player at the pass ability passes about half of the time. A test runs the simulation again.
13. **Văn Miếu and the time of the story.** The legend of Thánh Gióng is from the time of the Hùng Kings. The real Văn Miếu was built in 1070. The game says this in a History note. Is this acceptable?
14. **Is Thánh Gióng a companion in the soldier battles too?** Choice: only in the boss battle, as the slice says.
15. **Subtraction with number cards.** Choice: the player taps cards in order and taps the sign between two cards to change it from + to −. The running total can go below zero during the choice. Is this acceptable for grade 1?
16. **The adult question of the parent gate.** Choice: multiply two numbers from 12 to 19 (for example 14 × 17). A strong grade 5 child can solve it with time. Is another kind of question better?
17. **Profiles.** The slice has one profile (`maxProfiles` in `game.json`). The saves and the code support more profiles.
18. **What counts as play time?** Choice: time in the village, in battles, and at Văn Miếu, when the page is visible. The title screen and the parent area do not count. When the time is over, the game waits for a calm point in the village.
19. **Calling bonuses in the slice.** Some Võ skills of the design are for later eras (physics shots, diving). Choice for now:
    - Scholar: one more attack card, and the first mistake in a battle costs no heart.
    - Smith: the forge skips the measure step, and a shield break does one more point of damage.
    - Fisher: water magic does one more point of damage.
    - Healer: one more heart in each battle.
    - Woodcutter: fire magic does one more point of damage (later: shots with a bow).
20. **The rice for Gióng.** The legend says that the whole village fed Gióng. The slice adds a short counting task for this. Is this acceptable?
21. **Hero faces and skin.** Choice: the skin tone is a separate choice (4 tones). The four faces have four expressions.
22. **Parent questions.** A parent question shows when the child practices its skill with the teacher, in the language of the question. Should parent questions also show in battles?
23. **The river serpent.** The "small river creature" is a thuồng luồng from folk tales. Is this a good choice for young children, or is a crab or a fish better?
24. **Names of Era 1.** The art must be correct for the time of the Hùng Kings. So the text now says "nhà làng" (village hall) in place of "đình", and "thầy giáo" in place of "thầy đồ". Both đình and thầy đồ are from much later times. Is this acceptable?
25. **Coins in Era 1.** The game gives coins (tiền đồng) as rewards. Round bronze coins came to Vietnam much later than the time of the Hùng Kings. Should Era 1 use another reward, for example cowrie shells or bronze tools?
26. **Iron in Era 1.** The legend says that Gióng had an iron horse, iron armor, and an iron staff. The Đông Sơn culture used mostly bronze. The game keeps iron, as the legend says. A history note could tell this.
27. **The Măng non stage.** The style has a larger-size mode (`data-stage="mang-non"` on the `<html>` element) for Pre-K and K. The grades now come from `data/config/game.json` (Pre-K, K, and 1 to 12), but the game does not set this mode yet. Which setting turns it on?
28. **Grades with no content.** The skills and the trials are for grades 1 to 5. A player of Pre-K or K gets the grade 1 skills. A player of grade 6 or higher gets the grade 5 trials, and the skills of grades 1 to 5 start as mastered (with a review). Is this acceptable until the content for these grades is ready?
29. **Is the player the hero, or does the player control a hero?** Choice: the player is the hero. The narrator speaks to the player as "em" (English: "you"). The people of the village speak to the player by name. The title button says "Bắt đầu cuộc phiêu lưu" (Start your adventure), and hero creation asks "Em trông thế nào?" (What do you look like?).

## Questions about the geography and the regions

These questions need a person who knows Vietnamese history and geography. Until they are answered, the regions stay locked on the country map.

30. **Region 13 does not match chapter 13.** The region is Gia Định and the Mekong delta, in the south. The heroes of chapter 13 are from the north and the center: Lê Quý Đôn (Diên Hà, Thái Bình) and Hải Thượng Lãn Ông (Hương Sơn, Hà Tĩnh). Should the region move north, should the chapter have a hero of the south (for example a scholar or a healer of Gia Định), or should the chapter have more than one region? The region stays locked.
31. **Region 11 and Lương Thế Vinh.** The region is Thuận Quảng, the central coast with Phú Xuân. The hero of chapter 11, Lương Thế Vinh, is from Vụ Bản, Nam Định, in the delta. Lê Thánh Tông went south to the center in 1471. Should the region be in the delta, or should the chapter tell both places? The region stays locked.
32. **The land of each era.** The country map shows the land of the era of the story, north of a line (`eraLand` in `data/world/regions.json`). The values are rough: 18.0° north for chapters 1 to 7, 16.2° for chapter 8, 15.4° for chapters 9 and 10, 13.6° for chapter 11, and 8.4° for chapters 12 and 13. They need a check. A straight line is also a simple picture of a border that was not straight.
33. **Places that need a check.** The coordinates of the places with `"check": true` in `tools/geo/places.json`: Sóc Sơn (Đền Sóc), Núi Trâu, Mê Linh, the Bạch Đằng stake fields, Thiên Trường, Lam Sơn, Tây Sơn, Hương Sơn, Diên Hà, and Vụ Bản. The lines of seven rivers are traced by hand (`tools/geo/rivers-extra.json`): Đuống, Thái Bình, Bạch Đằng, Mã, Hương, Thu Bồn, and Đồng Nai.
34. **Roads and times of travel.** The roads and the river ways between places (`data/world/routes.json`) are simple lines, not the old roads. The speeds are 4 km an hour on foot and 6 km an hour by boat, with 8 hours of travel in a day. Are these good for the game?
35. **Sóc Sơn in the story.** Gióng now goes north to the hills of Sóc Sơn after the battle, and the child says goodbye there. An old man of Sóc Sơn tells what he saw, what the people say about the golden bamboo, and that a soldier of Ân missed his children. Is this acceptable? The legend also says that Gióng left his iron armor on the hill; the game does not tell this yet.
36. **The ferry over the Red River.** The way from Phù Đổng to Thăng Long crosses the Đuống and then the Red River. The game has a ferry on the Red River, and the ford and the broken bridge on the Đuống. Is a ferry correct for the time of the legend?

## Questions about the voxel world

37. **Speed on a real phone and a real iPad.** The goal is 60 frames a second. The first test was only in a browser with a software renderer (no graphics chip), and there the numbers do not tell the speed of a device. At the start of Phù Đổng, one frame has about 250 draw calls and 215 000 triangles. Most draw calls are the parts of the people (each part is one box and one outline). A test on a real phone is still to do: open the game with `?fps` at the end of the address (for example `https://sntran.github.io/Tre/?fps`), walk in the village, and write the numbers here. If a phone is slow, the next steps are: one mesh for each figure, a lower pixel ratio on phones, and a shorter view distance.
38. **Map scale.** Each cell of the old maps is now 2 × 2 cells, so that a house is about 6 × 6 cells and a person is about as tall as the posts of a house. The dikes of the paddies are on every fifth cell. Is this size good?
39. **The looks of the people.** The looks in `data/figures.json` are first choices: the elder and the teacher wear robes, the smith has a hammer, the fisher has a nón and a net, the soldiers of Ân wear helmets and carry blunt staffs (no sharp points or blades, as `docs/ART.md` says). They need a check for the time of the Hùng Kings, as the old pictures did.

