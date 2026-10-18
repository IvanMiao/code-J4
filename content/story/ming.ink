// Ancient line — placeholder vertical slice (?map=ming_canal_street). Replace freely.
// 〔错｜对〕 writes 错, strikes it out, then writes 对 (bubble dialogue); 〔错｜〕 strikes with no replacement.

VAR seen_sheets = false
VAR clue_xian = false
VAR heard_maiwang = false
VAR met_andreas = false
VAR andreas_saw_light = false
VAR seen_notes = false
VAR debate_done = false
VAR debate_score = 0
VAR kuang_hint = false
VAR found_maiwang = false

=== ming_intro ===
@fade out time=0
@fade in time=1.2
〔万历｜〕某年，秋。江南一座不大的水乡，书坊比米铺还多。
沈砚: 县里差我来问文林阁的案子：新印的书，一夜之间被什么东西啃掉了字。 #calm
沈砚: 先看看书坊，再去经藏院。 #calm
-> END

=== ming_bookshop ===
文林阁的掌柜不在，柜上压着一张字条：“去经藏院对版了。”
{ seen_sheets: 沈砚: 掌柜一早就把版子送去了寺里。版子在路上，字却在这里丢了。 #calm }
-> END

=== ming_drying_sheets ===
@sfx page_turn
架子上晾着新刷的《列仙传》。每一页上，凡是“仙”字，都被啃成了一个整齐的小洞。
~ seen_sheets = true
沈砚: 只吃“仙”字。老鼠可没这么挑食。 #calm
* [记下：只缺“仙”字]
    ~ clue_xian = true
    沈砚: 别的字一个不少。 #calm
* [再看看别处]
- -> END

=== ming_teahouse ===
茶馆里有人在说书：“……那脉望食神仙字三次，人得之，夜持向天，可召星使……”
~ heard_maiwang = true
沈砚: 《酉阳杂俎》里的故事。说书的倒是消息灵通。 #calm
-> END

=== ming_bridge ===
桥下泊着一只乌篷船，船头晒着一摞刻版。
沈砚: 版子从书坊运到寺里对校，走的是水路。 #calm
-> END

=== ming_andreas ===
{ met_andreas: -> again }
~ met_andreas = true
安德肋: 先生，您是官府的人？昨夜，我在〔书们｜书架〕上，看见一点光。 #calm
沈砚: 光？在哪里？ #calm
安德肋: 经藏院。我在那里学〔刻字｜刻版〕。那光很小，绿色，像一个字在走路。 #calm
~ andreas_saw_light = true
* [问他从哪里来]
    安德肋: 很远，比天竺还远。我们那里用铅铸的字印书，一个一个排起来。 #calm
    沈砚: 那你们的字，也会被虫吃么？ #calm
    安德肋: 会被火吃。也会被人吃。 #calm
* [不必多问]
- -> END
= again
安德肋: 绿色的光。我画下来了，可是画得不好。 #calm
-> END

=== ming_monk_left ===
老僧一笔一画地抄着《金刚经》，没有抬头。
“施主，经里没有仙字，虫子不来这边。”
-> END

=== ming_monk_right ===
年轻的僧人在对版，把刻错的字用朱笔圈出来。
“掌柜送来的版子，昨天就该对完了。可秃翁先生在旁边批了一夜。”
-> END

=== ming_reading_table ===
@sfx page_turn
案上摊着一部刻本，页边写满了狂草批注。墙上的飞天褪了色，衣带还在飘。
~ seen_notes = true
批注写着：“此处全是假话。”
-> END

=== ming_kuang ===
{ debate_done: -> after }
秃翁: 县里来的？来抓我，还是来抓虫？ #amused
沈砚: 文林阁的《列仙传》，“仙”字一夜之间全没了。有人说，是您批书批出了妖。 #calm
秃翁: 好。那就辩一辩。辩输了，你把我带走；辩赢了，我替你找那只虫。 #amused
@sfx page_turn
秃翁: 头一问：书上的“仙”字没了，书就坏了么？ #stern
* [字没了，书便不全，当然是坏了。]
    秃翁: 不全就是坏？那天下哪一部书是全的？ #amused
* {seen_notes} [您在页边批“此处全是假话”。书在您眼里，本来就是坏的。]
    ~ debate_score += 1
    秃翁: 哈！看过我的批了。 #amused
* [我只管查案，不管书好坏。]
    秃翁: 不管书，你查什么书案。 #stern
- 秃翁: 二问：虫吃“仙”字，是虫有罪，还是字有罪？ #stern
* {clue_xian} [它只吃“仙”字。挑食的不是虫，是教它挑食的人。]
    ~ debate_score += 1
    秃翁: 有人教它……你这个小吏，倒不笨。 #amused
* [虫是畜生，畜生无罪。]
    秃翁: 那便是字有罪了？说得我都想吃了。 #amused
* [自然是写批注的人有罪。]
    秃翁: 又绕回我身上来了。 #stern
- 秃翁: 三问：若真有脉望，你抓它，是为了县里，还是为了你自己？ #stern
* {heard_maiwang} [脉望能召星使。想要它的，是想见神仙的人。]
    ~ debate_score += 1
    秃翁: 好。想见神仙的人，这镇上可不少。 #amused
* [为了县里。]
    秃翁: 县里可从来不想见神仙。 #amused
* [为了查明真相。]
    沈砚: 为了〔升迁｜〕……查明真相。 #calm
    秃翁: 你那半句话，我听见了。 #amused
- ~ debate_done = true
{ debate_score >= 2:
    秃翁: 罢了，算你赢。虫不是我养的，可我知道它昨夜去了哪里。 #calm
- else:
    秃翁: 你没说服我，我也没说服你。辩难本来就不分输赢。 #amused
}
秃翁: 问问那只猫。它一直趴在经箱上，比我们都先到。 #calm
~ kuang_hint = true
-> END
= after
秃翁: 去看经箱，别看我。 #amused
-> END

=== ming_linu ===
狸奴: 喵。 #calm
{ kuang_hint:
    狸奴: 箱子里有东西在啃纸。我守了一夜了。 #smug
- else:
    狸奴: 别吵，我在守夜。 #annoyed
}
-> END

=== ming_sutra_chest ===
{ not kuang_hint:
    一口朱漆经箱，铜锁扣着。猫趴在上面，没有要走的意思。
    -> END
}
{ found_maiwang: -> again }
@sfx page_turn
箱子里是一卷敦煌来的旧写经。纸缝里，一条细细的银色小虫在发光。
~ found_maiwang = true
@emote shen !
沈砚: 脉望…… #shock
（试玩到此为止。斗法、结案和后面的故事，留给正式剧本。）
-> END
= again
那条小虫缩回了纸缝里，光一明一灭。
-> END
