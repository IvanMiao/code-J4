// script: hant
// Ancient line — placeholder vertical slice (?map=ming_canal_street). Replace freely.
// 〔錯｜對〕 writes 錯, strikes it out, then writes 對 (bubble dialogue); 〔錯｜〕 strikes with no replacement.

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
〔萬曆｜〕某年，秋。江南一座不大的水鄉，書坊比米鋪還多。
沈硯: 縣裏差我來問文林閣的案子：新印的書，一夜之間被什麼東西啃掉了字。 #calm
沈硯: 先看看書坊，再去經藏院。 #calm
-> END

=== ming_scriptorium_intro ===
@fade out time=0
@fade in time=1.2
經藏院的寫經房裏很靜，只聽得見筆尖擦紙的聲音。
-> END

=== ming_bookshop ===
文林閣的掌櫃不在，櫃上壓著一張字條：“去經藏院對版了。”
{ seen_sheets: 沈硯: 掌櫃一早就把版子送去了寺裏。版子在路上，字卻在這裏丟了。 #calm }
-> END

=== ming_drying_sheets ===
@sfx page_turn
架子上晾著新刷的《列仙傳》。每一頁上，凡是“仙”字，都被啃成了一個整齊的小洞。
~ seen_sheets = true
沈硯: 只喫“仙”字。老鼠可沒這麼挑食。 #calm
* [記下：只缺“仙”字]
    ~ clue_xian = true
    沈硯: 別的字一個不少。 #calm
* [再看看別處]
- -> END

=== ming_teahouse ===
茶館裏有人在說書——“……那脈望食神仙字三次，人得之，夜持向天，可召星使……”
~ heard_maiwang = true
沈硯: 《酉陽雜俎》裏的故事。說書的倒是消息靈通。 #calm
-> END

=== ming_bridge ===
橋下泊著一隻烏篷船，船頭曬著一疊刻版。
沈硯: 版子從書坊運到寺裏對校，走的是水路。 #calm
-> END

=== ming_andreas ===
{ met_andreas: -> again }
~ met_andreas = true
安德肋: 先生，您是官府的人？昨夜，我在〔書們｜書架〕上，看見一點光。 #calm
沈硯: 光？在哪裏？ #calm
安德肋: 經藏院。我在那裏學〔刻字｜刻版〕。那光很小，綠色，像一個字在走路。 #calm
~ andreas_saw_light = true
* [問他從哪裏來]
    安德肋: 很遠，比天竺還遠。我們那裏用鉛鑄的字印書，一個一個排起來。 #calm
    沈硯: 那你們的字，也會被蟲喫麼？ #calm
    安德肋: 會被火喫。也會被人喫。 #calm
* [不必多問]
- -> END
= again
安德肋: 綠色的光。我畫下來了，可是畫得不好。 #calm
-> END

=== ming_monk_left ===
老僧一筆一畫地抄著《金剛經》，沒有抬頭。
“施主，經裏沒有仙字，蟲子不來這邊。”
-> END

=== ming_monk_right ===
年輕的僧人在對版，把刻錯的字用硃筆圈出來。
“掌櫃送來的版子，昨天就該對完了。可禿翁先生在旁邊批了一夜。”
-> END

=== ming_reading_table ===
@sfx page_turn
案上攤著一部刻本，頁邊寫滿了狂草批註。牆上的飛天褪了色，衣帶還在飄。
~ seen_notes = true
頁邊的批註寫著“此處全是假話”。
-> END

=== ming_kuang ===
{ debate_done: -> after }
禿翁: 縣裏來的？來抓我，還是來抓蟲？ #amused
沈硯: 文林閣的《列仙傳》，“仙”字一夜之間全沒了。有人說，是您批書批出了妖。 #calm
禿翁: 好。那就辯一辯。辯輸了，你把我帶走；辯贏了，我替你找那隻蟲。 #amused
@sfx page_turn
禿翁: 頭一問：書上的“仙”字沒了，書就壞了麼？ #stern
* [字沒了，書便不全，當然是壞了。]
    禿翁: 不全就是壞？那天下哪一部書是全的？ #amused
* {seen_notes} [您在頁邊批“此處全是假話”。書在您眼裏，本來就是壞的。]
    ~ debate_score += 1
    禿翁: 哈！看過我的批了。 #amused
* [我只管查案，不管書好壞。]
    禿翁: 不管書，你查什麼書案。 #stern
- 禿翁: 二問：蟲喫“仙”字，是蟲有罪，還是字有罪？ #stern
* {clue_xian} [它只喫“仙”字。挑食的不是蟲，是教它挑食的人。]
    ~ debate_score += 1
    禿翁: 有人教它……你這個小吏，倒不笨。 #amused
* [蟲是畜生，畜生無罪。]
    禿翁: 那便是字有罪了？說得我都想喫了。 #amused
* [自然是寫批註的人有罪。]
    禿翁: 又繞回我身上來了。 #stern
- 禿翁: 三問：若真有脈望，你抓它，是為了縣裏，還是為了你自己？ #stern
* {heard_maiwang} [脈望能召星使。想要它的，是想見神仙的人。]
    ~ debate_score += 1
    禿翁: 好。想見神仙的人，這鎮上可不少。 #amused
* [為了縣裏。]
    禿翁: 縣裏可從來不想見神仙。 #amused
* [為了查明真相。]
    沈硯: 為了〔升遷｜〕……查明真相。 #calm
    禿翁: 你那半句話，我聽見了。 #amused
- ~ debate_done = true
{ debate_score >= 2:
    禿翁: 罷了，算你贏。蟲不是我養的，可我知道它昨夜去了哪裏。 #calm
- else:
    禿翁: 你沒說服我，我也沒說服你。辯難本來就不分輸贏。 #amused
}
禿翁: 問問那隻貓。它一直趴在經箱上，比我們都先到。 #calm
~ kuang_hint = true
-> END
= after
禿翁: 去看經箱，別看我。 #amused
-> END

=== ming_linu ===
狸奴: 喵。 #calm
{ kuang_hint:
    狸奴: 箱子裏有東西在啃紙。我守了一夜了。 #smug
- else:
    狸奴: 別吵，我在守夜。 #annoyed
}
-> END

=== ming_sutra_chest ===
{ not kuang_hint:
    一口朱漆經箱，銅鎖扣著。貓趴在上面，沒有要走的意思。
    -> END
}
{ found_maiwang: -> again }
@sfx page_turn
箱子裏是一卷敦煌來的舊寫經。紙縫裏，一條細細的銀色小蟲在發光。
~ found_maiwang = true
@emote shen !
沈硯: 脈望…… #shock
（試玩到此為止。鬥法、結案和後面的故事，留給正式劇本。）
-> END
= again
那條小蟲縮回了紙縫裏，光一明一滅。
-> END
