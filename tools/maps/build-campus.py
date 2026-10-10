"""Writes content/maps/{gate,avenue,library}.tmj. World = background pixels x2 (960x540 art -> 1920x1080).
One-off authoring helper; the .tmj files can be edited in Tiled afterwards."""
import json, math
oid = [0]
def nid(): oid[0] += 1; return oid[0]
def BOX(x1, y1, x2, y2): return [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
def octo(cx, cy, rx, ry): return [(round(cx + rx * math.cos(a * math.pi / 4)), round(cy + ry * math.sin(a * math.pi / 4))) for a in range(8)]
def props(d): return [{"name": k, "type": "string", "value": v} for k, v in d.items()]
def poly(name, pts): return {"id": nid(), "name": name, "x": 0, "y": 0, "polygon": [{"x": x, "y": y} for x, y in pts]}
def pt(name, x, y, p=None):
    o = {"id": nid(), "name": name, "x": x, "y": y, "point": True}
    if p: o["properties"] = props(p)
    return o
def rect(name, x, y, w, h, p): return {"id": nid(), "name": name, "x": x, "y": y, "width": w, "height": h, "properties": props(p)}
def tmj(title, bg, walk, blocked, anchors, actors, triggers):
    layer = lambda n, objs: {"type": "objectgroup", "name": n, "objects": objs}
    return {"type": "map", "orientation": "orthogonal", "width": 80, "height": 45, "tilewidth": 24, "tileheight": 24, "infinite": False,
            "version": "1.10", "tiledversion": "1.11.0",
            "properties": props({"title": title, "background": bg, "bgm": "campus_afternoon", "ambience": "campus_day"}),
            "layers": [layer("walkable", [poly(f"w{i}", p) for i, p in enumerate(walk)]),
                       layer("blocked", [poly(f"b{i}", p) for i, p in enumerate(blocked)]),
                       layer("anchors", [pt(n, x, y) for n, (x, y) in anchors.items()]),
                       layer("actors", actors), layer("triggers", triggers)]}
maps = {
    "gate": tmj("江城大学 · 校门", "bg_gate",
        [BOX(570, 410, 1920, 830), BOX(800, 290, 1110, 410)],
        [BOX(596, 540, 660, 700), BOX(766, 760, 924, 812), BOX(600, 490, 645, 525), BOX(1250, 400, 1400, 520), BOX(1218, 440, 1246, 516)],
        {"player_start": (955, 450), "from_avenue": (1850, 620)}, [],
        [rect("gate_sign", 800, 290, 310, 40, {"knot": "gate_sign"}), rect("guard_booth", 1218, 516, 190, 40, {"knot": "guard_booth"}),
         rect("to_avenue", 1895, 410, 25, 420, {"exit": "avenue:from_gate"})]),
    "avenue": tmj("江城大学 · 梧桐苑", "bg_avenue",
        [BOX(0, 530, 1920, 830), BOX(80, 430, 1920, 540), BOX(900, 330, 1050, 440)],
        [BOX(210, 410, 600, 500), BOX(710, 410, 890, 500), BOX(1120, 440, 1360, 505), BOX(130, 440, 190, 505), BOX(620, 440, 680, 505),
         BOX(1490, 440, 1560, 505), BOX(1810, 440, 1870, 505), BOX(1600, 760, 1920, 840), BOX(1420, 800, 1500, 840)],
        {"from_gate": (190, 680), "from_library": (1850, 640), "dorm_door": (975, 350)}, [],
        [rect("dorm_door", 900, 330, 150, 40, {"knot": "dorm_door"}), rect("notice_board", 1120, 505, 240, 40, {"knot": "notice_board"}),
         rect("kiosk", 1530, 740, 70, 90, {"knot": "kiosk"}),
         rect("to_gate", 0, 530, 25, 300, {"exit": "gate:from_avenue"}), rect("to_library", 1895, 430, 25, 400, {"exit": "library:from_avenue"})]),
    "library": tmj("江城大学 · 图书馆", "bg_library",
        [BOX(240, 480, 1920, 910), BOX(770, 300, 1630, 480), BOX(0, 560, 240, 760)],
        [octo(1200, 676, 130, 95), BOX(670, 530, 810, 620), BOX(670, 720, 810, 816), BOX(1600, 530, 1730, 620), BOX(1600, 720, 1730, 816),
         BOX(1010, 560, 1070, 610), BOX(1336, 560, 1390, 610), BOX(1010, 730, 1070, 780), BOX(1336, 730, 1390, 780)],
        {"from_avenue": (120, 660), "player_start": (1130, 880), "lib_steps": (1290, 420), "fountain_front": (1290, 830)},
        [pt("ayin", 1290, 830, {"knot": "ayin_talk", "face": "down"})],
        [rect("library_door", 1080, 300, 240, 40, {"knot": "library_door"}), rect("to_avenue", 0, 560, 25, 200, {"exit": "avenue:from_library"})]),
}
for k, v in maps.items():
    open(f"content/maps/{k}.tmj", "w").write(json.dumps(v, ensure_ascii=False, indent=1) + "\n")
