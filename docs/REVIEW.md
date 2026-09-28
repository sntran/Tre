# Review list

A person must check these texts before a release. Two kinds of review are necessary:

1. **History review.** A person who knows Vietnamese history checks each history note, each legend text, and each fact. Follow the section "History and sensitivity rules" in `DESIGN.md`.
2. **Language review.** A native speaker checks all Vietnamese text in `i18n/vi.json` (the text is for children aged 6 to 11), and a teacher checks the science questions.

All text is in `i18n/vi.json` and `i18n/en.json`. This list gives the key of each text, so the reviewer can find it. After a change, run `npm test`.

## 1. Facts to check

- The legend of Thánh Gióng: the time of the sixth Hùng King (Hùng Vương thứ sáu), the village of Phù Đổng, the Ân army (quân Ân), the land of Văn Lang, the battle at the foot of Trâu Sơn mountain, Gióng rides to Sóc Sơn and rises to the sky, the golden bamboo (tre đằng ngà).
- In 2010, UNESCO listed the Gióng festival of Phù Đổng and Sóc temples as intangible cultural heritage (key `battle.boss.history`, with the History seal).
- Văn Miếu was built in 1070. Quốc Tử Giám opened in 1076. The stone steles of the doctors (tiến sĩ) are from 1484 (key `vanmieu.note`).
- The mentors of the callings: Chu Văn An (teacher, 14th century), Yết Kiêu (diver, 13th century), Tuệ Tĩnh (physician, 14th century), Thạch Sanh (folk tale). They are from later times than Era 1; they only show on the calling cards.
- The titles and their meanings (keys `title.*`). The order of the five titles in the game is not the historical order. See `QUESTIONS.md`, question 5.
- Science facts in the hand-written questions (keys `q.*`), for example: a spider has 8 legs, the Moon pulls the tides, most fresh water is ice.

- Names for Era 1: the text says "nhà làng" (village hall) and "thầy giáo" (teacher), because đình and thầy đồ are from much later times. Check these names (see `QUESTIONS.md`, question 24).
- The art must be correct for the time of each chapter (see `docs/ART.md`, section 7). A history reviewer checks the clothes, the hair, the houses on stilts, the boats, and the tools of Era 1.

## 2. Sensitivity checks

- The game names "quân Ân" (the Ân army) and "tướng quân Ân" (the Ân general) as the legend does. It never names a people of today. Check each text in section 4.
- The word "giặc" (enemy, invader) is not used. Check that the texts stay fair.
- Defeated soldiers retreat. Creatures become calm. There is no blood and no death in the text.
- A note says that the soldiers followed orders and wanted to go home (keys `battle.soldier.note`, `dlg.giong.farewell.n1`).
- Check the art too: the enemy soldiers must not look like a caricature of any group (see `art/README.md`).

## 3. History notes (mark: History or Legend)

| Key | Vietnamese | English |
| --- | --- | --- |
| `battle.river.note` | Thuồng luồng là loài vật sống dưới sông trong truyện dân gian Việt Nam. | The thuồng luồng is a river creature in Vietnamese folk tales. |
| `battle.scouts.note` | Vào đời Hùng Vương thứ sáu, quân Ân kéo đến nước Văn Lang. Lính trinh sát đi trước để dò đường. | In the time of the sixth Hùng King, the Ân army came to the land of Văn Lang. Scouts went first to look at the roads. |
| `battle.soldier.note` | Lính quân Ân làm theo lệnh của vua và tướng. Nhiều người lính cũng nhớ nhà. | The Ân soldiers followed the orders of their king and generals. Many soldiers also missed their homes. |
| `battle.boss.note` (Legend) | Trận đánh ở chân núi Trâu Sơn. Ngày nay, hội Gióng ở Phù Đổng và Sóc Sơn nhớ ơn Thánh Gióng. | The battle was at the foot of Trâu Sơn mountain. Today, the Gióng festival at Phù Đổng and Sóc Sơn remembers Thánh Gióng. |
| `battle.boss.history` (History) | Năm 2010, UNESCO ghi danh hội Gióng là di sản văn hóa phi vật thể. | In 2010, UNESCO listed the Gióng festival as intangible cultural heritage. |
| `vanmieu.note` | Văn Miếu ở Thăng Long được xây năm 1070. Năm 1076, Quốc Tử Giám, trường đại học đầu tiên của Việt Nam, mở ở đây. Từ năm 1484, tên các tiến sĩ được khắc trên bia đá đặt trên lưng rùa. Trong trò chơi, em đi đến Văn Miếu để thi, dù truyện Thánh Gióng xảy ra từ rất lâu trước đó. | Văn Miếu in Thăng Long was built in 1070. In 1076, Quốc Tử Giám, the first university of Vietnam, opened here. From 1484, the names of the doctors were carved on stone steles on the backs of stone turtles. In the game, you travel to Văn Miếu for exams, but the story of Thánh Gióng is from much earlier. |

