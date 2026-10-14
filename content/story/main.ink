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


// ---------- 校史馆与旧锅炉房院落 (archive) ----------

=== archive_north_alley ===
石板路往北通向后山旧书库，铁栅栏门暂时落着锁。 #line:arch_alley_1
林夏: 牌子上写着“后山库房重地”。得先问问管钥匙的老师傅。 #calm #line:arch_alley_2
-> END

=== archive_door ===
校史馆的双开木门紧闭着，门缝里透出一股旧报纸和樟脑丸的味道。 #line:arch_door_1
{ met_nika:
    林夏: 尼卡说失联的小陆喜欢钻进旧书页夹缝里，八成就在这栋楼里。 #calm #line:arch_door_2
- else:
    林夏: 门锁着，得找这片院子的管理员问问。 #calm #line:arch_door_3
}
-> END

=== stone_stela ===
驮碑的石龟昂着头，碑文最底下刻着一行小字：“一九五四年测绘立”。 #line:stela_1
林夏: 连龟壳背面的阴影都没画全……果然只有朝南的正脸是实心的。 #calm #line:stela_2
-> END

=== koi_pond ===
方形荷花池里飘着几片睡莲叶，水底的锦鲤游得很慢。 #line:pond_1
林夏: 水面的波纹一圈一圈的，像是有人在底下按着节拍器。 #smile #line:pond_2
-> END

=== vending_machine ===
两台蓝白相间的旧售货机嗡嗡作响，里面摆着橘子汽水和冰红茶。 #line:vend_1
林夏: 投币口被塞了一张纸条：“吞币找右边锅炉房老焦”。 #calm #line:vend_2
-> END

=== boiler_door ===
旧锅炉房的铁门半掩着，门后传出烧废底片的焦糊味。 #line:boiler_1
里面有个沙哑的声音喊道：“找老焦？等我把这炉旧胶卷烧完！” #line:boiler_2
林夏: 烧胶卷的烟尘飘在院子里，连空气里的像素网格都变模糊了。 #calm #line:boiler_3
-> END

=== courtyard_bench ===
梧桐树影落在木长椅上，坐上去刚好能躲开正午刺眼的阳光。 #line:cbench_1
林夏: 站在树冠背面，整个人就像从画面里隐形了一样。 #calm #line:cbench_2
-> END


// ---------- 老城区 · 九号高架桥底 (city_overpass) ----------

=== bus_stop_302 ===
302路公交站牌锈迹斑斑，路线图从“江城大学”一路通往“第三印染厂”。 #line:bus_1
林夏: 往西回学校，往东去市郊印染厂。两块钱坐到底。 #calm #line:bus_2
-> END

=== repair_shop ===
修车铺里亮着暖黄的钨丝灯，老季正蹲在地上给外卖电瓶车拆限速器。 #line:repair_1
屋里飘出一句话——“修车还是抽帧？抽掉走路中间帧，送单快一倍，概不退换。” #line:repair_2
林夏: 连人的动作帧都能拆下来卖……这老城区比学校里野多了。 #shock #line:repair_3
-> END

=== payphone_box ===
公用电话亭旁边的配电箱贴满了寻人小广告，里面有张小陆的照片。 #line:phone_1
林夏: 照片上的小陆薄得像张书签，连侧脸轮廓都快退色了。 #calm #line:phone_2
-> END

=== noodle_stall ===
砂锅牛肉面的红灯笼在桥底晃荡，骨汤的香气混着煤气灶的火苗往上窜。 #line:noodle_1
摊主头也不抬地喊道——“小碗十二，加卤蛋十四，自己找塑料凳坐。” #line:noodle_2
林夏: 等结了小陆这单寻人委托的尾款，高低得来一碗加肉的。 #smile #line:noodle_3
-> END

=== overpass_alley ===
桥墩后面的暗巷通向背街的筒子楼，墙根底下堆着还没刷新的灰砖。 #line:oalley_1
林夏: 再往里走就是背街片区了，路灯还没亮，先在桥底下问完话吧。 #calm #line:oalley_2
-> END

=== ebike_row ===
一排黄蓝相间的外卖电瓶车整整齐齐停在人行道边，车把上挂着头盔。 #line:ebike_1
林夏: 奇怪，从左边看车牌在左，往右走两步车牌又镜像翻到了右边。 #calm #line:ebike_2
-> END

