// Placeholder demo story for the campus map. Replace freely.
// 林夏: 台词 #emotion #vo #line:id     — dialogue (speaker from cast.yaml)
// @command args key=value             — staging / mechanics, awaited by the game
// Cats only ever meow out loud; the text box shows what they mean.

VAR met_ayin = false
VAR read_notice = false
VAR has_snack = false
VAR ayin_trust = 0
VAR guard_asked = false

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
窗户里飘出一句话——“同学，看见一只银灰色的猫没有？胖胖的，凶得很。” #line:guard_2
林夏: 没……没有。 #calm #line:guard_3
-> END
= radio
评书刚好说到“且听下回分解”。 #line:guard_4
-> END

=== dorm_door ===
{ met_ayin: -> after_cat }
宿舍楼门禁亮着红灯。门上贴着纸条：“宿管外出，十五分钟后回。” #line:dorm_1
林夏: 那就先在学校里转转吧。 #calm #line:dorm_2
-> END
= after_cat
林夏: 宿管还没回来……那只猫说的“翻书”，到底是什么意思？ #calm #line:dorm_3
-> END

=== notice_board ===
@sfx page_turn
公告栏上贴满了社团招新。角落里有一张手写的寻猫启事。 #line:notice_1
“寻猫——阿银，美国短毛，银色虎斑。脾气大，会自己开门。见到请勿投喂。——图书馆 老周” #line:notice_2
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

=== ayin_talk ===
{ met_ayin: -> again }
@emote ayin ?
阿银: 喵。 #calm #line:ayin_1
{ read_notice:
    林夏: 银色虎斑……你就是寻猫启事上的阿银？ #shock #line:ayin_2
- else:
    林夏: 好胖的猫。 #smile #line:ayin_3
}
阿银: 喵——呜。 #annoyed #line:ayin_4
* [蹲下来，伸出手]
    ~ ayin_trust += 1
    阿银: 喵。 #calm #line:ayin_5
* {has_snack} [拿出小鱼干]
    ~ ayin_trust += 2
    @take fish_snack
    @emote ayin ♥
    阿银: 喵！ #smug #line:ayin_6
* [还是别惹它了]
    阿银: …… #annoyed #line:ayin_7
- ~ met_ayin = true
{ ayin_trust >= 1: -> speaks }
-> END
= speaks
@face ayin linxia
阿银: 你看起来，不像会给我惹麻烦的人。 #smug #line:ayin_8
@emote linxia !
林夏: ……？！ #shock #line:ayin_9
阿银: 图书馆今天不开门。里面有东西在翻书。 #calm #line:ayin_10
阿银: 喵。 #calm #line:ayin_11
@walk ayin to=lib_steps
@face ayin down
林夏: 刚才……是猫在说话吗？ #shock #vo #line:ayin_12
-> END
= again
阿银: 喵。 #smug #line:ayin_13
-> END

=== library_door ===
玻璃门上贴着告示——“内部整理，暂停开放。” #line:lib_1
{ met_ayin && ayin_trust >= 1: -> hint }
-> END
= hint
门缝里，好像有一页纸自己翻了过去。 #line:lib_2
@sfx page_turn
@emote linxia …
-> END