## 4. Enemies and battle texts

| Key | Vietnamese | English |
| --- | --- | --- |
| `enemy.river.name` | Thuồng luồng con | Little river serpent |
| `enemy.scout.name` | Lính trinh sát quân Ân | Ân army scout |
| `enemy.soldier.name` | Lính quân Ân | Ân army soldier |
| `enemy.general.name` | Tướng quân Ân | Ân army general |
| `battle.won.retreat` | [[an]] rút lui. Làng được bình yên. | The Ân soldiers retreat. The village is safe. |
| `battle.retreat` | {name} rút lui. | {name} retreats. |
| `battle.calm` | {name} đã bình tĩnh lại. | {name} is calm now. |
| `battle.river.intro` | Hai con [[thuongluong]] con đang quậy phá bờ sông. Hãy làm chúng bình tĩnh lại! | Two little [[thuongluong]] make trouble on the river bank. Help them calm down! |
| `battle.scouts.intro` | Hai người lính trinh sát [[an]] cầm đuốc đứng ngoài cổng làng. | Two Ân scouts with torches stand outside the village gate. |
| `battle.soldier.intro` | Một người lính [[an]] chặn đường ở cánh đồng. | A soldier of the Ân army blocks the path in the field. |
| `battle.boss.intro` | Tướng [[an]] đứng ở chân núi Trâu Sơn. Gióng cưỡi ngựa sắt đến bên em. | The Ân general stands at the foot of Trâu Sơn mountain. Gióng rides the iron horse to your side. |
| `battle.patrol.intro` | Một người lính trinh sát [[an]] quay lại dò đường. | An Ân scout came back to look around. |

## 5. Legend dialogues (mark: Legend)