=== night_tables ===
两张塑料折叠桌拼在一起，上面摆着辣椒油罐、醋瓶和一次性筷子筒。 #line:tables_1
林夏: 桌面油光锃亮的，倒是比高架桥上的水泥柱子更有烟火气。 #smile #line:tables_2
-> END


// ---------- 市郊 · 第三印染厂与绿幕断层 (suburb_dyeworks) ----------

=== pipe_valve ===
碗口粗的生锈铁管从杂草里钻出来，铸铁阀门上还沾着干涸的蓝颜料。 #line:valve_1
林夏: 管网编号是97-04，顺着这条主管道应该能查到当年排污图的底稿。 #calm #line:valve_2
-> END

=== factory_gate ===
第三印染厂的铁门紧锁着，红砖墙上的厂牌已经褪成了暗褐色。 #line:fgate_1
林夏: 门缝里堆满了废弃的色卡，整座城市用剩下的颜色大概都流进这儿了。 #calm #line:fgate_2
-> END

=== dye_lagoon ===
石头围起来的排污池里，青、品红、亮黄三股颜料像油彩一样缓缓打转。 #line:lagoon_1
林夏: 全城被128色配额筛掉的杂色，全沉在这口池子里发亮。 #shock #line:lagoon_2
-> END

=== chroma_edge ===
世界在右侧边缘突然像白纸一样被撕开，露出底下刺眼的纯绿底色。 #line:chroma_1
林夏: 纯绿幕（00FF00）……再往右一步连地面贴图都没有了，千万别踩空。 #shock #line:chroma_2
-> END

=== wireframe_pavilion ===
草坪上立着一座只有白色二维线条的烂尾房子，连墙砖贴图都没刷上去。 #line:wire_1
林夏: 这就是大顾师兄住的“线稿房”？虽然四面漏风，采光倒是字面意义上的满分。 #smile #line:wire_2
-> END


// ---------- 老城区 · 背街筒子楼 (city_tenement) ----------

=== newsstand_stall ===
旧书报亭的木架上摆满了九十年代的画报和一本厚厚的《1997年江城水文年鉴》。 #line:news_1
林夏: 第312页夹着一张纸条，像是有人躺在这页“七月降水量柱状图”底下睡过午觉。 #shock #line:news_2
-> END

=== tenement_alley ===
两栋筒子楼之间的青石板窄巷往北延伸，抬头能看见晾衣竹竿和交错的电线。 #line:talley_1
林夏: 从侧面看，右边这栋楼的墙体薄得像张硬纸板，全靠朝南的正脸撑着。 #calm #line:talley_2
-> END

=== grocery_shop ===
便民杂货铺里亮着暖黄的灯，玻璃柜台里摆着老式手电筒、火柴和散装饼干。 #line:grocery_1
林夏: 跟学校超市的小姜一样，老板也在用废旧包装纸给街坊留拓印备份。 #calm #line:grocery_2
-> END

=== chess_table ===
树荫下的石桌上刻着楚河汉界，几枚掉了漆的木头象棋子还留在残局上。 #line:chess_1
林夏: 红方只剩一个帅，黑方连卒子都贴着底线走。 #smile #line:chess_2
-> END


// ---------- 老城区 · 江滩轮渡码头 (city_ferry) ----------

=== ferry_ticket_booth ===
防洪堤旁的售票窗口贴着时刻表——“江城轮渡：老城区至市郊印染厂，整点发船”。 #line:fticket_1
林夏: 窗口里没人，倒是用粉笔写了一行字：“船工老沈在船头抽烟，顺大路往东也能走过去”。 #calm #line:fticket_2
-> END

=== ferry_gangplank ===
木跳板通向那艘锈迹斑斑的铁壳渡船，江水拍打着水泥码头。 #line:fgang_1
林夏: 这船连方向舵都没有，在二维水面上只能左右平移，一辈子没法掉头。 #calm #line:fgang_2
-> END

=== pier_crates ===
码头边堆着几口木箱和橘红色的救生圈，箱子缝里漏出一点高饱和度的青色颜料。 #line:pcrates_1
林夏: 这是从市郊印染厂偷偷运回城里的旧色卡吧。 #calm #line:pcrates_2
-> END

=== pier_bench ===
江边的铁扶手长椅正对着江面，晚风吹过来带着一股潮湿的水汽。 #line:pbench_1
林夏: 歇会儿再往东走，前面就是市郊的未渲染区了。 #smile #line:pbench_2
-> END

