// Placeholder demo story for the campus map. Replace freely.
// 林夏: 台词 #emotion #vo #line:id     — dialogue (speaker from cast.yaml)
// @command args key=value             — staging / mechanics, awaited by the game
// Cats only ever meow out loud; the text box shows what they mean.

VAR met_nika = false
VAR read_notice = false
VAR has_snack = false
VAR nika_trust = 0
VAR guard_asked = false
VAR found_coin = false
VAR made_wish = false
VAR rang_bell = false
VAR paw_stickers = 0
VAR paw_gate = false
VAR paw_avenue = false
VAR paw_library = false
VAR nika_paw_told = false

=== intro ===
@fade out time=0
@bgm campus_afternoon fade=2
@ambience campus_day
@fade in time=1.2
林夏: 江城大学……总算到了。 #calm #vo #line:intro_1
林夏: 报到处说宿舍在梧桐苑，从这里往右走就是。 #calm #line:intro_2
-> END

=== gate_sign ===
校门上的“江城大学”四个金字，被太阳晒得发烫。 #line:gate_sign_1
-> END

=== guard_booth ===
门卫室的窗户半开着，收音机在放评书。 #line:guard_1
{ guard_asked: -> radio }
~ guard_asked = true
窗户里飘出一句话——“同学，看见一只银色花纹、白爪子的猫没有？胖胖的，凶得很。” #line:guard_2
林夏: 没……没有。 #calm #line:guard_3
-> END
= radio
评书刚好说到“且听下回分解”。 #line:guard_4
-> END

=== dorm_door ===
{ met_nika: -> after_cat }
宿舍楼门禁亮着红灯。门上贴着纸条：“宿管外出，十五分钟后回。” #line:dorm_1
林夏: 那就先在学校里转转吧。 #calm #line:dorm_2
-> END
= after_cat
林夏: 宿管还没回来……那只猫说的“翻书”，到底是什么意思？ #calm #line:dorm_3
-> END

=== notice_board ===
@sfx page_turn
公告栏上贴满了社团招新。角落里有一张手写的寻猫启事。 #line:notice_1
“寻猫——尼卡，美国短毛，银虎斑加白，四只白爪子。脾气大，会自己开门。见到请勿投喂。——图书馆 老周” #line:notice_2
~ read_notice = true
林夏: 会自己开门的猫？ #shock #line:notice_3
-> END

=== kiosk ===
@sfx door_chime
{ has_snack: -> sleepy }
收银台旁边摆着一排小鱼干，五块钱一包。 #line:kiosk_1
* [买一包]
    ~ has_snack = true
    @give fish_snack
    林夏: ……也不知道为什么，就是想买。 #smile #line:kiosk_2
* [算了]
    林夏: 我又不养猫。 #calm #line:kiosk_3
- -> END
= sleepy
店员趴在收银台上打瞌睡。 #line:kiosk_4
-> END

=== nika_talk ===
{ met_nika: -> again }
@emote nika ?
尼卡: 喵。 #calm #line:nika_1
{ read_notice:
    林夏: 白爪子……你就是寻猫启事上的尼卡？ #shock #line:nika_2
- else:
    林夏: 好胖的猫。 #smile #line:nika_3
}
尼卡: 喵——呜。 #annoyed #line:nika_4
* [蹲下来，伸出手]
    ~ nika_trust += 1
    尼卡: 喵。 #calm #line:nika_5
* {has_snack} [拿出小鱼干]
    ~ nika_trust += 2
    @take fish_snack
    @emote nika ♥
    尼卡: 喵！ #smug #line:nika_6
* [还是别惹它了]
    尼卡: …… #annoyed #line:nika_7
