"""Writes content/maps/ming_{canal_street,scriptorium}.tmj (ancient line, side view).
World = background pixels x1 (bg_canal_street 1260x540, bg_scriptorium 960x540)."""
import json
oid = [0]
def nid(): oid[0] += 1; return oid[0]
def BOX(x1, y1, x2, y2): return [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
def props(d): return [{"name": k, "type": "string", "value": v} for k, v in d.items()]
def poly(name, pts): return {"id": nid(), "name": name, "x": 0, "y": 0, "polygon": [{"x": x, "y": y} for x, y in pts]}
def pt(name, x, y, p=None):
    o = {"id": nid(), "name": name, "x": x, "y": y, "point": True}
    if p: o["properties"] = props(p)
    return o
def rect(name, x, y, w, h, p): return {"id": nid(), "name": name, "x": x, "y": y, "width": w, "height": h, "properties": props(p)}
def amb(kind, x, y, w, h, **p): return rect(kind, x, y, w, h, {"kind": kind, **{k: str(v) for k, v in p.items()}})
SIDE = {"art": "ming", "view": "side", "player": "shen", "dialogue": "bubble", "scaleFar": "0.9", "scaleNear": "1"}
def tmj(w, title, bg, walk, blocked, anchors, actors, triggers, ambient=(), **extra):
    layer = lambda n, objs: {"type": "objectgroup", "name": n, "objects": objs}
    return {"type": "map", "orientation": "orthogonal", "width": w // 12, "height": 45, "tilewidth": 12, "tileheight": 12, "infinite": False,
            "version": "1.10", "tiledversion": "1.11.0",
            "properties": props({"title": title, "background": bg, **SIDE, **extra}),
            "layers": [layer("walkable", [poly(f"w{i}", p) for i, p in enumerate(walk)]),
                       layer("blocked", [poly(f"b{i}", p) for i, p in enumerate(blocked)]),
                       layer("anchors", [pt(n, x, y) for n, (x, y) in anchors.items()]),
                       layer("actors", actors), layer("triggers", triggers),
                       layer("foreground", []), layer("ambient", list(ambient))]}
maps = {
    "ming_canal_street": tmj(1260, "水乡 · 文林阁前", "bg_canal_street",
        [BOX(0, 450, 1260, 505), BOX(330, 400, 800, 450), BOX(800, 415, 975, 450), BOX(975, 412, 1250, 450)],
        [],
        {"player_start": (240, 480), "from_scriptorium": (1100, 440)},
        [pt("andreas", 870, 470, {"knot": "ming_andreas", "face": "left"})],
        [rect("ming_bookshop", 50, 425, 140, 25, {"knot": "ming_bookshop", "face": "up"}),
         rect("ming_drying_sheets", 195, 425, 135, 25, {"knot": "ming_drying_sheets", "face": "up"}),
         rect("ming_teahouse", 350, 380, 110, 25, {"knot": "ming_teahouse", "face": "up"}),
         rect("ming_bridge", 500, 380, 230, 25, {"knot": "ming_bridge", "face": "up"}),
         rect("to_scriptorium", 1040, 395, 125, 25, {"exit": "ming_scriptorium:from_street"})],
        [amb("leaves", 330, 40, 280, 300, every=1400), amb("birds", 300, 410, 900, 90, n=2), amb("motes", 0, 0, 1260, 380)],
        intro="ming_intro"),
    "ming_scriptorium": tmj(960, "经藏院 · 写经房", "bg_scriptorium",
        [BOX(0, 380, 940, 520)],
        [BOX(15, 412, 205, 530)],
        {"player_start": (300, 470), "from_street": (60, 400), "debate_spot": (560, 470)},
        [pt("kuang", 720, 470, {"knot": "ming_kuang", "face": "left"}), pt("linu", 165, 418, {"knot": "ming_linu", "face": "right"})],
        [rect("to_street", 0, 380, 20, 32, {"exit": "ming_canal_street:from_scriptorium"}),
         rect("ming_reading_table", 450, 365, 200, 25, {"knot": "ming_reading_table", "face": "up"}),
         rect("ming_monk_left", 200, 355, 140, 25, {"knot": "ming_monk_left", "face": "up"}),
         rect("ming_monk_right", 760, 355, 170, 25, {"knot": "ming_monk_right", "face": "up"}),
         rect("ming_sutra_chest", 180, 430, 25, 60, {"knot": "ming_sutra_chest", "face": "left"})],
        [amb("motes", 0, 0, 960, 380)],
        intro="ming_scriptorium_intro"),
}
for mid, m in maps.items():
    with open(f"content/maps/{mid}.tmj", "w", encoding="utf-8") as f: json.dump(m, f, ensure_ascii=False, indent=1)
print("wrote", ", ".join(maps))
