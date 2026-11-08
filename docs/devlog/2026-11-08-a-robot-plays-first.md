# A robot plays first

*8 November 2026 · [Tiếng Việt](2026-11-08-a-robot-plays-first.vi.md)*

The last play test took about four hours for each child, and most of the problems that the children found were dead ends: a night with no bed, a trap that went to the wrong post, a line said again and again. This round we tried two things to test faster. First, a robot child that plays every scene of the game with no browser and checks the laws of progress. Then, short plays of about 45 touches by testers who did not know the game, each from a saved game at the scene of one fix of #164–#173, four phones at a time. A short play took about half an hour, and the whole round about two hours.

## What we found

- **A robot finds the dead ends in minutes.** On the build that the children played last round, the robot found the night with no bed in all five of its plays at night, and the trap at post 1 after two presses for "cột hai", in about two minutes. On the new build it found two dead ends that no child had found yet: the voice says "Frac.11.12 cây tre." at grade 4, and at night with a plank in the hands the button never shows the sleep. Holmgård, Green, Liapis, and Togelius (2019) used simple robot players with different styles to find where players get stuck. A robot does not see the screen, so it cannot say that the iron horse looks like a table.
- **Most fixes work.** The bed at night is the first act of the button, and one press brings the morning (a girl of grade 1). Each press of the slingshot says its count, and a girl of grade 1 learned the distance from "rơi trước" and "bay qua". A boy of grade 4 never gave the basket of bà lang by mistake. The iron horse stands at the forge ("a HUGE ngựa sắt!"), and Gióng grows in the view at each ten bowls ("like carrying in math, and it was cool").
- **A card can break a count.** Two children of K and grade 1 did exactly what the voice said at the trap, and the first card of the notebook came in the middle of their count. A press was lost, the timer went on, and the trap went to post 1: "I did what it said!" A child of five holds about two new things at once (Cowan 2016); a card and its line are two more.
- **One voice at a time.** At the bamboo, the woodcutter's count and the child's count played together ("một, một, hai, hai…"), and his show started again after "Giờ đến lượt em." Wood, Bruner, and Ross (1976) put demonstration among the parts of good help, but a show that talks over the child's own try takes the try away.
- **A line that says "now" must be now.** At the forge, "Đỏ rực thì nhúng ngay nhé." came while the iron was grey, and the water button was already on. A boy of grade 3 bent the iron two times. Metcalfe (2017) found that errors help when the learner can see why; here the error taught the child to distrust the line.
- **Our own set-up made errors too.** In the test phone a tap was 2.5 seconds of the game, longer than the wait of the slingshot, so slow presses never added up, and the line of a throw came one command late. We fixed it after the first play. Three of nine saved games did not start at the scene that they were for. The robot can check a save before a child plays it.

## What we decided

- **A robot child in the repository** that plays every scene in the tests and checks a save before a play test (#174).
- **Nothing comes between the presses of a count**, and a card only for a thing in view (#175).
- **One voice at a time at the bamboo** (#176), **space between the mats and a put on the chosen mat** (#177), **a model of bà lang that the child can read** (#178), **a dip whose line says when** (#179).
- **An iron horse that is a horse, no bubble over the growth, and a ride that stays beside Gióng** (#180). **Lines and dead ends**: fraction words from parts, sleep with a thing in the hands, the count of the farmer (#181). **The ferry riddle by the grade** (#182).

## The limit of what we know

These were nine short plays and many robot plays. The testers were not real children, and we heard them through their notes. The robot plays like a clumsy child: many of its raw findings came from its own random taps, and we kept only the ones that we could confirm in the code or the events. Its stars are a copy of the stars of the view until #174 makes them one code. A part of the late lines at the slingshot still comes from the test phone. Klahr and Robinson (1981) studied puzzles of moves with children of four to six; our ferry is a puzzle of that kind, but we did not test the easier version yet.

## Sources

- Holmgård, C., Green, M. C., Liapis, A., and Togelius, J. (2019). [Automated playtesting with procedural personas through MCTS with evolved heuristics](https://arxiv.org/abs/1802.06881). *IEEE Transactions on Games*.
- Cowan, N. (2016). [Working memory maturation: Can we get at the essence of cognitive growth?](https://doi.org/10.1177/1745691615621279) *Perspectives on Psychological Science*, 11(2), 239–264.
- Wood, D., Bruner, J. S., and Ross, G. (1976). [The role of tutoring in problem solving](https://doi.org/10.1111/j.1469-7610.1976.tb00381.x). *Journal of Child Psychology and Psychiatry*, 17(2), 89–100.
- Metcalfe, J. (2017). [Learning from errors](https://doi.org/10.1146/annurev-psych-010416-044022). *Annual Review of Psychology*, 68, 465–489.
- Klahr, D., and Robinson, M. (1981). Formal assessment of problem-solving and planning processes in preschool children. *Cognitive Psychology*, 13(1), 113–148.
- Earlier entries of this diary: [Heard but not seen](2026-11-07-heard-but-not-seen.md)
