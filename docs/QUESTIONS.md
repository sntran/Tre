# Open questions

This list has the questions that the design does not answer, and the choice that the first slice uses for each question. The owner can change each choice. Most values are in `data/config/learning.json` and `data/config/game.json`.

## Questions from the design

1. **How many correct answers in a row move a skill up, and how many mistakes give more practice?**
   - Choice: the mastery model (Bayesian Knowledge Tracing) decides. With the values in `learning.json` (start 0.2, learn 0.08, slip 0.12, guess 0.3), about 4 or 5 correct answers in a row move a new skill of the grade of the player to "mastered" (0.95). Two or three mistakes move it back to "learning". The difficulty rating (Elo) moves the level of problems in a skill up after correct answers.
2. **How much health does one mistake cost, and how many hints does a battle give?**
   - Choice: the hero has 5 hearts. One mistake costs 1 heart. Each battle gives 2 hints with no cost. After each mistake, the game also gives a hint, then a worked example, then a similar problem.
3. **Which small items can a player lose, and how many?**
   - Choice: coins and bamboo only. "Small" loss: 10 percent, at least 1, at most 3 of each. "Normal" loss: 25 percent, at most 10. Grade 1 has no loss unless the parent changes the setting. Iron is not in the list, because the iron horse quest needs it.
4. **Which creature friends go in each era?**
   - Choice for Era 1: Sóng, a calm little river serpent (thuồng luồng). Help: a water shield that blocks the health loss of the first mistake in each battle.
5. **Does the game use all six old exam titles (with Thám hoa and Hoàng giáp), or the simple list of five?**
   - Choice: the simple list of five (Tú tài, Cử nhân, Tiến sĩ, Bảng nhãn, Trạng nguyên), one for each era. Note: in the real exam system, Bảng nhãn was the second place of the palace exam, and Tiến sĩ was the general degree. The order in the game is not the historical order. A history reviewer must decide.
6. **Which ranks of Common Core and NGSS skills go into Era 1?**
   - Choice: see `data/skills.json` (the field `std`). Era 1 math: 1.NBT.A.1 (count to 120), 1.NBT.B.3 (compare), 1.OA.C.6 (add and subtract within 10), 2.OA.B.2 (add and subtract within 20), 1.G.A.1 (shapes). Era 1 science: 2-PS1-4 (heating and cooling), 2-PS1-1 (materials), 2-ESS2-3 (water), 2-LS2-1 and 1-LS1-1 (plants and animals), K-ESS2-1 (weather), 2-ESS1-1 (land).
7. **Who checks the history notes and the Vietnamese text?**
   - Open. The list for the reviewer is in `docs/REVIEW.md`.
8. **Do we record voice for the story parts, or use the browser voice only?**
   - Choice: the browser voice now. `speak(key)` plays `audio/<lang>/<key>.mp3` first when the key is in `audio/<lang>/index.json`. So recordings can replace the browser voice key by key, with no code change.
9. **Do two players share a party, or does each player have a hero in the battle?**
   - Not in the first slice. The battle rules keep the party as data, and the random numbers can fork for a second player (`rng.fork`), so a second hero can come later.

## Questions from the first slice

10. **Subject exam or era exam for the first title?** The design says that the era exam gives a scholar title, and the slice says "one subject exam for math, the first title". Choice: the math exam with the Era 1 math skills gives the title Tú tài. The exam engine can also build a mixed era exam later.
11. **Which players take the placement exam?** Choice: players who give grade 3 or higher, right after the Five Trials. It is a math exam over grades 1 to 5, and its result sets the level of each math skill. Players of grades 1 and 2 play Era 1 and take the Era 1 exam.
12. **What is the pass mark of the Era 1 exam?** Choice: an ability rating of 1000 or more. That is about "add within 20" at the first level, half of the time.
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
21. **Hero faces.** The four faces have four skin tones and four expressions. Should the skin tone be a separate choice?
22. **Parent questions.** A parent question shows when the child practices its skill with the teacher, in the language of the question. Should parent questions also show in battles?
23. **The river serpent.** The "small river creature" is a thuồng luồng from folk tales. Is this a good choice for young children, or is a crab or a fish better?