| Key | Vietnamese | English |
| --- | --- | --- |
| `dlg.grandma.intro.n1` | Ngày xưa, vào đời [[hungvuong]] thứ sáu, ở làng [[phudong]] có một em bé tên là {name}. | Long ago, in the time of the sixth [[hungvuong]], a child named {name} lived in the village of [[phudong]]. |
| `dlg.grandma.intro.n2` | {name} là một em bé bình thường, như mọi em bé trong làng. Nhưng anh hùng nào cũng bắt đầu từ nhỏ. | {name} was an ordinary child, like all the children of the village. But every hero starts small. |
| `dlg.grandma.intro.n3` | {name} ơi, cháu dậy rồi à? Hôm nay cụ già làng muốn gặp cháu ở [[dinh]]. | {name}, you are awake! Today the village elder wants to see you at the [[dinh]]. |
| `dlg.grandma.intro.n4` | Cháu muốn đi đâu thì chạm vào chỗ đó. Ngôi sao vàng chỉ chỗ cháu cần đến. | Tap a place to walk there. The yellow star shows where to go. |
| `dlg.messenger.call.n1` | Một sứ giả của nhà vua đứng trước [[dinh]]. Dân làng kéo đến nghe. | A messenger of the king stands in front of the [[dinh]]. The villagers come to listen. |
| `dlg.messenger.call.n2` | Hỡi dân làng! [[an]] đang kéo đến bờ cõi nước ta. Nhà vua tìm người tài giỏi để giúp nước! | People of the village! [[an]] is coming to our land. The king is looking for able people to help the country! |
| `dlg.messenger.call.n3` | Làng ta chỉ có dân thường. Chúng ta làm ruộng, rèn sắt, đánh cá. Ai giúp được đây? | We are ordinary people. We farm, we work iron, and we fish. Who can help? |
| `dlg.messenger.call.n4` | Mọi người ơi! Bé Gióng nhà tôi vừa nói câu đầu tiên! {name}, cháu đến nhà bác ngay nhé! | Everyone! My little Gióng just spoke for the first time! {name}, please come to our house now! |
| `dlg.giong.speaks.n1` | Gióng đã ba tuổi mà chưa biết nói, chưa biết cười. Nhưng hôm nay, khi nghe tiếng sứ giả, Gióng bỗng cất tiếng nói. | Gióng was three years old. He could not speak or laugh. But today, when he heard the messenger, he spoke. |
| `dlg.giong.speaks.n2` | Mẹ ơi, mẹ mời sứ giả vào đây. Con sẽ đi giúp nước, giữ làng. | Mother, please ask the messenger to come in. I will go and help the country and protect our village. |
| `dlg.giong.speaks.n3` | Xin nhà vua làm cho con một con ngựa sắt, một bộ áo giáp sắt và một cây gậy sắt. | Ask the king to make me an iron horse, an iron armor, and an iron staff. |
| `dlg.giong.speaks.n4` | Con ta nói được rồi! Nhưng ngựa sắt thì ai làm được đây? | My son can speak! But who can make an iron horse? |
| `dlg.giong.speaks.n5` | {name} ơi, bạn giúp các bác thợ rèn nhé. Mình sẽ kể cho bạn nghe về sắt và lửa. | {name}, please help the smiths. I will tell you about iron and fire. |
| `dlg.giong.speaks.n6` | Sắt rất cứng. Nhưng trong lửa thật nóng, sắt mềm ra, và thợ rèn uốn được nó. | Iron is very hard. But in a very hot fire, iron gets soft, and the smith can shape it. |
| `dlg.giong.speaks.n7` | Rồi thợ rèn nhúng sắt nóng vào nước. Xèo! Hơi nước bay lên, và sắt cứng lại. | Then the smith puts the hot iron into water. Hiss! Steam goes up, and the iron gets hard again. |
| `dlg.giong.speaks.n8` | Hãy nhớ: lửa làm tan băng, nước dập tắt lửa, lửa gặp nước thì thành hơi nước. Phép lửa và phép nước sẽ giúp bạn. | Remember: fire melts ice, water puts out fire, and fire and water make steam. Fire magic and water magic will help you. |
| `dlg.giong.speaks.n9` | Bác thợ rèn cần 6 miếng sắt. Có quặng sắt trong rặng tre và bên bờ sông. Bạn trả lời thử hai câu này nhé! | The smith needs 6 pieces of iron. There is iron ore in the bamboo and by the river. Now try these two questions! |
| `dlg.giong.rice.n1` | Từ hôm đó, Gióng lớn nhanh như thổi. Cơm ăn mấy cũng không no, áo vừa mặc đã chật. | From that day, Gióng grew very fast. He was always hungry, and new clothes were soon too small. |
| `dlg.giong.rice.n2` | Nhà bác không đủ gạo. Cả làng góp gạo nấu cơm cho Gióng. Cháu giúp bác đếm các nia cơm nhé! | We do not have enough rice. The whole village shares rice for Gióng. Please help me count the baskets of rice! |
| `dlg.giong.grown.n1` | Gióng vươn vai một cái, bỗng thành một chàng trai cao lớn. Gióng mặc áo giáp sắt, cầm gậy sắt, nhảy lên ngựa sắt. | Gióng stretched, and suddenly he was a tall young man. He put on the iron armor, took the iron staff, and jumped onto the iron horse. |
| `dlg.giong.grown.n2` | Cảm ơn {name} và cả làng! Giờ mình đi giữ làng. Bạn đi cùng mình chứ? | Thank you, {name}, and thank you, everyone! Now I go to protect the village. Will you come with me? |
| `dlg.giong.grown.n2.c1` | Có! Mình đi cùng bạn. | Yes! I will come with you. |
| `dlg.giong.grown.n3` | Hai người lính [[an]] đang ở cánh đồng phía đông, ngoài cổng làng. Ta cùng đẩy lùi họ nhé. | Two soldiers of [[an]] are in the fields to the east, outside the village gate. Let us push them back together. |
| `dlg.giong.ready.n1` | Hai người lính [[an]] ở ngoài cánh đồng phía đông. Chạm vào họ để bắt đầu. Mình đi cùng bạn! | Two soldiers of [[an]] are in the fields to the east. Tap them to start. I am with you! |
| `dlg.giong.boss.n1` | Tướng [[an]] đang ở chân núi Trâu Sơn, phía đông bắc. Ta cùng đến đó! | The general of [[an]] is at the foot of Trâu Sơn mountain, to the northeast. Let us go there together! |
| `dlg.staff.breaks.n1` | Rắc! Cây gậy sắt gãy làm đôi! | Crack! The iron staff breaks in two! |
| `dlg.staff.breaks.n2` | {name} ơi, tìm cho mình một cây tre thật chắc! | {name}, find me a strong bamboo! |
| `dlg.bamboo.found.n1` | Gióng nhổ bụi tre bên đường. Cây tre dẻo dai, không gãy! | Gióng pulls up the bamboo by the road. The bamboo bends, but it does not break! |
| `dlg.giong.farewell.n1` | Tướng [[an]] và quân lính rút về nước. Họ cũng mong được về nhà với gia đình. | The Ân general and his soldiers went back to their own land. They also wanted to go home to their families. |
| `dlg.giong.farewell.n2` | Cảm ơn {name}. Bạn đã giúp mình bằng cả trí óc và sức mạnh. | Thank you, {name}. You helped me with your mind and your strength. |
| `dlg.giong.farewell.n3` | Gióng cưỡi ngựa sắt lên đỉnh núi Sóc Sơn, rồi bay lên trời. Dân làng nhớ ơn, gọi Gióng là [[giong]]. | Gióng rode the iron horse to the top of Sóc Sơn mountain, and then he rose into the sky. The people remembered him and called him [[giong]]. |
| `dlg.giong.farewell.n4` | Truyền thuyết kể rằng lửa từ miệng ngựa sắt làm vàng những bụi tre bên đường. Đó là tre đằng ngà. | The legend says that the fire of the iron horse turned the bamboo by the road yellow. People call it tre đằng ngà, golden bamboo. |
| `dlg.giong.farewell.n5` | Làng ta bình yên rồi. Giờ cháu hãy đến [[vanmieu]] để thi. Đi về phía nam, qua cầu. | Our village is safe now. Now go to [[vanmieu]] for the exam. Go south, over the bridge. |

