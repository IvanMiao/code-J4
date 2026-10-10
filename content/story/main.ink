// PLACEHOLDER STORY — only exercises the systems. Characters, names and lines are Yifan's to replace.
//
// Conventions (see README "Writing the story"):
//   林夏: 台词 #smile            dialogue line; first plain tag = emotion (portrait + voice tag)
//   ... #vo #line:intro_1        #vo = gets real voice-over; #line:<id> = stable id (npm run story:ids adds them)
//   @walk linxia to=door         stage/mechanic command; the story waits until it finishes
//   ?start=<knot> in the URL     jump straight to a knot while writing
//
// Knots named in content/maps/*.tmj (actors[].knot, triggers[].knot) run when the player interacts.
// `intro` runs once on a new game.

VAR met_juzi = false
VAR has_bought = false
VAR juzi_trust = 0
VAR battle_result = ""

=== intro ===
@fade out time=0
@ambience street_night
@bgm night_street fade=2
@fade in time=1.5
林夏: 又是十一点。 #calm #vo #line:intro_1
林夏: 至少便利店还亮着。 #smile #line:intro_2
@emote juzi …
-> END

=== store_door ===
{ has_bought:
    林夏: 已经买过了。回家吧……可是那只猫还在看我。 #calm #line:store_door_1
    -> END
}
@walk linxia to=door
@face linxia up
@sfx door_chime
林夏: 一份关东煮，谢谢。 #calm #line:store_door_2
@wait 0.6
@give oden
~ has_bought = true
林夏: 热乎的。 #smile #line:store_door_3
@emote juzi !
-> END

=== vending_machine ===
林夏: 自动售货机。最近连这个都涨价了。 #calm #line:vending_1
* [买一罐咖啡]
    @sfx can_drop
    @give coffee
    林夏: 再撑一会儿。 #calm #line:vending_2
* [算了]
    林夏: 还是省点吧。 #calm #line:vending_3
- -> END

=== juzi_talk ===
{ met_juzi: -> juzi_again }
@face linxia juzi
@face juzi linxia
橘子: 喵。 #calm #line:juzi_1
林夏: 你好呀，小胖子。 #smile #line:juzi_2
橘子: ……谁是小胖子？ #annoyed #vo #line:juzi_3
@shake time=0.3
@emote linxia !
林夏: 刚、刚才是你在说话？ #shock #vo #line:juzi_4
橘子: 别这样看着我，人类。 #smug #vo #line:juzi_5
~ met_juzi = true
* [蹲下来，伸出手]
    ~ juzi_trust += 1
    橘子: 哼。手很暖，算你及格。 #smug #line:juzi_6
* {has_bought} [把关东煮的萝卜分给它]
    ~ juzi_trust += 2
    @take oden
    橘子: ……汤底要多一点。下次记住。 #smug #vo #line:juzi_7
* [一定是加班加出幻觉了]
    林夏: （明天一定要请假。） #calm #line:juzi_8
    橘子: 喵——随你怎么想。 #annoyed #line:juzi_9
- 橘子: 不过，今晚巷子里有东西。你最好别一个人回家。 #calm #vo #line:juzi_10
@walk juzi to=street
@face juzi down
@emote juzi 💢
@battle ch1_alley_rats
{ battle_result == "lose":
    林夏: 呜……眼前一黑。 #shock #line:juzi_11
    @fade out time=1
    @wait 0.5
    @fade in time=1
    橘子: 下次跑快点。 #annoyed #line:juzi_12
- else:
    橘子: 还行。比我想的有用一点。 #smug #vo #line:juzi_13
}
-> END

=== juzi_again ===
橘子: 还不回家？ #calm #line:juzi_again_1
-> END
