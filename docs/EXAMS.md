# The exams: the test of the messenger and the exams of Văn Miếu

In Era 1 the messenger of the Hùng King gives the tests at the village hall of Phù Đổng (#134): the placement test after the Five Trials (grade 3 and up), and the exam of the era after the farewell of Gióng. From chapter 7 (the Lý) the exams are at Văn Miếu. The person, the place, and the lines come from `examiners` in `data/titles.json` (`src/core/examiners.js`).

| Part | Where |
| --- | --- |
| The adaptive exam, the ladder, the result | `src/core/exam.js` |
| The numbers of the exam | `exam` in `data/config/learning.json` |
| The screen of the exam, the result, and the choice of a calling | `src/ui/vanmieu.js` |
| The callings, their mentors, and the line of each level | `data/callings.json` |
| The fit of the screen on a phone | `tools/exam-fit.mjs` |
| The tests | `tests/learning.test.js` and `tests/exam136.test.js` |

## A short test that a child can win (#136)

In a play test, a girl of grade 4 got 15 of 15 right, among them five big multiplications in the head ("I need paper for this", "Is this a game or a worksheet?"), and heard "about grade 6": "now will everything be lớp 6 hard?". A boy of grade 3 heard no answer after a question ("I feel a bit dumb"), guessed two of his six right answers, and was placed at grade 4.

- **At most 10 questions** (`min` 6, `max` 10, `maxMistakes` 3).
- **About seven right in ten.** The next question is the one that the player gets right with the chance `target` (0.7): its rating is under the estimate of the player by 400 × log10(0.7 / 0.3), about 147. A study of adaptive tests found more fear of failure and a lower sense of success at half right (Ortner, Weißkopf and Koch 2014), and a target of 70 percent costs about one question against the best target (Eggen and Verschoor 2004). A simulated child of grade 3 gets 60 to 80 percent right in the placement of grade 3 or 4 (`tests/exam136.test.js`).
- **The smallest numbers.** The ladder of an exam has the first level of each skill only (`examLadder`): 23 × 14, not 826 × 74. No question needs paper. With 21 skills, the ladder is coarse: the error of the estimate of a simulated player is under 190 rating points (it was under 170 with 15 questions and all the levels).
- **Never two of one kind in a row** (`kindOf`: math.add.10 and math.add.20 are one kind).
- **The answer after each question** (rule 26): "Đúng rồi!", or "Chưa đúng. Đáp án là 42." with the one line of the reason of the problem (`explain`) when it has one. A right answer goes on by itself after 1.5 seconds; after a wrong answer (or "not learned yet") the child reads the right answer and taps "Câu tiếp theo" in the place of the button, at the pace of the child. The dots over the question show how many are left. The rule shows on the first question only.
- **"Cháu chưa học bài này."** A button in the free row of the keypad, next to the zero (under the choices for a question with choices). On the first question the messenger says it: "Bài nào cháu chưa học thì cháu bấm nút này, không sao cả." It counts as not known, with no guess (`answer(false, { skipped: true })`), and the next question is easier. In a study, many children of grade 5 thought that it is wrong to skip a question, because it can look like "not trying" (Childs, Elgie, Brijmohan and Yang 2019): so the choice comes from the messenger.
- **The result names no grade.** The child hears one thing done well and one thing to learn next, with the names of the skills (`strengths`): "Cháu làm rất tốt bài nhân số có nhiều chữ số. Bài cộng phân số khác mẫu thì mình sẽ học thêm. Từ nay các bài sẽ hợp với cháu." The grade goes to the parent page only (`placedGrade`), and never above the top grade that has tasks (`placement.topGrade`, 5): above it, the parent page says "lớp 5 trở lên".
- **The screen fits a phone.** At 390 × 844, with the tallest picture of each kind (dots, an array, a shape, a rectangle, fractions), the question, all the keys, and the button are on the screen with no scroll (`tools/exam-fit.mjs`; a phone of 360 × 740 scrolls a little on the first question, with the rule).
- **A rectangle is never shorter than it is wide.** `area()` in `src/core/generators.js` gives the longer side as the length ("dài 2, rộng 5" before).

## The calling matches the child (#136)

- **The line of each card is the task of the mentor at the level of the child** (`lines` in `data/callings.json`, by `levelFor` in `src/core/world/trials.js`): at grade 4 the scholar is "Học với thầy giáo: chia que đều cho các bàn.", not the counting of grade 1. A line for each of the five levels of each calling.
- **The card shows the hero of the child next to the mentor**, with the mentor of the village under the name ("Người thầy: bác thợ rèn", `guideKey`). After the choice, the message shows the child's own hero with the tool of the calling, not the mentor. In the play test a girl took the picture of the smith for her new look: "Is that supposed to be me? I'm a girl with long hair."
- **The line before the choice ties it to the people that the child met:** "Cháu đã giúp năm người tài trong làng. Cháu muốn học với ai?" (`exam.messenger.who`), and the note of the choice says "cháu" after the messenger (`exam.messenger.calling.note`), "em" at Văn Miếu.
