# Play it as a child

*6 October 2026 · [Tiếng Việt](2026-10-06-play-it-as-a-child.vi.md)*

The game had 618 tests, and all of them passed. Then the owner of the project played it for a few minutes and saw at once that a thing that you pick up does not show in the hands. Why did so many tests not see it?

## What we found

- **A test plays as a machine, not as a child.** A story of the tests walks to the exact middle of a place and then presses the button one time. It never taps a little to the side, presses twice, taps the calf that follows the hero, or lets go of a button too fast.
- **Young children move in big gestures.** Children under 5 can easily swipe, tap big targets, and drag, because these "involved less advanced motor skills — big movements of arms and hands". Small and exact moves are hard: one child of 5 gave up on a counting game that needed exact placement and said "I don't like this game." The advice is touch targets of at least 2 cm × 2 cm ([Nielsen Norman Group, "Design for kids based on their stage of physical development"](https://www.nngroup.com/articles/children-ux-physical-development/)).
- **When we played as a child, we found what the tests missed.** On a phone screen, with taps and the screen buttons only:
  - a tap on the knife that was shorter than one frame stopped the whole game;
  - at the teacher's trial, no point of the mat could be tapped, because the rods of the heap and the straw band covered it;
  - a second press, which children do all the time, took back the rod that the child had just put down;
  - nothing said how to use the slingshot, so a child who did not know it lost every raid.

## What we decided

- **Every task of the work now ends with a play test as a child.** On a touch screen of 390 × 844, with taps and the buttons of the screen only, the person who made the change plays as a child of six: taps near the place, presses at once, presses again, taps the people and the stars, rides the calf, waits, and plays on into the evening. The frames of the play go into the report of the task.
- **The tests learn from the child.** New tests tap the point of a place on the screen through the same code as a finger, press and let go in one step, and play each activity as a restless child with random taps and presses.
- **The limit of what we know:** a person who plays as a child is still not a child. Play with real children, with their parents next to them, stays the real test.
