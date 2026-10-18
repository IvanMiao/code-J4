"""Writes content/maps/ming_{canal_street,scriptorium}.tmj (ancient line, side view).
World = background pixels x1 (bg_canal_street 1260x540, bg_scriptorium 960x540)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
oid = [0]
def nid(): oid[0] += 1; return oid[0]
def BOX(x1, y1, x2, y2): return [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
def props(d): return [{"name": k, "type": "string", "value": v} for k, v in d.items()]
def poly(name, pts, p=None):
    o = {"id": nid(), "name": name, "x": 0, "y": 0, "polygon": [{"x": x, "y": y} for x, y in pts]}
    if p: o["properties"] = props(p)
    return o
def pt(name, x, y, p=None):
    o = {"id": nid(), "name": name, "x": x, "y": y, "point": True}
    if p: o["properties"] = props(p)
    return o
def rect(name, x, y, w, h, p): return {"id": nid(), "name": name, "x": x, "y": y, "width": w, "height": h, "properties": props(p)}
def amb(kind, x, y, w, h, **p): return rect(kind, x, y, w, h, {"kind": kind, **{k: str(v) for k, v in p.items()}})
SIDE = {"art": "ming", "view": "side", "script": "hant", "player": "shen", "dialogue": "bubble", "scaleFar": "0.38", "scaleNear": "0.42"}
def tmj(w, title, bg, walk, blocked, anchors, actors, triggers, ambient=(), foreground=(), **extra):
    layer = lambda n, objs: {"type": "objectgroup", "name": n, "objects": objs}
    return {"type": "map", "orientation": "orthogonal", "width": w // 12, "height": 45, "tilewidth": 12, "tileheight": 12, "infinite": False,
            "version": "1.10", "tiledversion": "1.11.0",
            "properties": props({"title": title, "background": bg, **SIDE, **extra}),
            "layers": [layer("walkable", [poly(f"w{i}", p) for i, p in enumerate(walk)]),
                       layer("blocked", [poly(f"b{i}", p) for i, p in enumerate(blocked)]),
                       layer("anchors", [pt(n, x, y) for n, (x, y) in anchors.items()]),
                       layer("actors", actors), layer("triggers", triggers),
                       layer("foreground", [poly(f"fg{i}", p, {"baseline": str(b)}) for i, (p, b) in enumerate(foreground)]),
                       layer("ambient", list(ambient))]}
with open(ROOT / "assets/scenes/ming_scriptorium.art.json", encoding="utf-8") as f:
    scene = json.load(f)
pose_actor = {key: data["actor"] for key, data in scene["poses"].items()}
maps = {
    "ming_canal_street": tmj(1260, "水鄉 · 文林閣前", "bg_canal_street",
        [BOX(0, 450, 1260, 505), BOX(330, 400, 800, 450), BOX(800, 415, 975, 450), BOX(975, 412, 1250, 450)],
        [],
        {"player_start": (240, 480), "from_scriptorium": (1100, 440)},
        [pt("andreas", 870, 470, {"knot": "ming_andreas", "face": "left"})],
        [rect("ming_bookshop", 50, 425, 140, 25, {"knot": "ming_bookshop", "face": "up"}),
         rect("ming_drying_sheets", 195, 425, 135, 25, {"knot": "ming_drying_sheets", "face": "up"}),
         rect("ming_teahouse", 350, 380, 110, 25, {"knot": "ming_teahouse", "face": "up"}),
         rect("ming_bridge", 500, 380, 230, 25, {"knot": "ming_bridge", "face": "up"}),
         rect("to_scriptorium", 1040, 395, 125, 25, {"exit": "ming_scriptorium:from_street"})],
        [amb("leaves", 330, 40, 280, 300, every=1400), amb("motes", 0, 0, 1260, 380)],
        intro="ming_intro", ground="stone"),
    "ming_scriptorium": tmj(960, "經藏院 · 寫經房", "bg_scriptorium",
        [BOX(110, 304, 140, 395), BOX(110, 323, 850, 342), BOX(110, 333, 850, 458)],
        [BOX(144, 341, 398, 458), BOX(850, 300, 960, 458)],
        {"player_start": (125, 350), "from_street": (125, 350), "debate_spot": (465, 452),
         "behind_chest": (350, 336), "left_extreme": (125, 350), "right_extreme": (835, 350)},
        [pt("kuang", 696, 452, {"knot": "ming_kuang", "face": "left"}),
         pt("monk_left", *pose_actor["monk_left"]),
         pt("monk_right", *pose_actor["monk_right"]),
         pt("linu", *pose_actor["linu"])],
        [rect("to_street", 0, 315, 140, 65, {"exit": "ming_canal_street:from_scriptorium", "face": "left"}),
         rect("ming_reading_table", 430, 333, 220, 38, {"knot": "ming_reading_table", "face": "up"}),
         rect("ming_monk_left", 225, 286, 40, 30, {"knot": "ming_monk_left", "face": "up", "actor": "monk_left"}),
         rect("ming_monk_right", 720, 286, 170, 30, {"knot": "ming_monk_right", "face": "up", "actor": "monk_right"}),
         rect("ming_sutra_chest", 145, 319, 95, 20, {"knot": "ming_sutra_chest", "face": "right"}),
         rect("ming_linu", 255, 319, 80, 20, {"knot": "ming_linu", "face": "right", "actor": "linu"})],
        [amb("motes", 0, 0, 960, 380)],
        foreground=[([(144, 348), (160, 330), (380, 330), (398, 348), (398, 456), (380, 466), (160, 466), (144, 452)], 466)],
        intro="ming_scriptorium_intro", scaleFar="1", scaleNear="1", frameInset="10"),
}
for mid, m in maps.items():
    with open(ROOT / f"content/maps/{mid}.tmj", "w", encoding="utf-8") as f: json.dump(m, f, ensure_ascii=False, indent=1)
print("wrote", ", ".join(maps))
