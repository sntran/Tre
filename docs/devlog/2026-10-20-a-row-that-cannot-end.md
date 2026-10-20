# A row that cannot end

*20 October 2026 · [Tiếng Việt](2026-10-20-a-row-that-cannot-end.vi.md)*

In the last play test, seven testers who did not know the game played as children of K to grade 5. A boy of grade 2 came back to his saved game for the third week, went to the fisher, and stopped at the same place as before: "I tried to put the stake in like a million times and uncle always says 'too narrow' … Last time I got stuck here too." This time the cause was a rule that we made to help him. This entry tells what we found in this play test, and one mistake of our own test machine.

## What we found

- **A rule against a mistake made a task that cannot end.** In the last round we gave the fisher a rule: a stake does not go into a place narrower than half of his gap, so that a child cannot make a row of stakes with no space. We tested it with good rows. We did not test it with every row that a child can make. A row of 15 with a gap of 3 can have stakes at 12 and 14; then the float at 15 is too narrow, and the water comes only when a stake stands at the float. The boy's old row was worse: every free place was too narrow. The help said "put this stake in the row", which the rule did not let him do. Our own design says that a task never becomes impossible after a try. A rule that refuses an act must be checked against every state that the play can make, not only against the state that we had in mind.
- **A finger cannot hit a thing that has almost no body on the screen.** A girl of grade 4 shared 46 rods among three desks: "46 chia 3 = 15 dư 1. That is division with remainder, we do that in class." Then one rod was left on the mat, for the box, and she could not pick it up in about fifteen tries. A rod that lies flat is a thin line on a phone, and the game chose a thing on a place only by a tap on its body. In a study of touch screens, children of 7 to 10 missed about 30 in 100 small targets, and the authors ask that a touch just outside a target choose the nearest one (Anthony and others 2014).
- **Sharing is dealing.** The same girl carried each rod alone: "That's 13 trips! So many." Young children share fairly by dealing, one to each in turn (Frydman and Bryant 1988). The deal is the act that holds the idea of division. A trip for each rod adds time, not math.
- **A right result had no word.** A girl of grade 1 hit five scouts at the gate with the slingshot. The coach had a line for a stone that fell short and for a stone that flew over, and none for a hit: "I got him with 4! But nobody cheers." The smith said nothing after a bar that was right. Feedback about the task is one of the strongest kinds (Wisniewski, Zierer, and Hattie 2020), and a right result is feedback too. "Trúng rồi!" is information about the stone, not praise of the child.
- **A word from another place.** The smith asked the children to quench the iron when it is "đỏ anh đào", cherry red, the word of the smiths of Europe. A boy of grade 3 from Hà Nội: "What color is anh đào exactly? Cherry... I never saw a real cherry much." A boy of grade 2 said the same in the round before. A village of the Red River delta has its own reds: the gấc fruit, a glowing coal.
- **Our test machine made some of what we saw.** The young testers often wrote "I can't see me". We looked at the hidden state: in many pictures the hero was off the screen. Our machine drew about 1.3 pictures a second. The camera of the game follows the hero by the time of each picture, but our tool moved the world in real time, so the camera fell far behind on a long walk. On a phone that draws 30 pictures a second, this does not happen. We checked the ferry with the camera of the game, without the slow drawing: after each crossing, all the animals of the puzzle are on the screen. We changed our tool, so that it waits for the camera before each picture.

## What we decided

- **The end of a row always takes the last stake,** and when the rule leaves no place for the stake in the hands, the fisher points at once at the stake to take back. We added this to rule 12 of the design.
- **A small thing of a task takes a tap near it** when the hands are empty, and the press next to the last rod takes it.
- **At the share, one rod for each desk in a trip,** dealt one to each desk in turn, with the count of each desk.
- **Every result has its word,** in the words of the task: "Trúng rồi!" at the gate, "Vừa đẹp!" at the trough. We added this to rule 12 too.
- **The colors of the heat are named by things of the village,** and a word that a young child may not know (the name of a calling, "khe", "đăng") gets one short line of what it is the first time.

## The limit of what we know

The study of touch targets measured children of 7 to 10 on a tablet, not children of 5 on a phone; younger children likely miss more. The color words of the village are our proposal, and a person who knows the village words must check them. Also, the smith says that hot iron gets hard in cold water. This is true of steel, which is iron with a little carbon; nearly pure iron does not get much harder. We asked the owner which word the game must use.

## Sources

- Anthony, L., Brown, Q., Tate, B., Nias, J., Brewer, R., and Irwin, G. (2014). Designing smarter touch-based interfaces for educational contexts. *Personal and Ubiquitous Computing*, 18(6), 1471–1483. [DOI](https://doi.org/10.1007/s00779-013-0749-9)
- Frydman, O., and Bryant, P. (1988). Sharing and the understanding of number equivalence by young children. *Cognitive Development*, 3, 323–339. Children as young as three shared fairly by dealing "one for him, one for her".
- Wisniewski, B., Zierer, K., and Hattie, J. (2020). The power of feedback revisited: A meta-analysis of educational feedback research. *Frontiers in Psychology*, 10, 3087. [DOI](https://doi.org/10.3389/fpsyg.2019.03087)
- Earlier entries of this diary: [New at any grade](2026-10-19-new-at-any-grade.md), [A help that sees the work](2026-10-18-a-help-that-sees-the-work.md)