- ~ met_nika = true
{ nika_trust >= 1: -> speaks }
-> END
= speaks
@face nika linxia
尼卡: 你看起来，不像会给我惹麻烦的人。 #smug #line:nika_8
@emote linxia !
林夏: ……？！ #shock #line:nika_9
尼卡: 图书馆今天不开门。里面有东西在翻书。 #calm #line:nika_10
尼卡: 喵。 #calm #line:nika_11
@walk nika to=lib_steps
@face nika down
林夏: 刚才……是猫在说话吗？ #shock #vo #line:nika_12
-> END
= again
{ paw_stickers >= 3 && nika_trust >= 1 && not nika_paw_told: -> paw_secret }
尼卡: 喵。 #smug #line:nika_13
-> END
= paw_secret
~ nika_paw_told = true
@emote nika ?
尼卡: 喵？ #calm #line:nika_paw_1
尼卡: ……那些贴纸是我贴的。认路用的。 #smug #line:nika_paw_2
尼卡: 别告诉门卫老周。 #annoyed #line:nika_paw_3
林夏: 猫……会用贴纸？ #shock #line:nika_paw_4
@give fish_snack
尼卡: 喵。 #smug #line:nika_paw_5
-> END

=== library_door ===
玻璃门上贴着告示——“内部整理，暂停开放。” #line:lib_1
{ met_nika && nika_trust >= 1: -> hint }
-> END
= hint
门缝里，好像有一页纸自己翻了过去。 #line:lib_2
@sfx page_turn
@emote linxia …
-> END


// ---------- Hidden spots: no hint bubble, a faint twinkle marks the unfound ones ----------

=== gate_bench_coin ===
{ found_coin: -> nothing }
~ found_coin = true
@sfx coin_pick
长椅底下的砖缝里，卡着一枚一元硬币。 #line:coin_1
@give coin
林夏: 今天运气不错。 #smile #line:coin_2
-> END
= nothing
长椅底下只有几片落叶。 #line:coin_3
-> END

=== gate_tree_paw ===
{ paw_gate: -> seen }
~ paw_gate = true
~ paw_stickers += 1
@sfx blip
树干背面贴着一张小小的银灰色猫爪贴纸。 #line:paw_g1
@give paw_sticker
-> paw_count
= seen
树干上的猫爪贴纸被晒得有点褪色。 #line:paw_g2
-> END

=== avenue_kiosk_paw ===
{ paw_avenue: -> seen }
~ paw_avenue = true
~ paw_stickers += 1
@sfx blip
超市侧墙的墙角，贴着一张银灰色的猫爪贴纸。 #line:paw_a1
@give paw_sticker
-> paw_count
= seen
墙角的猫爪贴纸还在。 #line:paw_a2
-> END

=== library_planter_paw ===
{ paw_library: -> seen }
~ paw_library = true
~ paw_stickers += 1
@sfx blip
花坛边沿的瓷砖上，印着一张银灰色的猫爪贴纸。 #line:paw_l1
@give paw_sticker
-> paw_count
= seen
花坛边的猫爪贴纸被浇花的水打湿了一角。 #line:paw_l2
-> END

=== paw_count ===
{ paw_stickers >= 3: -> all }
林夏: 猫爪贴纸……这已经是第 {paw_stickers} 张了。 #calm #line:paw_n
-> END
= all
林夏: 三张了。爪印的方向，好像都指着图书馆。 #shock #line:paw_all
@emote linxia !
-> END

=== bike_bell ===
@sfx bike_bell
@scare
{ rang_bell: -> again }
~ rang_bell = true
林夏按了一下最边上那辆自行车的车铃。 #line:bell_1
附近的麻雀扑棱棱全飞了起来。 #line:bell_2
林夏: ……对不起。 #calm #line:bell_3
-> END
= again
叮铃——。 #line:bell_4
-> END

=== avenue_bench ===
林夏在长椅上坐了一会儿，梧桐叶的影子在地上晃来晃去。 #line:bench_1
@wait 1
林夏: 好，继续走吧。 #smile #line:bench_2
-> END

=== fountain ===
喷泉哗哗地响，池底沉着不少硬币。 #line:fountain_1
{ found_coin && not made_wish: -> wish }
-> END
= wish
* [投一枚硬币许愿]
    ~ made_wish = true
    @take coin
    @sfx coin_splash
    ** [希望能和那只猫成为朋友]
        ~ nika_trust += 1
        林夏: ……拜托了。 #smile #line:fountain_2
    ** [希望这学期一切顺利]
        林夏: 就当是给自己打打气。 #smile #line:fountain_3
    -- -> END
* [还是留着吧]
    -> END

