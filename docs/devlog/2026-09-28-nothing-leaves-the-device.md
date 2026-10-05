# Nothing leaves the device, and anyone can read the code

*28 September 2026 · [Tiếng Việt](2026-09-28-nothing-leaves-the-device.vi.md)*

A game for children can collect much about them if nobody stops it: names, ages, how long they play, what they get wrong. On the first day we decided that Tre sends nothing about a child anywhere, and that anyone can read how it works.

## What we found

- **The law asks much of a site that collects data from children.** In the United States, "an operator must obtain verifiable parental consent before collecting any personal information from a child" under 13 ([FTC, COPPA](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)).
- **A game that collects nothing needs none of this.** A static web site on GitHub Pages has no server of its own, so it has nowhere to send the data of a child.
- **Expected rewards lower the interest of children more than of adults** ([Deci, Koestner & Ryan 2001](https://www.selfdeterminationtheory.org/SDT/documents/2001_DeciKoestnerRyan.pdf)). Things that a child must buy to go on, or timers that push a purchase, have no place in a game for learning.

## What we decided

- **All data stays on the device,** in the browser (IndexedDB). There are no accounts, no server, no ads, and no analytics.
- **A parent moves a profile** to another device with a file or a short text code.
- **The learning log holds only counts and times:** no name, no free text, no picture. It leaves the device only when a parent shares a summary, after the parent sees all of it.
- **A practice link holds only the name of an activity,** never data of a child (see [A link to one activity](2026-10-03-practice-links.md)).
- **The parent area opens** only after a parent holds a button for three seconds and answers a question for adults.
- **The code is open** under the AGPL-3.0: a person who runs a changed copy, also as a web site, must publish its source. **The stories, the art, the music, and the text** are under CC BY-NC-SA 4.0: free for families and schools, not for sale. **The name "Tre" and the logo are reserved,** so that a copy must use another name.
- **Learning is always free.** No skill, era, or exam needs a purchase. If extras come later, they are only behind the parent gate: no loot boxes, no timers that push a purchase, and nothing that helps in a battle.
- **If accounts come later,** they are only for parents, after a privacy policy, the consent of the parents, and a check by a lawyer.

The rule makes one thing harder for us: we cannot see how children play unless a parent sends us a summary. We accept that.