## 6. Mentors, titles, and meanings of names

| Key | Vietnamese | English |
| --- | --- | --- |
| `calling.scholar.mentor` | Người thầy: Chu Văn An | Mentor: Chu Văn An |
| `calling.smith.mentor` | Người thầy: những thợ rèn làm ngựa sắt | Mentor: the smiths of the iron horse |
| `calling.fisher.mentor` | Người thầy: Yết Kiêu | Mentor: Yết Kiêu |
| `calling.healer.mentor` | Người thầy: Tuệ Tĩnh | Mentor: Tuệ Tĩnh |
| `calling.woodcutter.mentor` | Người thầy: Thạch Sanh | Mentor: Thạch Sanh |
| `title.play` | Chơi tiếp: {name} | Play: {name} |
| `title.new` | Tạo anh hùng mới | Make a new hero |
| `title.tu-tai.name` | Tú tài | Tú tài |
| `title.cu-nhan.name` | Cử nhân | Cử nhân |
| `title.tien-si.name` | Tiến sĩ | Tiến sĩ |
| `title.bang-nhan.name` | Bảng nhãn | Bảng nhãn |
| `title.trang-nguyen.name` | Trạng nguyên | Trạng nguyên |
| `title.tu-tai.about` | Danh hiệu đầu tiên của người học. | The first title of a scholar. |
| `title.cu-nhan.about` | Người đỗ kỳ thi Hương. | A person who passed the regional exam (thi Hương). |
| `title.tien-si.about` | Người đỗ kỳ thi Hội và thi Đình. | A person who passed the national exams (thi Hội and thi Đình). |
| `title.bang-nhan.about` | Người đỗ thứ hai ở kỳ thi Đình. | The person in second place at the palace exam (thi Đình). |
| `title.trang-nguyen.about` | Người đỗ đầu kỳ thi Đình. Cần đỗ cả năm thời đại. | The person in first place at the palace exam (thi Đình). It needs a pass in all five eras. |

