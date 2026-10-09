# A count that is cut

*8 October 2026 · [Tiếng Việt](2026-10-08-a-count-that-is-cut.vi.md)*

The same two testers played again after the fixes of the last entry: Su, a girl of six who plays in Vietnamese, and Tí, a boy of seven who was born in the United States. The button no longer does the math. Su liked the healer most, because the healer says each step aloud: "Ngải cứu vào giỏ rồi." But Su stopped at the teacher, and Tí stopped at the healer.

## What we found

- **A count that is cut is worse than no count.** After a wrong bundle, the teacher counts the rods on the mat aloud. On the phone, the count stopped after a few numbers, and the next line of the teacher began. Su heard "một, hai, ba, bốn" when the mat had fourteen rods, and she said: "Thầy counted only 4 sticks." She believed the number, and so her next try was wrong too.
- **A test that passes without a screen can still fail on a phone.** The count and the button passed all the tests that run without a screen. A replay of Su's presses without a screen gave the full count. The faults showed only in the browser, where the voice speaks at its own speed and the picture of the button is drawn apart from the press.
- **A child needs to hear what happened after a mistake.** After the count, the extra rods rolled back with no word. Su did not know that ten were left, and she added rods until the mat was full. Then the button took a rod that it could not put down.
- **The colors must mean what the words say.** The smith says to drop the iron when it is bright red. But the iron is red a moment before it is hot, and at its hottest it is pale yellow. Su waited for red and missed two times.

## What we decided

- **Every check of a fix is also a play in the browser, on a phone screen.** The play records what the child sees and hears: the picture on the button before each press, and each word that the voice says.
- **The picture of the button and the press come from one choice.** The press does the act of the picture, or nothing.
- **After each wrong try, the person says what happens next, in words that a child of six knows.**

## The limit of what we know

The testers were not real children, and the test machine ran the game at an uneven speed. A replay without a screen showed that the count itself is right, so the fault is in the browser. We did not find its cause yet. The details are in issues #68 to #72.
