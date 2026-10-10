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
def tmj(title, bg, walk, blocked, anchors, actors, triggers, foreground=()):
    layer = lambda n, objs: {"type": "objectgroup", "name": n, "objects": objs}
    return {"type": "map", "orientation": "orthogonal", "width": 80, "height": 45, "tilewidth": 24, "tileheight": 24, "infinite": False,
            "version": "1.10", "tiledversion": "1.11.0",
            "properties": props({"title": title, "background": bg, "bgm": "campus_afternoon", "ambience": "campus_day"}),
            "layers": [layer("walkable", [poly(f"w{i}", p) for i, p in enumerate(walk)]),
                       layer("blocked", [poly(f"b{i}", p) for i, p in enumerate(blocked)]),
                       layer("anchors", [pt(n, x, y) for n, (x, y) in anchors.items()]),
                       layer("actors", actors), layer("triggers", triggers),
                       layer("foreground", [dict(poly(f"fg{i}", p), properties=props({"baseline": str(b)})) for i, (p, b) in enumerate(foreground)])]}
maps = {
    "gate": tmj("江城大学 · 校门", "bg_gate",
        [BOX(570, 410, 1920, 830), BOX(800, 290, 1110, 410)],
        [BOX(596, 540, 660, 700), BOX(766, 760, 924, 812), BOX(600, 490, 645, 525), BOX(1250, 400, 1400, 520), BOX(1218, 440, 1246, 516)],
        {"player_start": (955, 450), "from_avenue": (1850, 620)}, [],
        [rect("gate_sign", 800, 290, 310, 40, {"knot": "gate_sign", "face": "up"}), rect("guard_booth", 1218, 516, 190, 40, {"knot": "guard_booth", "face": "up"}),
         rect("to_avenue", 1895, 410, 25, 420, {"exit": "avenue:from_gate"})]),
    "avenue": tmj("江城大学 · 梧桐苑", "bg_avenue",
        [BOX(0, 426, 1920, 890), BOX(430, 336, 600, 426)],
        [BOX(630, 426, 920, 446), BOX(1810, 470, 1840, 500), BOX(70, 830, 100, 860)],
        {"from_gate": (120, 640), "from_library": (1820, 640), "dorm_door": (515, 360)}, [],
        [rect("dorm_door", 430, 320, 170, 60, {"knot": "dorm_door", "face": "up"}), rect("notice_board", 1036, 396, 244, 64, {"knot": "notice_board", "face": "up"}),
         rect("kiosk", 1420, 396, 300, 64, {"knot": "kiosk", "face": "up"}),
         rect("to_gate", 0, 426, 25, 464, {"exit": "gate:from_avenue"}), rect("to_library", 1895, 426, 25, 464, {"exit": "library:from_avenue"})],
        [(octo(436, 850, 92, 76), 1030), (octo(860, 920, 64, 54), 1070), (octo(1470, 916, 66, 52), 1050), (octo(1850, 890, 62, 58), 1050)]),
    "library": tmj("江城大学 · 图书馆", "bg_library",
        [BOX(240, 480, 1920, 910), BOX(770, 300, 1630, 480), BOX(0, 560, 240, 760)],
        [octo(1200, 676, 130, 95), BOX(670, 530, 810, 620), BOX(670, 720, 810, 816), BOX(1600, 530, 1730, 620), BOX(1600, 720, 1730, 816),
         BOX(1010, 560, 1070, 610), BOX(1336, 560, 1390, 610), BOX(1010, 730, 1070, 780), BOX(1336, 730, 1390, 780)],
        {"from_avenue": (120, 660), "player_start": (1130, 880), "lib_steps": (1290, 420), "fountain_front": (1290, 830)},
        [pt("ayin", 1290, 830, {"knot": "ayin_talk", "face": "down"})],
        [rect("library_door", 1080, 300, 240, 40, {"knot": "library_door", "face": "up"}), rect("to_avenue", 0, 560, 25, 200, {"exit": "avenue:from_library"})]),
}
for k, v in maps.items():
    open(f"content/maps/{k}.tmj", "w").write(json.dumps(v, ensure_ascii=False, indent=1) + "\n")