Short meanings of names in English mode (the first time a name shows):

| Key | Vietnamese | English |
| --- | --- | --- |
| `gloss.vanmieu.meaning` | Văn Miếu | the Temple of Literature |
| `gloss.phudong.meaning` | Phù Đổng | Gióng's village |
| `gloss.giong.meaning` | Thánh Gióng | Saint Gióng, a hero of legend |
| `gloss.hungvuong.meaning` | Hùng Vương | a Hùng King, one of the first kings of Vietnam in legend |
| `gloss.thanglong.meaning` | Thăng Long | the old name of Hà Nội |
| `gloss.dinh.meaning` | nhà làng | the big house on stilts where the village meets |
| `gloss.tutai.meaning` | Tú tài | the first scholar title |
| `gloss.song.meaning` | Sóng | Wave |
| `gloss.tre.meaning` | tre | bamboo |
| `gloss.vanvo.meaning` | văn võ song toàn | complete in both learning and strength |
| `gloss.nghe.meaning` | nghề | a calling, the work of your life |
| `gloss.an.meaning` | quân Ân | the army of the Ân kingdom in the legend |
| `gloss.thuongluong.meaning` | thuồng luồng | a river serpent of Vietnamese folk tales |
| `gloss.nghecalf.meaning` | Nghé | a young water buffalo |

## 7. Questions about the legend

| Key | Vietnamese | English |
| --- | --- | --- |
| `q.legend.bamboo.prompt` | Khi gậy sắt gãy, Thánh Gióng dùng gì? | When the iron staff broke, what did Thánh Gióng use? |
| `q.legend.bamboo.hint` | Cây này mọc quanh mọi làng Việt. | This plant grows around every Vietnamese village. |
| `q.legend.bamboo.explain` | Theo truyền thuyết, Gióng nhổ những bụi tre bên đường. | In the legend, Gióng pulled up bamboo by the road. |
| `q.legend.bamboo.c1` | Những bụi tre | Bamboo |
| `q.legend.bamboo.c2` | Cái lưới đánh cá | A fishing net |
| `q.legend.bamboo.c3` | Nồi cơm | A rice pot |
| `q.legend.smiths.prompt` | Ai làm ngựa sắt cho Gióng? | Who made the iron horse for Gióng? |
| `q.legend.smiths.hint` | Họ làm việc bên lò lửa và cái đe. | They work with fire and an anvil. |
| `q.legend.smiths.explain` | Thợ rèn nung sắt và làm ngựa sắt, áo giáp sắt và gậy sắt. | The smiths heated iron and made the horse, the armor, and the staff. |
| `q.legend.smiths.c1` | Những người thợ rèn | The smiths |
| `q.legend.smiths.c2` | Những người đánh cá | The fishers |
| `q.legend.smiths.c3` | Đàn chim | The birds |
| `q.legend.village.prompt` | Làng của Gióng tên là gì? | What was the name of Gióng's village? |
| `q.legend.village.hint` | Em đang ở làng này. | You are in this village now. |
| `q.legend.village.explain` | Gióng ở làng Phù Đổng. Ngày nay làng thuộc Hà Nội. | Gióng lived in the village of Phù Đổng. Today it is part of Hà Nội. |
| `q.legend.village.c1` | Phù Đổng | Phù Đổng |
| `q.legend.village.c2` | Bạch Đằng | Bạch Đằng |
| `q.legend.village.c3` | Hồ Gươm | Hồ Gươm |
| `q.legend.storm.prompt` | Cây tre làm gì khi có bão? | What does bamboo do in a storm? |
| `q.legend.storm.hint` | Tên của trò chơi này nghĩa là cây tre. | The name of this game means bamboo. |
| `q.legend.storm.explain` | Tre dẻo. Tre uốn cong trong bão rồi đứng thẳng lại. | Bamboo bends in a storm. Then it stands up again. |
| `q.legend.storm.c1` | Uốn cong nhưng không gãy | It bends and does not break |
| `q.legend.storm.c2` | Bay đi mất | It flies away |
| `q.legend.storm.c3` | Biến thành sắt | It turns into iron |
| `q.legend.rice.prompt` | Cả làng nấu cơm cho Gióng ăn. Vì sao? | The whole village cooked rice for Gióng. Why? |
| `q.legend.rice.hint` | Mọi người cùng góp sức. | Everyone helped together. |
| `q.legend.rice.explain` | Theo truyền thuyết, cả làng góp gạo nuôi Gióng lớn lên để bảo vệ làng. | In the legend, all the people shared their rice, so Gióng grew up fast to protect the land. |
| `q.legend.rice.c1` | Để Gióng lớn nhanh, bảo vệ làng | So he could grow strong and protect the village |
| `q.legend.rice.c2` | Chỉ để ăn Tết | Only for a festival |
| `q.legend.rice.c3` | Để bán lấy tiền | To sell it |

