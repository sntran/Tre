# Folk riddles and trick questions (#103)

Two folk forms of the village are side quests, not quizzes ("Puzzles, riddles, and the games of children" in `docs/DESIGN.md`). Nothing in the story waits for them, no mistake is counted, and nothing goes into mastery. Each line is spoken.

| Part | File |
| --- | --- |
| The riddles, the trick questions, their sources, and the numbers | `data/world/riddles.json` |
| The rules (the evening, the tap, the clue, the answer, the trick questions) | `src/core/riddles.js` |
| The hooks: the tick, the tap, the pet of Nghé, the wave, the tap on a child | `src/core/session.js` |
| The page of the notebook | `riddlePage` in `src/ui/notebook.js` |
| The lines | `riddle.*` and `trick.*` in `i18n/vi.json` and `i18n/en.json` |
| The check of the texts | questions 109 to 112 in `docs/QUESTIONS.md` |

## The riddle of the evening

- From 17:00 to 18:30 (`evening`), when the hero comes within 6 cells of Bà (or of the elder) at the place of the person, she says a new riddle: "Bà đố cháu nhé: …". One new riddle each day at most, and none while a screen, a task, a raid, or a folk game is open. The riddles come in the order of the data, and a found riddle does not come again.
- **The answer is a thing to find.** The child walks and taps a thing of the kind of the answer, anywhere: an animal of the village (`kinds`), Nghé for the buffalo (`ids`), or a prop of the map (`props`: the bamboo, the banana plant, the banyan, the haystack). The tap still does what a tap does; a tap on another thing is only a tap on that thing (no "sai"). The first riddle ends with how to answer ("Cháu đoán ra thì đi tìm con vật đó, rồi chạm vào nó nhé.", `riddle.how.<how>`: an animal, a tree, or a thing), and the next riddles say it too until the child finds one alone (#139). The tap that finds it gives the sound of the bell. When Bà is near, she says the riddle again and how its words fit the thing ("Hai sừng, mũi buộc thừng, kéo cày: con trâu đấy!"), and laughs; else the hero says that Bà will tell, and she says it at the next meeting.
- **A wave near Bà** with a riddle that waits (and no task): the clue first (which words point to the thing). On a later day, a wave gives the answer: she points, and the hero walks to the nearest thing of the answer; the riddle is found when the hero comes there. The wave button shows near Bà while a riddle waits.
- **The record** (`profile.riddles`): the riddle that waits, and each found riddle with how (`alone`, `clue`, or `answer`). The parent area shows how; the child sees the names of the found riddles. The page of the notebook ("Câu đố của bà") has the riddle that waits, with the button "Nghe lại".
- **The English line** says the riddle in plain English, and then one line about the words ("The play on words: đốt means to burn, and it also means the joints of a bamboo stem."), so that a bilingual child learns the Vietnamese words.
- The rule of the world: a text of the village has no question mark, but a riddle (`riddle.*`) and a trick question (`trick.*`) can end with one. They have no digit and no operator (`createLaws` in `src/core/story.js`).

## Trick questions of the children

A tap on a child of the village (the hopscotch child, the rope child) sometimes (`chance`) gives a trick question: "Đố bạn: …". After 4 seconds (`wait`), the child says the answer and why it tricks people, and laughs. The hero only listens: nothing is asked back, and nothing is recorded as right or wrong. At most one each day from each child, none in a folk game or a task, and the questions come in order.

## Sources

Each riddle and trick question names a published collection to check it against (`sources`). The words of this first set came from pages of riddles on the web; the page in the book is null, and `checked` is false, until a person who knows Vietnamese folklore checks each one (question 109).