// ---------- 老城区 · 筒子楼后巷 (city_backalley) ----------

=== backalley_sink ===
公用水池的水龙头滴答滴答，池边搁着三只搪瓷脸盆，盆底各写着一个门牌号。 #line:balley_sink_1
林夏: 三〇二、三〇四、三〇六……单单少了三〇五。 #calm #line:balley_sink_2
-> END

=== backalley_batteries ===
修车铺的后门口码着一摞拆下来的电瓶，最上面那块用粉笔写着“限速器已拆”。 #line:balley_bat_1
林夏: 老季的后门，比前门还忙。 #smile #line:balley_bat_2
-> END

=== backalley_stairs ===
铁皮楼梯贴着墙爬上二楼，楼梯口挂着块木牌：“住户自行车请勿上楼”。 #line:balley_stairs_1
林夏: 楼上住的是谁，改天再来敲门。 #calm #line:balley_stairs_2
-> END

// ---------- 江城大学 · 校园超市 (avenue_kiosk) ----------

=== kiosk_freezer ===
冰柜的玻璃门上结了一层薄霜，里面冻着橘子汽水和绿豆雪糕。 #line:kfreezer_1
林夏: 绿豆雪糕两块五，比我上学那会儿只涨了五毛。 #smile #line:kfreezer_2
-> END

=== kiosk_shelf ===
货架上的方便面按口味排得整整齐齐，只有红烧牛肉那一格是空的。 #line:kshelf_1
林夏: 看来全校的夜宵口味都一样。 #smile #line:kshelf_2
-> END


// ---------- 市郊 · 烂尾线稿别墅区 (suburb_wireframe) ----------

=== wireframe_villa ===
左半边还是红砖房，右半边直接变成了发光的白色二维线条，大顾师兄把画板支在门口。 #line:wvilla_1
林夏: 开发商跑路前只画了碰撞线稿没贴材质……大顾师兄管这叫“极简主义公社”。 #smile #line:wvilla_2
-> END

=== villa_campfire ===
石头围成的火堆上支着一把铝水壶，火苗把旁边的白线框照得一闪一闪。 #line:wfire_1
林夏: 在没有墙的线条房子外头烧水泡面，倒也不怕煤气中毒。 #smile #line:wfire_2
-> END

=== pump_station ===
红砖砌成的97号排污总泵站嗡嗡震动，粗大的铁管一路往东通向第三印染厂。 #line:pump_1
林夏: 原来全城被抽掉的多余色彩，都是顺着这根管子泵去印染厂水塘的。 #calm #line:pump_2
-> END

=== concrete_pipes ===
草坪上堆着好几节一人高的水泥排污管，管壁上用白粉笔画着方向箭头。 #line:cpipes_1
林夏: 里面干燥得很，尼卡要是钻进去准能睡个好觉。 #smile #line:cpipes_2
-> END

=== wireframe_arch ===
纯白线条勾勒出的花园拱门立在草地上，旁边架着一台老式光学水准仪。 #line:warch_1
林夏: 透过水准仪的十字丝往东看，远处的背景贴图已经开始大块剥落了。 #calm #line:warch_2
-> END


// ---------- 市郊 · 绿幕防波堤 (suburb_breakwater) ----------

=== clearance_barrier ===
铁皮围挡上挂着“清样重地”的旧木牌，旁边堆满了五颜六色的废颜料桶。 #line:cbar_1
林夏: 施工队把擦掉的街道贴图全倒进桶里了，再往东就是世界尽头。 #calm #line:cbar_2
-> END

=== pier_telescope ===
防波堤尽头架着一具黄铜望远镜，镜头正对着前方一望无际的纯绿虚空。 #line:ptele_1
林夏: 望远镜里只有绿幕（00FF00）和几座还没上色的线稿防波块。 #shock #line:ptele_2
-> END

=== tetrapod_shore ===
水泥防波块一层层堆在岸边，越靠近绿幕边缘，防波块就越退化成透明的白线框。 #line:tetra_1
林夏: 连石头都在被一点点抠成透明底色。 #calm #line:tetra_2
-> END

=== breakwater_void ===
水泥防波堤在这里彻底断开，白纸一样的撕裂边缘外是刺眼的纯绿虚空。 #line:bvoid_1
林夏: 江城测绘志的最后一站……原来世界的边界真的只是一张没画完的画布。 #calm #line:bvoid_2
-> END