## 8. All other Vietnamese text

All other keys in `i18n/vi.json` also need a language review. The table shows the groups of keys and the number of texts in each group.

| Group | Texts | What it is |
| --- | --- | --- |
| `app.*` | 2 | Game name and tagline |
| `battle.*` | 41 | Battle texts |
| `calling.*` | 30 | Callings |
| `craft.*` | 13 | The forge |
| `create.*` | 14 | Hero creation |
| `dlg.*` | 79 | Dialogues |
| `element.*` | 14 | Element magic texts |
| `enemy.*` | 4 | Enemy names |
| `ex.*` | 25 | Worked examples |
| `exam.*` | 14 | Văn Miếu exams |
| `friend.*` | 1 | Creature friend |
| `gloss.*` | 26 | Names and short meanings |
| `hint.*` | 33 | Hints after a mistake |
| `home.*` | 12 | The home of the hero |
| `item.*` | 4 | Items |
| `lang.*` | 2 | Language names |
| `lesson.*` | 1 | Lesson title |
| `map.*` | 8 | Signs and places on the map |
| `mark.*` | 2 | Legend and History marks |
| `mastery.*` | 4 | Mastery states |
| `npc.*` | 15 | Names of people |
| `parent.*` | 78 | Parent area |
| `place.*` | 4 | Place value names |
| `practice.*` | 5 | Practice with the teacher |
| `praise.*` | 5 | Praise |
| `prob.*` | 30 | Math problem prompts |
| `q.*` | 408 | Hand-written questions (science, legend): prompt, choices, hint, explanation |
| `quest.*` | 19 | Quest goals |
| `quiz.*` | 9 | Question screens |
| `rice.*` | 1 | Rice task title |
| `shape.*` | 6 | Shape names |
| `skill.*` | 39 | Skill names (parent page) |
| `state.*` | 3 | Element states |
| `subject.*` | 4 | Subject names |
| `time.*` | 2 | Time limit |
| `title.*` | 12 | Scholar titles |
| `trial.*` | 7 | The Five Trials |
| `ui.*` | 15 | Buttons and messages |
| `vanmieu.*` | 5 | Văn Miếu |

Total: 996 texts in each language.

## 8. Texts changed after the audit of the first slice

- `dlg.elder.intro.n1`: "năm người tài giỏi" in place of "năm người thợ giỏi", because the teacher is not a worker (thợ).
- `trial.*.done`: the end text of each trial names the topics of the questions that the player answered (param `{topics}`, the names of the skills).
- `dlg.river.friends.*`: the young buffalo Nghé comes with the hero after the river battle. Sóng can come too, or stay with the river.
- `quest.*`: shorter quest texts for the quest bar.
- `grade.*`: the names of the grades, with "lớp Chồi" (Pre-K) and "lớp Lá" (K).
- `battle.won.retreat`, `battle.boss.intro`, `dlg.giong.boss.n1`, `dlg.giong.farewell.n1`: the glossary name of `[[an]]` is "quân Ân", so the text says "Tướng [[an]]" ("Tướng quân Ân") and "[[an]] rút lui" ("Quân Ân rút lui"), with no word two times.
- `title.new`, `create.look`, `dlg.grandma.intro.n1`, `dlg.grandma.intro.n2`, `dlg.giong.silent.n1`, `dlg.river.friends.n3`, `dlg.river.friends.n4`, `dlg.river.friends.n6`: the player is the hero. The narrator speaks to the player as "em" (English: "you").

