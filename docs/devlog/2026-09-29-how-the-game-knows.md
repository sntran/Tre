# How the game knows what a child knows, with no test

*29 September 2026 · [Tiếng Việt](2026-09-29-how-the-game-knows.vi.md)*

If there are no questions in the world, how does the game know when a child has learned a fact? We wanted a model that is simple, that a small team can check by hand, and that runs on the device with no server.

## What we found

- **Efficient success is the signal.** In the game Physics Playground, the strong signal was a level solved with few objects, not a level solved. That signal was reliable (alpha = 0.87), and the estimate of the game agreed only in part with a physics test outside the game (r = 0.41) ([Shute & Moore](https://myweb.fsu.edu/vshute/pdf/ShuteMoore.pdf)). So such an estimate puts children in order well, but it does not predict a test on paper well.
- **A simple model is enough.** Bayesian Knowledge Tracing keeps, for each skill, the chance that the child knows it. A model is broken if the chance falls after a right answer, or if ten right answers in a row do not reach mastery ([Baker, Corbett & Aleven 2008](https://learninganalytics.upenn.edu/ryanbaker/BCA2008W.pdf)). Deep learning models lose most of their advantage when the simple model also knows about forgetting and about the ability of each child ([Khajah, Lindsey & Mozer 2016](https://www.educationaldatamining.org/EDM2016/proceedings/paper_144.pdf)).
- **A rating of difficulty needs crowds.** Math Garden rates both the child and each item after every answer, aims at 75% success, and has served more than 400,000 Dutch children ([Brinkhuis et al. 2018](https://files.eric.ed.gov/fulltext/EJ1187391.pdf)). It learns how hard an item is from many children. One device with no server cannot.
- **A clever order did not help by itself.** In one study, an adaptive order, a fixed order, and a free choice of levels gave the same gains; short animations helped most ([Shute et al. 2021](https://eric.ed.gov/?id=EJ1281101)).
- **Mashing is easy to see.** Children who game a system learn less, and the signs are very short times, quick hints, and guesses ([Aleven et al. 2016](https://www.cs.cmu.edu/~aleven/Papers/2016/Aleven_etal_IJAIED2016-Helpseeking.pdf)).

## What we decided

- **Each action in the world is evidence.** "Solved with the fewest parts on the first try" has the most weight.
- **The simple model, set by hand** inside the standard limits, with forgetting. We do not fit it from data, because we have no crowds.
- **The rating changes only for the child.** The difficulty of a task comes from its design: the length of the gap, the number of sizes, the size of a group.
- **Review comes from forgetting.** When a skill is due, the next task of the world needs it. There is no review screen. The gaps (1, 3, 7, 14, and 30 days) are a convention; we found no evidence for these exact numbers.
- **Mashing is no evidence, and it is not an error.** The task gets simpler, or a person shows it.
- **No grade-level score for parents,** because the estimate does not predict a test on paper well enough.
- **Our work goes into the rules of evidence and the pictures of the world,** not into a clever algorithm.
