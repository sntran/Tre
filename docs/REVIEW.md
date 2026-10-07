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
- The looks of the people in the voxel world (`data/figures.json`, see `QUESTIONS.md`, question 39). A history reviewer checks each look for the time of the Hùng Kings:
  - The elder, the elder of Sóc Sơn, and the teacher wear long robes. The elder carries a staff, and the teacher a scroll.
  - The grandmother, the mother, and the healer wear a skirt; the mother wears a yếm. The grandmother carries a fan, and the healer a basket.
  - The smith has a bare top and a hammer. The woodcutter has an axe. The fisher has a nón and a net. The messenger has a head band and a drum.
  - Gióng as a hero wears grey armor with a head band and carries a staff.
  - The scouts and the soldiers of Ân wear helmets and carry blunt staffs. The general has a plume, a beard, and a staff.
  - The houses on stilts have thatch roofs with a ridge that curves up at the ends. The đình (nhà làng) has a vermilion ridge and bird-head finials, as on the Đông Sơn bronze drums.

- Tết in the world of Era 1 (the small joys of #12, `docs/WORLD.md`, "The world at rest"). The game shows Tết on two days of each game year, with no text. A history reviewer decides what stays for the time of the Hùng Kings:
  - Bánh chưng in a big pot over a fire in the yard of the đình (nhà làng). The legend of Lang Liêu puts bánh chưng in the time of the sixth Hùng King, so it can stay.
  - Red couplets (câu đối đỏ) on the door posts. Couplets are written in Chinese or Nôm characters, from a much later time. With no characters on them, are plain red strips good, or must they go?
  - Peach blossoms (hoa đào) on the trees. Is the peach blossom of Tết in the north from this time?
  - A lion dance (múa lân) at noon, with a drum. The lion dance came later. Must it go, or change to a dance of this time (for example, a dance with a drum and bamboo, as on the bronze drums)?
  - The other joys have no history question: a frog, ducklings, a kingfisher, a golden bamboo shoot (the golden bamboo of the legend of Gióng), a rainbow, puddles, footprints, a shooting star, and a firefly.

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
| `dlg.giong.speaks.n3` | Xin nhà vua làm cho con một con ngựa sắt, một bộ áo giáp sắt và một cây roi sắt. | Ask the king to make me an iron horse, an iron armor, and an iron whip. |
| `dlg.giong.speaks.n4` | Con ta nói được rồi! Nhưng ngựa sắt thì ai làm được đây? | My son can speak! But who can make an iron horse? |
| `dlg.giong.speaks.n5` | {name} ơi, bạn giúp các bác thợ rèn nhé. Mình sẽ kể cho bạn nghe về sắt và lửa. | {name}, please help the smiths. I will tell you about iron and fire. |
| `dlg.giong.speaks.n6` | Sắt rất cứng. Nhưng trong lửa thật nóng, sắt mềm ra, và thợ rèn uốn được nó. | Iron is very hard. But in a very hot fire, iron gets soft, and the smith can shape it. |
| `dlg.giong.speaks.n7` | Rồi thợ rèn nhúng sắt nóng vào nước. Xèo! Hơi nước bay lên, và sắt cứng lại. | Then the smith puts the hot iron into water. Hiss! Steam goes up, and the iron gets hard again. |
| `dlg.giong.speaks.n8` | Hãy nhớ: lửa làm tan băng, nước dập tắt lửa, lửa gặp nước thì thành hơi nước. Phép lửa và phép nước sẽ giúp bạn. | Remember: fire melts ice, water puts out fire, and fire and water make steam. Fire magic and water magic will help you. |
| `dlg.giong.speaks.n9` | Bác thợ rèn cần 6 miếng sắt. Có quặng sắt trong rặng tre và bên bờ sông. Bạn trả lời thử hai câu này nhé! | The smith needs 6 pieces of iron. There is iron ore in the bamboo and by the river. Now try these two questions! |
| `dlg.giong.rice.n1` | Từ hôm đó, Gióng lớn nhanh như thổi. Cơm ăn mấy cũng không no, áo vừa mặc đã chật. | From that day, Gióng grew very fast. He was always hungry, and new clothes were soon too small. |
| `dlg.giong.rice.n2` | Nhà bác không đủ gạo. Cả làng góp gạo nấu cơm cho Gióng. Cháu giúp bác đếm các nia cơm nhé! | We do not have enough rice. The whole village shares rice for Gióng. Please help me count the baskets of rice! |
| `dlg.giong.grown.n1` | Gióng vươn vai một cái, bỗng thành một chàng trai cao lớn. Gióng mặc áo giáp sắt, cầm roi sắt, nhảy lên ngựa sắt. | Gióng stretched, and suddenly he was a tall young man. He put on the iron armor, took the iron whip, and jumped onto the iron horse. |
| `dlg.giong.grown.n2` | Cảm ơn {name} và cả làng! Giờ mình đi giữ làng. Bạn đi cùng mình chứ? | Thank you, {name}, and thank you, everyone! Now I go to protect the village. Will you come with me? |
| `dlg.giong.grown.n2.c1` | Có! Mình đi cùng bạn. | Yes! I will come with you. |
| `dlg.giong.grown.n3` | Hai người lính [[an]] đang ở cánh đồng phía đông, ngoài cổng làng. Ta cùng đẩy lùi họ nhé. | Two soldiers of [[an]] are in the fields to the east, outside the village gate. Let us push them back together. |
| `dlg.giong.ready.n1` | Hai người lính [[an]] ở ngoài cánh đồng phía đông. Chạm vào họ để bắt đầu. Mình đi cùng bạn! | Two soldiers of [[an]] are in the fields to the east. Tap them to start. I am with you! |
| `dlg.giong.boss.n1` | Tướng [[an]] đang ở chân núi Trâu Sơn, phía đông bắc. Ta cùng đến đó! | The general of [[an]] is at the foot of Trâu Sơn mountain, to the northeast. Let us go there together! |
| `dlg.staff.breaks.n1` | Rắc! Cái roi sắt gãy làm đôi! | Crack! The iron whip breaks in two! |
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
| `q.legend.bamboo.prompt` | Khi roi sắt gãy, Thánh Gióng dùng gì? | When the iron whip broke, what did Thánh Gióng use? |
| `q.legend.bamboo.hint` | Cây này mọc quanh mọi làng Việt. | This plant grows around every Vietnamese village. |
| `q.legend.bamboo.explain` | Theo truyền thuyết, Gióng nhổ những bụi tre bên đường. | In the legend, Gióng pulled up bamboo by the road. |
| `q.legend.bamboo.c1` | Những bụi tre | Bamboo |
| `q.legend.bamboo.c2` | Cái lưới đánh cá | A fishing net |
| `q.legend.bamboo.c3` | Nồi cơm | A rice pot |
| `q.legend.smiths.prompt` | Ai làm ngựa sắt cho Gióng? | Who made the iron horse for Gióng? |
| `q.legend.smiths.hint` | Họ làm việc bên lò lửa và cái đe. | They work with fire and an anvil. |
| `q.legend.smiths.explain` | Thợ rèn nung sắt và làm ngựa sắt, áo giáp sắt và roi sắt. | The smiths heated iron and made the horse, the armor, and the staff. |
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
| `calling.*` | 30 | Callings |
| `create.*` | 15 | Hero creation |
| `dlg.*` | 98 | Dialogues |
| `ex.*` | 25 | Worked examples |
| `exam.*` | 14 | Văn Miếu exams |
| `friend.*` | 4 | Creature friend |
| `gloss.*` | 28 | Names and short meanings |
| `hint.*` | 33 | Hints after a mistake |
| `home.*` | 12 | The home of the hero |
| `item.*` | 4 | Items |
| `lang.*` | 2 | Language names |
| `lesson.*` | 1 | Lesson title |
| `map.*` | 11 | Signs and places on the map |
| `mark.*` | 2 | Legend and History marks |
| `mastery.*` | 4 | Mastery states |
| `npc.*` | 17 | Names of people |
| `parent.*` | 82 | Parent area |
| `place.*` | 7 | Place value names |
| `practice.*` | 5 | Practice with the teacher |
| `praise.*` | 5 | Praise |
| `prob.*` | 30 | Math problem prompts |
| `q.*` | 408 | Hand-written questions (science, legend): prompt, choices, hint, explanation |
| `quest.*` | 22 | Quest goals |
| `share.*` | 1 | The share of the loot after a raid |
| `quiz.*` | 9 | Question screens |
| `shape.*` | 6 | Shape names |
| `skill.*` | 39 | Skill names (parent page) |
| `state.*` | 3 | Element states |
| `subject.*` | 4 | Subject names |
| `time.*` | 6 | Time limit |
| `title.*` | 12 | Scholar titles |
| `trial.*` | 1 | The Five Trials |
| `ui.*` | 21 | Buttons and messages |
| `vanmieu.*` | 6 | Văn Miếu |

Total: 996 texts in each language.

## 8. Texts changed after the audit of the first slice

- `dlg.elder.intro.n1`: "năm người tài giỏi" in place of "năm người thợ giỏi", because the teacher is not a worker (thợ).
- `trial.*.done`: the end text of each trial names the topics of the questions that the player answered (param `{topics}`, the names of the skills).
- `dlg.river.friends.*`: the young buffalo Nghé comes with the hero after the river battle. Sóng can come too, or stay with the river.
- `quest.*`: shorter quest texts for the quest bar.
- `grade.*`: the names of the grades, with "lớp Chồi" (Pre-K) and "lớp Lá" (K).
- `battle.won.retreat`, `battle.boss.intro`, `dlg.giong.boss.n1`, `dlg.giong.farewell.n1`: the glossary name of `[[an]]` is "quân Ân", so the text says "Tướng [[an]]" ("Tướng quân Ân") and "[[an]] rút lui" ("Quân Ân rút lui"), with no word two times.
- `title.new`, `create.look`, `dlg.grandma.intro.n1`, `dlg.grandma.intro.n2`, `dlg.giong.silent.n1`, `dlg.river.friends.n3`, `dlg.river.friends.n4`, `dlg.river.friends.n6`: the player is the hero. The narrator speaks to the player as "em" (English: "you").
- `friend.name.title`, `friend.name.note`, `dlg.river.friends.n2.c1`, `dlg.river.friends.n5.c1`: the player gives a name to Nghé and Sóng.
- `battle.guard.shield`: the line that tells that an enemy raises a number shield.
- `parent.tab.learning` and `research.*`: the learning tab of the parent area (the researcher view and the shared summary), for parents. The texts must be plain, and they must not judge the child.
- `world.bridge.long`: the fisher calls out when a plank is too long and sticks out past the far end of the bridge. The line must not name a number or a math operation.

- The rule of the world (checked by the stories, `docs/STORIES.md`): no text in the village or a raid has a digit, an operator, or a question mark. These texts changed: `dlg.grandma.intro.n3`, `dlg.elder.trials.wait.n1`, `dlg.fisher.trial.n1`, `dlg.teacher.practice.n1`, `dlg.smith.need.iron.n1`, `dlg.smith.forge.n1`, `dlg.woodcutter.ore.n1`, `dlg.grandma.home.n1`, `dlg.giong.wait.n1`, `dlg.messenger.call.n3`, `dlg.giong.speaks.n4`, `dlg.giong.speaks.n9`, `dlg.giong.grown.n2`, `dlg.scouts.won.n1`, and `map.ore.found`. A question became a statement, and a number became a word ("sáu", "six"). The found ore does not say its number: the iron flies to its counter in the HUD. Please check that the Vietnamese lines still sound natural.

## 9. Found by the stories

- A long tap walk through the village (for example from the north road to the west road of Phù Đổng) stops with the event `stuck` when a person stands on the way, and the hero waits there. The child can tap again. This was so before the stories; see question 60.
- The Five Trials as work (#4): `dlg.teacher.trial.n1`, `dlg.smith.trial.n1`, `dlg.fisher.trial.n1`, `dlg.healer.trial.n1`, and `dlg.woodcutter.trial.n1` now say the work in words; the new `dlg.*.trial.done.n1` lines name the calling; `num.2` to `num.10` are the number words that the talks use. The old texts of the trial screens (`trial.title`, `trial.*.done`) are gone. Please check the names of the herbs (ngải cứu, tía tô, rau má) and the words đăng (a fish trap of stakes), phao, and lạt (a straw band).

## 10. The raids

The battle screen is gone, and its texts too (`battle.*` and `enemy.*`). New and changed texts for the raids (#5), in `i18n/vi.json` and `i18n/en.json`:

- `raid.scouts.intro`, `raid.patrol.intro`, `raid.river.intro`, `raid.soldier.intro`, `raid.boss.intro`: the line before each raid. It tells where the enemies come from, with no rule and no numeral.
- `raid.lost`: after a lost raid ("Quân giặc lấy một ít đồ rồi đi. Chúng có thể quay lại.").
- `history.giong.festival`: the fact of history after the boss, with its year (question 74: the digit law does not check `history.*` keys and place names).
- `raid.river.note`, `raid.scouts.note`, `raid.soldier.note`, `raid.boss.note`: the notes of the old battles, with the same text and a new name.

Please check the words ngã tư (the crossroads), đuốc (a torch), bẫy (a trap), and cái ná (the slingshot), and whether "thuồng luồng con" reads well for a small river creature.

### The raids after the review (#5)

- `raid.tool.sling`, `raid.tool.gate`, `raid.tool.traps` (the elder), and `raid.tool.helpers`, `raid.tool.nghe`, `raid.tool.water`, `raid.tool.fire`, `raid.tool.lightning` (the smith): one line the first time that a tool comes. The elder and the smith call the child "cháu".
- `raid.trap.ask` ("Đặt một cái bẫy ở cột {post}.") with `ord.1` to `ord.4` ("thứ nhất" to "thứ tư"; "first" to "fourth").
- `raid.scouts.pause`, `raid.river.pause`, `raid.soldier.pause`, `raid.boss.pause`: the line of the map in a raid.
- `raid.river.intro` now says that the serpents are hungry and that the child throws rice balls ("nắm cơm").

## 11. The work of the story (#6)

The crafting screen of the iron horse is gone, and its texts too (`craft.*` and `element.*`). New and changed texts, in `i18n/vi.json` and `i18n/en.json`:

- `dlg.giong.rice.n2`: the mother says the work: carry the trays to the pot; each ten bowls, Gióng grows one head taller.
- `dlg.smith.forge.n1` and `dlg.smith.forge.n2`: the smith takes the iron, adds old iron, and says the work: "exactly {lumps} lumps" in the forge, then the bellows, then the water. `dlg.smith.horse.n1`: the iron horse is ready (the old text of `craft.horse.done`).
- `dlg.woodcutter.staffs.n1`, `dlg.woodcutter.staffs.n2`, and `dlg.woodcutter.staffs.done.n1`: the bamboo staffs for the men of the village; the stem has a ring at each half block, and each slash cuts at once. `quest.defend.staffs`: the goal in the quest bar.
- `share.start`: the line before the share of the loot ("Hãy chia đều cho cháu, Nghé và Gióng.").

Please check the words ống bễ (the bellows), đốt (a ring of the bamboo), and whether "chia đều" reads well for a child of 6.

## 12. The generated land and the small events (#7)

New texts, in `i18n/vi.json` and `i18n/en.json`:

- `num.1` to `num.30`: the number words that the people of the events say ("một" to "ba mươi"; "one" to "thirty"). Please check "hai mươi mốt", "hai mươi lăm", and "mười lăm".
- The cart stuck on the road: `event.cart.start` ("Bánh xe bò của bác sa xuống bùn rồi. Cái hố cần {need} hòn đá. ..."), `event.cart.short`, `event.cart.over`, `event.cart.done`. The carter calls the child "cháu".
- The flood on a field: `event.flood.start` ("... Phải tát {need} thùng nước ra mương. ..."), `event.flood.short`, `event.flood.over`, `event.flood.done`. Please check "tát nước" (to bail water) and "mương" (a ditch).
- The market day: `event.market.start` ("Hôm nay có phiên chợ. Một nắm cơm giá {need} đồng. ..."), `event.market.short`, `event.market.over`, `event.market.done`, `event.market.poor`. See `QUESTIONS.md`, question 91: coins and the market in the time of the Hùng Kings.
- The lost ducks: `event.duck.start` ("Đàn vịt của cô có {need} con, mà vài con lạc mất rồi. ..."), `event.duck.short`, `event.duck.over`, `event.duck.done`.

Facts and looks to check:

- The generated hamlets (`docs/WORLD.md`, "One continuous world") have no names and are not historical places. A history reviewer checks their houses on stilts, the areca palms (cây cau), the boats with a cover (mui), and the clothes of the villagers from parts (`villagers` in `data/figures.json`): shirts and trousers or skirts, a nón or a head band.
- The real directions of the story places of Era 1 on the plane of the region (`data/world/land-giong.json`): Núi Trâu to the east-northeast, Sóc Sơn to the north-northwest, and Văn Miếu to the west-southwest of Phù Đổng, over the Đuống and the Hồng. The Đuống flows west from Phù Đổng and joins the Hồng north of the ferry.
- The real hills (`docs/WORLD.md`, "One continuous world"): Núi Trâu is the line of low hills near Châu Cầu in Quế Võ (#27; the highest top in the SRTM tiles at 106.230 E, 21.140 N, about 71 m), with the fields at its foot (before #27 it was Núi Dạm, at 106.100 E, 21.145 N, about 130 m); the hill of Sóc Sơn is núi Vệ Linh with Đền Sóc (the top at 105.825 E, 21.290 N, about 262 m). Please check that these are the right hills.
- After the review: the suggested lines are in: `event.cart.start` ("Bánh xe bò của bác lún xuống bùn rồi. Phải chèn {need} hòn đá vào hố mới được. ..."), `event.flood.start` ("Mưa to quá, ruộng của cô ngập rồi. Phải đổ {need} thùng nước ra mương. Cháu xách nước ra mương, rồi gọi cô nhé.") and `event.flood.short`. New: `event.duck.start` ("Đàn vịt của cô có {need} con, con nào cũng lông trắng, đầu xanh. Vài con lạc mất rồi. Vịt lông nâu là vịt nhà khác đấy. ...") and `event.duck.over` ("Vịt lông nâu là vịt nhà khác, cháu ạ. Cô thả nó về nhà nó nhé."). The story `event-duck` has a new about line.
- The round roof of the hamlets (a low dome of thatch, from the houses on the bronze drums) and the big jar of water by a pond: please check the look.
- The story `climb-nui-trau` (new text in `tests/stories/climb-nui-trau.json`): "Từ sân dưới chân núi Trâu, đi theo đường mòn lên đỉnh núi: đường mòn lượn theo sườn núi, qua rừng và vách đá." Please check "đường mòn" (a path) and "vách đá" (a rock face).


## 13. The continuous world (#18)

New texts, in `i18n/vi.json` and `i18n/en.json`. The hero says them at an edge of the world, once in a game day for each edge:

- `edge.sea`: "Biển sâu quá." ("The sea is too deep."), at the deep sea, after the hero wades to the knee and takes two steps back.
- `edge.mist`: "Phía nam còn mù sương." ("The south is still in the mist."), at the south end of the land of the era (18° N in Era 1).
- `edge.mist.far`: "Phía trước còn mù sương." ("The land ahead is still in the mist."), at the land of another country.

New about lines of the stories (in `tests/stories/`):

- `walk-soc-son`: "Đi bộ từ đình Phù Đổng lên đỉnh núi Sóc Sơn, theo con đường về phía bắc, không qua cửa chuyển cảnh nào; Nghé đi theo suốt đường." Please check "cửa chuyển cảnh" (a change of scene).
- `sea-edge`: "Ở bờ biển phía đông: em lội ra chỗ nước ngang gối, rồi dừng lại, quay lại hai bước: biển sâu quá. Nghé đứng lại trên bờ. Câu nói chỉ hiện một lần trong ngày."
- `mist-edge`: "Ở cuối phía nam của vùng đất thời này: em đi vào màn sương, bước chậm lại; Nghé dừng lại và kêu; em quay lại hai bước: phía nam còn mù sương."
- `save-chunks`: "Bản lưu giữ những gì đã thay đổi ở từng vùng: chặt một cây, đi xa bốn vùng rồi quay lại, lưu và mở lại. Cây vẫn không còn, và không có gì khác thay đổi." Please check "vùng" for a chunk of the world.

New texts after the review of #18:

- `world.market.north`, `.south`, `.east`, `.west`: "Hôm nay xóm phía bắc có phiên chợ đấy." ("There is a market today in the hamlet to the north."), and the same for the south, the east, and the west. A person in Phù Đổng says it on a market day, one time in a day.
- `map.ferry.river`: "Bác lái đò chở em và [[nghecalf]] qua sông." ("The ferryman takes you and the calf across the river in his boat."), at a ferry where a road of the land crosses a big river.

New about lines of the stories after the review:

- `ferry`: "Ở bến sông Hồng: chiếc đò chở em và Nghé sang sông, không qua cảnh chuyển nào; đò đi trên mặt nước, rồi cả hai bước lên bờ bên kia. Em quay lại bến, và đò chở em về."
- `market-crier`: "Hôm nay là phiên chợ của xóm phía đông: bà ở làng chào em và nói có chợ. Em đi về phía đông, tới sân của xóm, và người bán hàng đang đợi ở đó."
- `pot-far`: "Em làm vỡ một cái vò, rồi đi xa. Trong đêm, vò được thay mới, cả khi em ở xa; sáng hôm sau em quay lại và thấy vò mới."

Facts to check:

- The south edge of Era 1 follows the crest of the Hoành Sơn range (Đèo Ngang), near 18° N, between Hà Tĩnh and Quảng Bình. See `QUESTIONS.md`, question 99.
- The rivers of Era 1 on the plane: the Hồng, the Đuống, the Thái Bình, the Bạch Đằng, the Mã, and the Cả, each with a width from its size. The Hồng has ferries, and a smaller river has a ford or a bamboo bridge. See `QUESTIONS.md`, question 103.
- The line of the land of Era 1 at 18° N (near Hà Tĩnh and Quảng Bình): the land of Văn Lang in the legends reaches about there. See `QUESTIONS.md`, question 99.
- The scale: one cell is 45 m of real land, and the story places stand at their real places (the đình of Phù Đổng, núi Vệ Linh, Núi Trâu, Văn Miếu). See `docs/WORLD.md`, "The scale".

## 14. The faces and the hair (#19)

No new texts. Please check the hair styles of the people for the time of the Hùng Kings (`docs/ART.md`, section 15): a fringe parted on the side (`short`), the hair pulled back to a knot on the crown with a red tie (`topknot`), long hair with a part in the middle, two braids with red ties, a low bun with a pin, and the tuft of a child (trái đào) on a short crop. The grey hair of grandma and the healer is a bun; the elders with a beard have short grey hair.

## 15. The ground (#20)

No new texts. Please check the ground of the Red River delta for the time of the Hùng Kings (`docs/ART.md`, section 18): earth roads with wheel ruts on low banks through the paddies, village paths and yards of packed earth, mounds (gò) with bamboo or a tree among the paddies, and short ditches (mương) of still water. The paths were of brick first; bricks are later than the time (the brick tombs of the Red River region are of the Han time), so the paths are packed earth now. The owner keeps the carts and their ruts.

## 16. Xóm Ruộng and the planting (#22)

New texts to check (keys in `i18n/vi.json` and `i18n/en.json`):

- The place and the people: `place.xomruong`, the names of the people (now by the region and the era, section on #38), and the one line of each person who is not ready yet (`dlg.duck-girl.idle.n1`, `dlg.fisher-uncle.idle.n1`, `dlg.drummer.idle.n1`).
- The planter: `dlg.planter.trial.n1` (the start), `plant.wait`, `plant.exact` (the total as a word: "{n} cây, vừa đủ!"), `plant.turned`, `plant.few`, `plant.many`, `plant.choose.no`, `plant.divide.few`, `plant.divide.many`, the ends of a set (`dlg.planter.set.field.n1`, `dlg.planter.set.noon.n1`, `dlg.planter.set.rain.n1`, `dlg.planter.practice.end.n1`), the small events (`plant.event.*`), and the picture of the mentor (`mentor.picture.planter`).
- The number words from 31 to 150 (`num.31` to `num.150`): "mốt" after twenty, "lăm" for five after ten, "lẻ" after a hundred ("một trăm lẻ năm").
- The practice links: `practiceLink.cay-lua.*` and `practiceLink.xom-ruong.*`; the parent page: `parent.facts*`.

Facts to check:

- Xóm Ruộng is not a historical place, and its people are not real people. Rice planting by hand from bundles of seedlings (bó mạ) from a seedbed (ruộng mạ), and the planting song (hò cấy), are old customs of the Red River delta; please check the clothes and the tools of the planter for the time of the Hùng Kings (`docs/ART.md`).
- The bronze drum (trống đồng) in the đình yard: the drums of the Đông Sơn culture are from the time of the Hùng Kings; the đình itself is a later building (see question 24 in `QUESTIONS.md`).


## 17. The ducks, the fish traps, the drum dance, and the feast (#23)

New texts to check (keys in `i18n/vi.json` and `i18n/en.json`):

- The duck girl: `dlg.duck-girl.trial.n1`, `ducks.show.groups`, `ducks.show.double`, `ducks.show.mixed`, `ducks.exact`, `ducks.few`, `ducks.many`, the ends of a set (`dlg.duck-girl.set.done.n1`, `dlg.duck-girl.set.stop.n1`, `dlg.duck-girl.practice.end.n1`). She says "chị" and the child is "em".
- The fisher uncle: `dlg.fisher-uncle.trial.n1`, `traps.need`, `traps.need.given`, `traps.exact`, `traps.few`, `traps.many`, `traps.wait`, the ends of a set (`dlg.fisher-uncle.set.*`, `dlg.fisher-uncle.practice.end.n1`).
- The old drummer: `dlg.drummer.trial.n1`, `drum.show.one`, `drum.show.middle`, `drum.show.two`, `drum.clean`, `drum.done`, `drum.wait`, the ends of a set (`dlg.drummer.set.*`, `dlg.drummer.practice.end.n1`).
- The small events (`hamlet.event.duck-runs`, `hamlet.event.kingfisher`, `hamlet.event.child-joins`), the lines that point to another station (`hamlet.point.*`), the feast (`hamlet.feast`), and the lines of the mentors (`mentor.ducks.mark`, `mentor.traps.*`, `mentor.drum.mark`, `mentor.picture.duck-girl`, `mentor.picture.fisher-uncle`, `mentor.picture.drummer`).
- The practice links: `practiceLink.cho-vit-an.*`, `practiceLink.dat-lo.*`, `practiceLink.mua-trong.*`.
- Removed: the one line of each person who was not ready (`dlg.duck-girl.idle.n1`, `dlg.fisher-uncle.idle.n1`, `dlg.drummer.idle.n1`).

Facts to check:

- The fish trap (lờ) of bamboo, the small weir of bamboo across a stream, and feeding ducks from a trough are old customs of the Red River delta. The sizes of the traps (two, five, and ten fish, shown by rings) are a picture for the game, not a real measure.
- The feast of the new rice (lễ cơm mới) is an old custom after the harvest; in the game it comes when the table has eggs, fish, and the new rice, on any day of the year.
- The bronze drum (trống đồng) and a dance to it: the drums of the Đông Sơn culture show dancers with feathers. The dancers of the game wear the clothes of the hamlet; please check them for the time of the Hùng Kings (`docs/ART.md`).

## 18. Taps, the action button, and the next step (#31)

New texts to check (keys in `i18n/vi.json` and `i18n/en.json`):

- The action button: `ui.action` (its name for a screen reader; the button itself has a picture and no words) and the help of the keys `ui.keys` (E does the hands, as the action button; Space jumps).
- The first step that a person shows at the start of a task: `mentor.first` ("Watch: take one from the heap there, and put it here."), `mentor.first.back` ("Như thế này nhé.", when the person takes the thing back), `mentor.first.you` (after it), and the lines of the tasks with no heap: `mentor.woodcutter.first`, `mentor.ducks.first`, `mentor.drum.first`. These lines are common to many people: check that they fit the teacher, the smith, the healer, and the fisher, who say "cháu" to the child elsewhere.

## The names of the people by the region and the era (#38)

People of a village are called by a word of kinship to the child and the order of birth in the family, never by a nickname from the work. The word for the order follows the way of naming of the region of the map (`data/world/naming.json`, `naming` in `data/world/regions.json`, `src/core/naming.js`).

- **The ways of naming:** north (1 Cả, 2 Hai, 3 Ba, 4 Tư, 5 Năm, 6 Sáu, 7 Bảy, 8 Tám, 9 Chín, 10 Mười, the youngest Út) and south (1 Hai, 2 Ba, 3 Tư, 4 Năm, 5 Sáu, 6 Bảy, 7 Tám, 8 Chín, 9 Mười, the youngest Út). The regions of chapters 1 to 11 use north; Tây Sơn (chapter 12) and Gia Định (chapter 13) use south. Please check Thuận Quảng (chapter 11, the center before the 18th century): it uses north now.
  - **Answer (owner):** Keep north. Chapter 11 is 1460 to 1497. Thuận Hóa became land of Đại Việt in 1306 and Quảng Nam in 1471, and its Việt families came from the north. The first evidence of "Hai" for the first child in the center is from the 18th century (Nguyễn Nhạc was "anh Hai Trầu" before 1771), and nobody knows when the custom began. So the rule "north in all regions before the 18th century" holds for chapter 11. The Cham people of the center in that time need their own way of naming later (`docs/QUESTIONS.md`, question 106).
- **Xóm Ruộng** (north, the time of the Hùng Kings): the planter is Cô Năm (cô, order 5), the duck girl Chị Hến (#41; she was Chị Ba), the fisher uncle Chú Tư (chú, 4), and the old drummer Ông Dương (#41; he was Ông Cả). The head of the hamlet stays Bà trưởng xóm. In a region of the south, the same people are Cô Sáu, Chị Tư, Chú Năm, and Ông Hai.
- **The words of kinship:** `kin.co` (cô), `kin.chu` (chú), `kin.bac` (bác), `kin.ong` (ông), `kin.ba` (bà), `kin.anh` (anh), `kin.chi` (chị), `kin.cau` (cậu), `kin.di` (dì), each with the word after it (`{word}`: an order, the name of a child, or the own name; #41). In English the name is the same, with a capital word of kinship ("Cô Năm").
- **Lines that name them** (the name is the parameter `{who}`, or the four names in the greeting): `hamlet.greet`, `hamlet.point.planting`, `hamlet.point.ducks`, `hamlet.point.traps`, `hamlet.point.drum`, `mentor.picture.planter`, `mentor.picture.duck-girl`, `mentor.picture.fisher-uncle`, `mentor.picture.drummer`. In English each of these lines says the work with the name ("Cô Năm, the planter").

## The names of the people by their age (#41)

In the north, a village names a person by the age: an old person by the name of the first child ("ông Dương"), a grown-up by the order of birth with Cả ("cô Năm"), and a child or a young person by the own small name ("chị Hến"). The south keeps the order from Hai for every age (#38). Please check the names and the glosses.

- **The sources are popular writings, not studies:** Mien Cao 2018 (https://dothogiadinh.vn/cach-xung-ho-ten-cua-nguoi-viet.html, the same text as the Vietnamese Wikipedia page "Gia đình Việt Nam"), Cao Thu Cúc (https://caothucuc.wordpress.com/2014/06/16/cach-xung-ho-cua-nguoi-viet-nam/), Soha (https://soha.vn/vi-sao-nguoi-xua-hay-dat-ten-xau-cho-tre-198260905160854986.htm), and Toan Ánh, *Nếp cũ*, in Znews (https://znews.vn/tuc-kieng-goi-ten-to-tien-cua-nguoi-viet-post1648087.html). Nobody wrote down how villagers spoke in the time of the Hùng Kings. All eras speak today's Vietnamese (#39), so the rule follows the customs written down for the last centuries.
- **Xóm Ruộng** (north): Cô Năm (the planter, grown, order 5), Chị Hến (the duck girl, young, the own name Hến), Chú Tư (the fisher uncle, grown, order 4), Ông Dương (the old drummer, elder, the first child Dương). The greeting of the hamlet: "cô Năm, chị Hến, chú Tư và ông Dương". In a region of the south: Cô Sáu, Chị Tư, Chú Năm, Ông Hai.
- **Two people with the same name** in one place: the south adds the name of the first child after the order ("chị Hai Tùng"); the north uses the name of the first child ("chị Tùng"). No two people of the game have the same name now.
- **The glosses** (English only, one time for each name; `name.gloss.<rule>.<he|she|they>` in `i18n/en.json`):
  - order: "Cô Năm: the fifth child of her family." (the words `ord.1` to `ord.10` and `ord.youngest`);
  - elder: "Ông Dương: an old man is called by the name of his first child, Dương.";
  - child (a person who is not old, named by a child when two have the same name): "Chị Tùng: a woman is called by the name of her first child, Tùng.";
  - own: "Chị Hến: a young person is called by her own small name, Hến.";
  - order and child (south): "Chị Hai Tùng: the first child of her family; her first child is Tùng."
  - The Vietnamese texts of these keys are not shown (Vietnamese has no glosses of names); they are there so that both files have the same keys.
- **Please check:** "Hến" and "Dương" as names for the time of the Hùng Kings; "chị" for a young girl who feeds the ducks (she is older than the child).

## The words of a region and the things of a time (#39)

The people of the center and the south say the words of their region; the people of the north, the narrator, and the math keep the words of the whole country. Please check the words and the marked lines.

- **The words** (`data/world/speech.json`):
  - center: đâu → mô, gì → chi, sao → răng, thế → rứa, kia → tê, này → ni, mẹ → mạ, cô → o.
  - south: mẹ → má, bố → ba, hoa → bông, lợn → heo, quả → trái, tôi → tui, ngô → bắp.
  - north: no change. The issue asks about "u" (mẹ) and "thầy" (bố) in the speech of the old villages of the north: they are not in the table. Do you want them?
    - **Answer (owner):** No, keep the words of the whole country. The owner grew up in the south and cannot check the speech of the old northern villages, and our sources for it are thin. Also, the first words of Gióng in the school books are "Mẹ ra mời sứ giả vào đây", and every Vietnamese child knows them; a line of Gióng with "u" would break that line.
- **The marked lines** (21 words): `dlg.grandma.intro.nghe1` (đâu), `event.market.short` (đâu), `dlg.smith.idle.n1` (gì), `ducks.few` (gì), `dlg.woodcutter.trial.n1`, `dlg.giong.speaks.n9`, `dlg.socson.elder.wait.n1` (two), `gift.thanks.elder`, `mentor.mark`, `hamlet.greet`, `plant.turned`, `plant.choose.no` (này), `mentor.first`, `mentor.show`, `plant.choose.no`, `plant.few`, `traps.many` (kia), `dlg.messenger.call.n4` (tôi), `dlg.giong.speaks.n2` (mẹ, two). Not marked on purpose: "xem sao" and "như thế này" (a word for a word would not be natural: the center says "như ri"), "Xem này" as a call to look, and "cô" (the planter calls herself "cô"; "o" is the sister of a father in the center).
- **The gloss:** "“mô” = “đâu”", one time for each word.
- **The things of a time** (`data/world/origins.json`): maize from 1597 (the earlier year of the two sources). No corn on the houses of Era 1: sheaves of rice or gourds in its place. Chili, sweet potato, cassava, pineapple, papaya, peanut, tobacco, and pumpkin are not in the game, and have no year yet: each needs a year with a source before it comes into the world.
- **The year of each region** (`year` in `data/world/regions.json`): the last year of the time of its chapter; the legend chapters have 258 BC, the end of the Hùng Kings as the old books put it.


## The folk games of the children (#30)

Nhảy lò cò by the road outside the east gate of Phù Đổng, and nhảy dây at the feast of Xóm Ruộng (`docs/FOLKGAMES.md`). Please check the words of the children (keys in `i18n/vi.json` and `i18n/en.json`):

- **The names:** `npc.loco-child.name` (Tí, a boy of Phù Đổng) and `npc.rope-child.name` (Cò, a girl of Xóm Ruộng): small names of village children (tên tục, #41). The children call the hero "bạn" and say "tụi mình".
- **Nhảy lò cò:** `loco.invite`, `loco.join`, `loco.start` ("Hôm nay sân bắt đầu từ {n} nhé."), `loco.call` ("Ô {n}!"), `loco.call.near` ("Ô {base}, rồi thêm {more} ô nữa!"), `loco.in`, `loco.other`, `loco.line`, `loco.out`, `loco.pick`, `loco.fail.shard`, `loco.fail.line`, `loco.fail.skip`, `loco.demo`, `loco.slow`, `loco.good`, `loco.done`, `loco.leave`. The numbers of the squares are the words `num.*`.
- **Nhảy dây:** `rope.invite`, `rope.goal` ("Nhảy đến {n} nhé! Dây chạm đất thì nhảy."), `rope.miss`, `rope.miss.from`, `rope.slow`, `rope.good`, `rope.done`, `rope.leave`.
- **The end of a practice:** `dlg.loco-child.practice.end.n1`, `dlg.rope-child.practice.end.n1`; the links `practiceLink.nhay-lo-co.*` and `practiceLink.nhay-day.*`.
- **The line for the parents** (the weekly note of #25): `folk.real.nhay-lo-co`, `folk.real.nhay-day`.
- **Please check:** "mảnh sành" for the tile of the game (some places say "mảnh ngói" or "hòn cuội"); the half circle to rest at the top of the court; "Ô năm, rồi thêm hai ô nữa!" as the way a child says "two more than five".

## Barter and the goods of the household (#26)

Era 1 trades by barter, with no coins (question 91; `docs/WORLD.md`, "Barter"). New and changed texts, in `i18n/vi.json` and `i18n/en.json`:

- **The basket of the HUD:** `basket.title` ("Giỏ của nhà"), and the names of the goods `item.riceball.name` ("Nắm cơm"), `item.fish.name` ("Cá"), `item.egg.name` ("Trứng"), `item.pot.name` ("Nồi đất"). `item.coin.name` stays for the Đinh, a later era; no text of Era 1 shows it.
- **The market day:** `event.market.start.<goods>.<form>` for the goods `fish`, `egg`, and `pot`, and the forms `same` (one for one), `one` (one good for more measures), and `many` (more goods for more measures), for example "Hôm nay có phiên chợ. Cô đổi trứng lấy gạo: {b} quả trứng lấy {a} đấu gạo. Cô có {k} quả trứng. Cô đổi hết. Cháu mang gạo đặt lên chiếu cho đủ, rồi gọi cô nhé." Also `event.market.short` ("Chưa đủ gạo {w:đâu} cháu."), `event.market.done` ("Đủ rồi! Hàng của cháu đây, cháu bỏ vào giỏ nhé."), and `event.market.poor` ("Giỏ của cháu chưa đủ gạo để đổi. Hôm khác quay lại nhé."). `event.market.start` is the line with no rate.
- **The loot and its rest:** `share.start` ("Quân giặc bỏ lại một đống bao gạo. ..."), `share.rest` ("Còn mấy bao gạo lẻ. ..."), `gift.thanks.elder` ("Gạo {w:này} để đổi lấy tranh lợp mái đình."), `gift.thanks.smith` ("Bác sẽ đổi gạo lấy thêm than cho lò.").
- **Other lines:** `road.cart` ("... Bác cho em một đấu gạo."), `mentor.picture.flood` ("Ra chợ xem người ta đổi hàng một lát, ..."), `q.legend.rice.c3` ("Để đổi lấy cá").
- **Please check:** "đấu" as the measure of rice (a small square box of wood; some places say "bơ" or "lon" for a smaller measure); "Cô đổi hết." for "I trade them all"; the classifiers "con cá", "quả trứng", "cái nồi"; and the rates of the higher levels ("hai quả trứng lấy năm đấu gạo"). A history reviewer checks that rice, fish, eggs, and clay pots are fair goods of a market of the Hùng Kings.

## Trâu Sơn and its clues (#27)

New and changed texts, in `i18n/vi.json` and `i18n/en.json` (`docs/WORLD.md`, "Finding Trâu Sơn"):

- **The note of the battle** (the mark Legend): `raid.boss.note` ("Chuyện xưa kể trận đánh này ở chân núi Trâu. Ngày nay, người ta cho rằng núi Trâu là dải đồi thấp gần làng Châu Cầu, Quế Võ. Không ai biết chắc đó là ngọn đồi nào."). It no longer names the festival: `history.giong.festival` still comes after it.
- **The two clues on the way:** `clue.trau.sunrise` ("Núi Trâu ở phía mặt trời mọc."), `clue.trau.line` ("Không phải một ngọn núi cao đâu. Là những ngọn đồi thấp, nối nhau thành một dải dài.").
- **The old man on Núi Dạm** (`dam-elder`, "bác Sẻ" by the naming of the north): `clue.trau.dam` ("Ngọn này cao mà đứng một mình. Đồi Trâu thì nối nhau từng ngọn, xa hơn về phía mặt trời mọc."), and after the hero finds the hills, `dlg.dam-elder.found.n1` ("Cháu thấy đồi Trâu rồi à. Cháu đi đường cẩn thận nhé.").
- **Please check:** "núi Trâu" and "đồi Trâu" in the lines of the people (the narrator says "núi Trâu"); "bác" for an old man who gathers wood; and that a person of a hamlet on the way would say "phía mặt trời mọc" for east.

## The weekly note of the parents (#25)

New texts, in `i18n/vi.json` and `i18n/en.json` (`docs/LEARNLOG.md`, "The weekly note"). They are for parents: plain, and they must not judge the child.

- **The tab:** `parent.tab.week` ("Tuần này"), `parent.week.title`, `parent.week.about`, and `parent.week.research`.
- **The lines of the note:** `parent.week.*`, for example `parent.week.played` ("Số lần {name} chơi tuần này: {n}, mỗi lần khoảng {minutes} phút."), `parent.week.frustrated` ("{act}: {name} dừng ngay sau khi sai ({n} lần). Sau những lần như vậy, người ở đó cho việc nhỏ hơn."), and `parent.week.together.*` (a thing to play at home with beans or a drum).
- **The tables:** `parent.week.facts.title`, `parent.week.thisWeek`, `parent.week.lastWeek`, `parent.week.acts.title`, `parent.week.act.line`, `parent.week.learned`, `parent.week.sign.*`, and `parent.week.check*`.
- **The names of the activities and of the moves of the people:** `parent.act.*` ("Cây cầu", "Việc nhỏ trong ngày", "Giữ làng") and `parent.move.*` (for example "thử trước rồi mới giúp").
- **Please check:** "đã chắc" for a confident fact; "có lúc chán" and "có lúc nản" for restless and frustrated; "say mê" for keen; and that no line sounds like a grade or a judgment of the child.


## The words of the whole country (#45)

- **The words of numbers:** `num.101` to `num.109` now say "một trăm linh một" … "một trăm linh chín" (they said "lẻ"), as in the school books. A test checks that no `num.*` key has "lẻ" or "ngàn".
- **"Bọn mình", not "tụi mình":** the children of the folk games say "bọn mình" in `loco.invite`, `loco.join`, `loco.other`, `loco.line`, `loco.out`, `loco.slow`, `rope.invite`, and `rope.slow`. The word is marked (`{w:bọn}`), so the children of the south say "tụi mình", with a gloss the first time ("tụi" = "bọn"; `data/world/speech.json`). The lines `loco.*` and `rope.*` are now lines of people in that file.
- The other lines of people have no other word of the south. "ba" (three) and "rau má" (a plant) are words of the whole country.
- **Please check:** "bọn mình" in the mouth of a small child of the north, and the gloss for the south.
- **The other new lines of #45:** the help for the name, `create.name.need` ("Em viết tên mình nhé. Hoặc chọn một tên ở dưới."); the bar of the practice of the hamlet, `practiceLink.xom-ruong.goal` ("Giúp người ở Xóm Ruộng"); "một bạn nhỏ" in place of "một em bé" in `dlg.grandma.intro.n1` and `n2`; and the move "show" of each station, `mentor.show.scholar`, `.smith`, `.fisher`, `.healer`, `.woodcutter`, `.plant`, `.ducks`, `.traps`, `.drum`, and `.bridge` (for example "Nhìn thanh sắt nhé. Đỏ rực thì nhúng vào nước.").
- **Please check:** the names to choose in `data/hero.json` (An, Bình, Nam, Minh; Mai, Lan, Hoa, Linh).

## The help of the touch screen (#53)

- **The menu on a touch screen** shows only the touch help, with a picture of each control: `ui.help.tap` ("Chạm vào một chỗ: em đi đến đó."), `ui.help.star` ("Chạm vào ngôi sao: em đi đến chỗ cần đến."), `ui.help.stick` ("Giữ ngón tay trên vòng tròn ở góc dưới: em đi theo ngón tay."), `ui.help.act` ("Nút lớn: làm việc với thứ có viền đậm. Hình trên nút cho biết nút sẽ làm gì."), `ui.help.jump` ("Nút nhảy: em nhảy qua vũng nước hay khe nhỏ."), and `ui.help.turn` ("Hai nút xoay: xoay góc nhìn.").
- **The keys** (`ui.keys`) show only with a mouse and a keyboard; the line has no touch part now.
- **Please check:** "vòng tròn ở góc dưới" for the stick, and "nút lớn" for the action button.

## What the work shows (#48)

- **The woodcutter at a cut that is not equal:** `woodcutter.short` ("Khúc này ngắn quá nên gãy rồi. Các khúc phải dài bằng nhau.").
- **The fisher at a tide with no new stake:** `fisher.tide.more` ("Cắm thêm cọc trước đã, rồi nước lên sẽ thử hàng cọc.").
- **The own lines of each person (#48):** each person of a task now has own lines for the moves that name the things of the work, in place of the lines about a heap: `mentor.<person>.first`, `.mark`, `.demo`, `.smaller`, and `.share` for the bridge, the teacher (`scholar`), the smith, the fisher, the healer, the woodcutter, the planting (`plant`), and the fish traps (`traps`). For example `mentor.scholar.smaller` ("Thầy đặt giúp con mấy que trước, con đặt nốt nhé.") and `mentor.fisher.mark` ("Cháu nhìn khe này nhé: không khe nào được rộng hơn khe của chú.").
- **Please check:** the voice of each person (thầy and con; bà, chú, cô, and cháu; anh and em), and that no line is a question (the rule of the world).

## The greetings of the people (#49)

- **The words of a greeting by the age of the person** (`greet` in `data/npcs.json`): an old person says one of `world.greet.1` ("Chào {name}!"), `world.greet.2` ("Chào cháu!"), and `world.greet.3` ("Cháu ngoan quá!"); a grown person says `world.greet.1` or `world.greet.2`; a big sister (the duck girl) says `world.greet.1` or `world.greet.young` ("Chào em!"); a child of a folk game says `world.greet.1` or `world.greet.child` ("Chào bạn!"). Gióng and the enemies do not greet.
- A person greets one time when the child comes near, and not again for some minutes; never during the work of the people near the child.
- **Please check:** "Chào em!" from the duck girl, and "Chào bạn!" from a child to a child.

## The words of the raids (#50)

- **A lost raid says who left and when they come back:** `raid.lost` ("Quân giặc lấy một ít đồ rồi đi. Sáng mai chúng quay lại."), `raid.river.lost` ("Hai con thuồng luồng nhỏ bơi đi rồi. Sáng mai chúng quay lại chỗ lội."), and `raid.scouts.lost` ("Bọn lính trinh sát lấy một ít đồ rồi chạy đi. Sáng mai chúng quay lại.").
- **The lines that say what the raid does:** `dlg.scouts.won.n1` (four scouts, not two); `dlg.fisher.river.n1` and `dlg.river.friends.n5` (the serpents are hungry and eat the rice balls; no shell of ice); `dlg.river.friends.n6` ("[[song]] cũng trở thành bạn của em.").
- **No hearts:** `practice.note` ("Ở đây làm sai thì làm lại. Không mất gì cả.") and `dlg.teacher.practice.n1`. The lines of the old battle screen are gone: `friend.*.help` and `calling.*.van` and `calling.*.vo`.
- **Please check:** "Sáng mai chúng quay lại" for a lost raid, and "làm sai thì làm lại" for the practice with the teacher.

## The road of the story (#51)

- **The board at the gate, not the stele:** `exam.stele` ("Tên của em được viết lên bảng ở cổng [[vanmieu]]. Chỉ tên các tiến sĩ mới được khắc lên bia đá trên lưng rùa. Em học tiếp, một ngày nào đó tên em cũng có thể ở đó."), `vanmieu.hello.done` ("Tên em đã ở trên bảng ở cổng."), and `vanmieu.board` ("Bảng ở cổng"). Only the doctors (tiến sĩ) had their names on the steles of Văn Miếu.
- **The rule of the exam says the truth:** `exam.rule` ("Bài thi có {min} đến {max} câu, nhiều loại khác nhau. Em làm đúng thì câu sau khó hơn, em làm sai thì câu sau dễ hơn. Cứ bình tĩnh làm hết sức mình."). The exam mixes the kinds of questions: never more than three of one kind in a row.
- **The cards of the callings say what the child learns with each person:** `calling.<id>.line`, for example `calling.smith.line` ("Học với bác thợ rèn: lửa, nước và sắt.") and `calling.healer.line` ("Học với bà lang: các loại cây thuốc, mỗi loại đủ số."); `calling.note` ("Chọn người thầy em thích nhất. Em vẫn học được tất cả các môn, và em có thể đổi nghề ở nhà bất cứ lúc nào."). A calling gives no bonus in the game now, so no line promises one.
- **The end of chapter one:** `chapter.end.title` ("Hết chương một: Thánh Gióng"), `chapter.end.trials`, `.horse`, `.raids`, `.farewell`, `.exam` ("Em đỗ kỳ thi ở [[vanmieu]] và có danh hiệu {title}."), and `chapter.end.next` ("Em đi theo ngôi sao, hoặc mở bản đồ, để về làng Phù Đổng. Thầy giáo đang chờ em.").
- **The way home:** `quest.home.title` ("Về làng"), `quest.home.teacher` ("Về làng, đến gặp thầy giáo."), and the talk of the teacher `dlg.teacher.home.n1` ("Thầy nghe tin rồi: con đỗ kỳ thi ở [[vanmieu]]! Thầy mừng lắm.") and `dlg.teacher.home.n2`.
- **Gióng speaks in three lines:** `dlg.giong.speaks.n2` ("{w:Mẹ} ơi, {w:mẹ} mời sứ giả vào đây. Con xin nhà vua một con ngựa sắt, một cái roi sắt và một bộ áo giáp sắt. Con sẽ đi đánh giặc, giữ làng.") and `dlg.giong.speaks.n3` ("{name} ơi, bạn giúp các bác thợ rèn làm ngựa sắt nhé. …"). The lines `dlg.giong.speaks.n4` to `.n9` and the two questions after them are gone: the smith says the lines of fire and water at the forge, where the fire and the water are (`dlg.smith.forge.iron`: "Cháu xem này: sắt rất cứng. Nhưng trong lửa thật nóng, sắt mềm ra, và bác uốn được nó."; `dlg.smith.forge.water`).
- **Roi sắt, as in the books of school:** ngựa sắt, roi sắt, áo giáp sắt (`dlg.giong.speaks.n2`, `dlg.smith.horse.n1`, `dlg.giong.grown.n1`, `dlg.staff.breaks.n1` "Rắc! Cái roi sắt gãy làm đôi!", `q.legend.bamboo.prompt`, `q.legend.smiths.explain`); "iron whip" in English.
- **The farewell speaks one way:** `dlg.giong.farewell.care` ("Bạn hãy giữ gìn làng, và chăm sóc [[nghecalf]] nhé."): Gióng says bạn and mình to the child in the whole talk. After the talk, a short scene: Gióng on his iron horse rides up the hill, a cloud comes down over him, and he is gone (by day and at night).
- **The bridge at night:** when the fisher is at home, Nghé says the lines of the bridge, as a friend: the general lines (`mentor.mark` "Nhìn chỗ {w:này} xem nào.") and `mentor.nghe.smaller`, `.share`, `.raise`, `.tryFirst`, `.first.you` (bạn, not cháu). The first time that the plank outlines of the guess lie on the bank, a line says what they are: `mentor.bridge.guess` ("Trước hết, cháu chạm vào một hàng ván mờ trên bờ: đó là số ván cháu đoán cho chỗ gãy.") from the fisher, or `mentor.nghe.bridge.guess` from Nghé.
- **Please check:** "bảng ở cổng" for the list of the names of the titles, the five lines of the callings, the page of the end of the chapter, "cái roi sắt", "Bạn hãy giữ gìn làng", and "hàng ván mờ".
