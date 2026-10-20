"""Writes content/maps/ming_{canal_street,scriptorium}.tmj (ancient line, side view).
World = background pixels x1 (bg_canal_long 4492x540, bg_scriptorium 960x540)."""
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
def imagelayer(name, image, x=0, y=0, parallaxx=1.0, parallaxy=1.0, plane="back"):
    return {"id": nid(), "type": "imagelayer", "name": name, "image": image, "offsetx": x, "offsety": y,
            "parallaxx": parallaxx, "parallaxy": parallaxy, "properties": props({"plane": plane})}
SIDE = {"art": "ming", "view": "side", "script": "hant", "player": "shen", "dialogue": "bubble", "scaleFar": "0.38", "scaleNear": "0.42"}
def tmj(w, h, title, bg, walk, blocked, anchors, actors, triggers, ambient=(), foreground=(), layers=(), **extra):
    layer = lambda n, objs: {"type": "objectgroup", "name": n, "objects": objs}
    tile = 4 if (w, h) == (4492, 540) else 10 if (w, h) == (1260, 510) else 12
    image_layers = list(layers)
    back_layers = [l for l in image_layers if next((p["value"] for p in l.get("properties", []) if p["name"] == "plane"), "back") != "front"]
    front_layers = [l for l in image_layers if next((p["value"] for p in l.get("properties", []) if p["name"] == "plane"), "back") == "front"]
    return {"type": "map", "orientation": "orthogonal", "width": w // tile, "height": h // tile, "tilewidth": tile, "tileheight": tile, "infinite": False,
            "version": "1.10", "tiledversion": "1.11.0",
            "properties": props({"title": title, "background": bg, **SIDE, **extra}),
            "layers": [*back_layers,
                       layer("walkable", [poly(f"w{i}", p) for i, p in enumerate(walk)]),
                       layer("blocked", [poly(f"b{i}", p) for i, p in enumerate(blocked)]),
                       layer("anchors", [pt(n, x, y) for n, (x, y) in anchors.items()]),
                       layer("actors", actors), layer("triggers", triggers),
                       layer("foreground", [poly(f"fg{i}", p, {"baseline": str(b)}) for i, (p, b) in enumerate(foreground)]),
                       layer("ambient", list(ambient)), *front_layers]}
with open(ROOT / "assets/scenes/ming_scriptorium.art.json", encoding="utf-8") as f:
    scene = json.load(f)
with open(ROOT / "assets/scenes/ming_scriptorium.yaml", encoding="utf-8") as f:
    scene_spec = json.load(f)
pose_actor = {key: data["actor"] for key, data in scene["poses"].items()}
linu_silhouette = [tuple(p) for p in scene_spec["poses"]["linu"]["foreground_silhouette_art"]]
maps = {}
maps["ming_canal_street"] = tmj(4492, 540, "水鄉 · 文林閣前", "bg_canal_long",
        [BOX(25, 408, 2405, 492), BOX(2915, 408, 4467, 492),
         [(2405, 408), (2600, 352), (2720, 352), (2915, 408),
          (2915, 492), (2850, 422), (2720, 385), (2600, 385),
          (2470, 421), (2405, 492)]],
        [BOX(1355, 428, 1560, 448), BOX(3340, 400, 3445, 420)],
        {"player_start": (480, 460), "from_scriptorium": (4100, 472)},
        [pt("andreas", 3700, 456, {"knot": "ming_andreas", "face": "left"})],
        [rect("ming_bookshop", 150, 400, 300, 45, {"knot": "ming_bookshop", "face": "up"}),
         rect("ming_drying_sheets", 640, 400, 280, 45, {"knot": "ming_drying_sheets", "face": "up"}),
         rect("ming_teahouse", 1190, 400, 500, 58, {"knot": "ming_teahouse", "face": "up"}),
         rect("ming_bridge", 2600, 340, 120, 40, {"knot": "ming_bridge", "face": "up"}),
         rect("to_scriptorium", 4010, 398, 180, 32, {"exit": "ming_scriptorium:from_street", "face": "up"})],
        [amb("leaves", 2190, 20, 110, 300, every=1400),
         amb("leaves", 2520, 20, 190, 250, every=1500),
         amb("motes", 0, 0, 4492, 400)],
        foreground=[
            ([(2405, 398), (2600, 328), (2720, 328), (2915, 398),
              (2915, 472), (2405, 472)], 472),
        ],
        intro="ming_intro", ground="stone", frameInset="10", paperGrain="0.45",
        scaleFar="0.34", scaleNear="0.375")
oid[0] = 12
maps["ming_scriptorium"] = tmj(960, 540, "經藏院 · 寫經房", "bg_scriptorium",
        [BOX(110, 304, 140, 395), BOX(110, 323, 850, 342), BOX(110, 333, 850, 458)],
        [BOX(144, 341, 398, 458), BOX(850, 300, 960, 458)],
        {"player_start": (145, 336), "from_street": (145, 336), "debate_spot": (465, 452),
         "behind_chest": (350, 336), "left_extreme": (145, 336), "right_extreme": (835, 350)},
        [pt("kuang", 696, 452, {"knot": "ming_kuang", "face": "left"}),
         pt("monk_left", *pose_actor["monk_left"], {"depth": str(scene["poses"]["monk_left"]["depth"])}),
         pt("monk_right", *pose_actor["monk_right"], {"depth": str(scene["poses"]["monk_right"]["depth"])}),
         pt("linu", *pose_actor["linu"], {"depth": str(scene["poses"]["linu"]["depth"])})],
        [rect("to_street", 0, 315, 140, 65, {"exit": "ming_canal_street:from_scriptorium", "face": "left"}),
         rect("ming_reading_table", 430, 333, 220, 38, {"knot": "ming_reading_table", "face": "up"}),
         rect("ming_monk_left", 225, 286, 40, 30, {"knot": "ming_monk_left", "face": "up", "actor": "monk_left"}),
         rect("ming_monk_right", 720, 286, 170, 30, {"knot": "ming_monk_right", "face": "up", "actor": "monk_right"}),
         rect("ming_sutra_chest", 145, 319, 95, 20, {"knot": "ming_sutra_chest", "face": "right"}),
         rect("ming_linu", 255, 319, 80, 20, {"knot": "ming_linu", "face": "right", "actor": "linu"})],
        [amb("motes", 0, 0, 960, 380)],
        foreground=[
            ([(144, 348), (160, 330), (380, 330), (398, 348), (398, 456), (380, 466), (160, 466), (144, 452)], 466),
            (linu_silhouette, 466),
        ],
        intro="ming_scriptorium_intro", scaleFar="1", scaleNear="1", frameInset="10")
for mid, m in maps.items():
    with open(ROOT / f"content/maps/{mid}.tmj", "w", encoding="utf-8") as f: json.dump(m, f, ensure_ascii=False, indent=1)
print("wrote", ", ".join(maps))
