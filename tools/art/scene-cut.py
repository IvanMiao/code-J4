#!/usr/bin/env python3
"""Build the Ming scriptorium plate and fixed pose overlays from the approved inputs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = ROOT / "assets/scenes/ming_scriptorium.yaml"
OUT_DIR = ROOT / "public/art/ming"
SIDECAR = ROOT / "assets/scenes/ming_scriptorium.art.json"
CANAL_SPEC_PATH = ROOT / "assets/scenes/ming_canal_street.yaml"
CANAL_SIDECAR = ROOT / "assets/scenes/ming_canal_street.art.json"


def box_crop(image: Image.Image, box: list[int]) -> Image.Image:
    return image.crop(tuple(box))


def changed_mask(edit: Image.Image, reference: Image.Image) -> Image.Image:
    mask = ImageChops.difference(edit, reference).convert("L")
    return mask.point(lambda value: 255 if value > 30 else 0).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MaxFilter(5))


def match_color(
    edit: Image.Image,
    edit_roi: Image.Image,
    plate_roi: Image.Image,
    changed: Image.Image,
    silhouette: Image.Image | None,
) -> Image.Image:
    union = ImageChops.lighter(changed, silhouette) if silhouette else changed
    outside = ImageChops.invert(union)
    if outside.getbbox() is None:
        return edit
    source_stats = ImageStat.Stat(edit_roi, mask=outside)
    target_stats = ImageStat.Stat(plate_roi, mask=outside)
    offsets = [target - source for source, target in zip(source_stats.mean, target_stats.mean)]
    corrected = edit.copy()
    source = edit.load()
    target = corrected.load()
    for y in range(edit.height):
        for x in range(edit.width):
            pixel = source[x, y]
            if 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2] < 60:
                continue
            target[x, y] = tuple(
                max(0, min(255, round(channel + offset)))
                for channel, offset in zip(pixel, offsets)
            )
    return corrected


def build_plate(spec: dict) -> Image.Image:
    pano = Image.open(ROOT / spec["pano"]).convert("RGB")
    clean = Image.open(ROOT / spec["clean"]).convert("RGB")
    expected = tuple(spec["pano_size"])
    if pano.size != expected:
        raise ValueError(f"pano size {pano.size} does not match scene spec {expected}")
    clean = clean.resize(expected, Image.Resampling.LANCZOS)
    mask = Image.new("L", expected, 0)
    draw = ImageDraw.Draw(mask)
    grow = spec["erase_grow"]
    for figure in spec["figures"].values():
        x1, y1, x2, y2 = figure["erase"]
        draw.rectangle((x1 - grow, y1 - grow, x2 + grow, y2 + grow), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(spec["erase_blur"]))
    return Image.composite(clean, pano, mask)


def build_pose(spec: dict, plate: Image.Image, key: str, data: dict, scale: float) -> dict:
    crop_box = data["crop"]
    crop_size = (crop_box[2] - crop_box[0], crop_box[3] - crop_box[1])
    edit = Image.open(ROOT / data["source"]).convert("RGB").resize(crop_size, Image.Resampling.LANCZOS)
    crop_x, crop_y = crop_box[:2]
    roi = data["roi"]
    local_box = [roi[0] - crop_x, roi[1] - crop_y, roi[2] - crop_x, roi[3] - crop_y]
    edited_roi = box_crop(edit, local_box)
    plate_source = box_crop(plate, roi)
    initial_mask = changed_mask(edited_roi, plate_source)
    silhouette_points = data.get("foreground_silhouette_art")
    silhouette_source = None
    if silhouette_points:
        silhouette_source = Image.new("L", plate_source.size, 0)
        source_points = [(round(px / scale - roi[0]), round(py / scale - roi[1])) for px, py in silhouette_points]
        ImageDraw.Draw(silhouette_source).polygon(source_points, fill=255)
        dilation_art = int(data.get("silhouette_dilate_art", 3))
        dilation_source = max(1, round(dilation_art / scale))
        silhouette_source = silhouette_source.filter(ImageFilter.MaxFilter(dilation_source * 2 + 1))
    edit = match_color(edit, edited_roi, plate_source, initial_mask, silhouette_source)
    edited_roi = box_crop(edit, local_box)
    mask = changed_mask(edited_roi, plate_source).filter(ImageFilter.GaussianBlur(1.5))

    x = round(roi[0] * scale)
    y = round(roi[1] * scale)
    right = round(roi[2] * scale)
    bottom = round(roi[3] * scale)
    frame_size = (right - x, bottom - y)
    edit_art = edited_roi.resize(frame_size, Image.Resampling.LANCZOS)
    alpha = mask.resize(frame_size, Image.Resampling.LANCZOS)
    changed_pixels = alpha.point(lambda value: 255 if value >= 128 else 0).histogram()[255]
    if changed_pixels < spec["pose_min_changed_pixels"]:
        raise ValueError(f"{key} pose has only {changed_pixels} changed opaque pixels")
    if silhouette_points:
        silhouette = Image.new("L", frame_size, 0)
        origin_x, origin_y = x, y
        local_points = [(round(px - origin_x), round(py - origin_y)) for px, py in silhouette_points]
        ImageDraw.Draw(silhouette).polygon(local_points, fill=255)
        dilation = int(data.get("silhouette_dilate_art", 3))
        silhouette = silhouette.filter(ImageFilter.MaxFilter(dilation * 2 + 1))
        feather = float(data.get("silhouette_feather_art", 0))
        if feather:
            silhouette = silhouette.filter(ImageFilter.GaussianBlur(feather))
        alpha = ImageChops.lighter(alpha, silhouette)
    frame0 = Image.new("RGBA", frame_size, (0, 0, 0, 0))
    frame1 = edit_art.convert("RGBA")
    frame1.putalpha(alpha)
    sheet = Image.new("RGBA", (frame_size[0] * 2, frame_size[1]), (0, 0, 0, 0))
    sheet.paste(frame0, (0, 0))
    sheet.paste(frame1, (frame_size[0], 0))
    sheet.save(OUT_DIR / f"pose_{key}.png", optimize=False)

    width, height = right - x, bottom - y
    return {
        "origin": [x, y],
        "frame": [width, height],
        "actor": [x + width // 2, bottom],
        "depth": data["depth"],
        "changedPixels": changed_pixels,
        "pano_roi": roi,
    }


def feather_mask(size: tuple[int, int], feather: int) -> Image.Image:
    width, height = size
    if feather <= 0:
        return Image.new("L", size, 255)
    pixels = bytearray(width * height)
    for y in range(height):
        edge_y = min(y, height - y - 1)
        for x in range(width):
            distance = min(x, width - x - 1, edge_y)
            t = min(1.0, max(0.0, distance / feather))
            smooth = t * t * (3 - 2 * t)
            pixels[y * width + x] = round(smooth * 255)
    return Image.frombytes("L", size, bytes(pixels))


def paste_box_edit(
    image: Image.Image,
    patch_path: str,
    box: list[int],
    feather: int,
) -> None:
    x1, y1, x2, y2 = box
    size = (x2 - x1, y2 - y1)
    patch = Image.open(ROOT / patch_path).convert("RGB")
    patch = ImageOps.fit(patch, size, method=Image.Resampling.LANCZOS)
    area = image.crop((x1, y1, x2, y2))
    area.paste(patch, (0, 0), feather_mask(size, feather))
    image.paste(area, (x1, y1))


def prepare_canal_inputs(spec: dict) -> None:
    pano = Image.open(ROOT / spec["pano"]).convert("RGB")
    if pano.size != tuple(spec["sourceSize"]):
        raise ValueError(f"pano size {pano.size} does not match scene spec {spec['sourceSize']}")
    inputs = [(entry["input"], entry["box"]) for entry in spec["repairs"]]
    inputs.extend((figure["eraseInput"], figure["erase"]) for figure in spec["figures"].values())
    for path, box in inputs:
        pano.crop(tuple(box)).save(ROOT / path)
        print(f"wrote {path}")


def build_canal_scene(spec: dict) -> None:
    pano = Image.open(ROOT / spec["pano"]).convert("RGB")
    if pano.size != tuple(spec["sourceSize"]):
        raise ValueError(f"pano size {pano.size} does not match scene spec {spec['sourceSize']}")

    retouched = pano.copy()
    for repair in spec["repairs"]:
        paste_box_edit(retouched, repair["patch"], repair["box"], repair["feather"])
    retouched.save(ROOT / spec["retouched"], optimize=False)

    clean = retouched.copy()
    for figure in spec["figures"].values():
        paste_box_edit(clean, figure["erasePatch"], figure["erase"], figure["eraseFeather"])
    clean.save(ROOT / spec["clean"], optimize=False)

    crop = tuple(spec["crop"])
    art_size = tuple(spec["artSize"])
    crop_size = (crop[2] - crop[0], crop[3] - crop[1])
    art = clean.crop(crop).resize(art_size, Image.Resampling.LANCZOS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    art.save(OUT_DIR / "bg_canal_street.png", optimize=False)

    andreas = spec["figures"]["andreas"]
    retouched.crop(tuple(andreas["figure"])).save(ROOT / spec["andreasRef"], optimize=False)
    scale_x = art_size[0] / crop_size[0]
    scale_y = art_size[1] / crop_size[1]
    figures = {}
    for name, figure in spec["figures"].items():
        x1, y1, x2, y2 = figure["figure"]
        feet_x, feet_y = figure["feetPano"]
        height = (y2 - y1) * scale_y
        feet = [
            round((feet_x - crop[0]) * scale_x),
            round((feet_y - crop[1]) * scale_y),
        ]
        if abs(height - figure["height_art"]) > 1:
            raise ValueError(f"{name} painted height differs from scene spec")
        if feet != figure["feet_art"]:
            raise ValueError(f"{name} painted feet differ from scene spec: {feet}")
        figures[name] = {
            "sprite": figure["sprite"],
            "figure": figure["figure"],
            "figure_art": [
                round((x1 - crop[0]) * scale_x),
                round((y1 - crop[1]) * scale_y),
                round((x2 - crop[0]) * scale_x),
                round((y2 - crop[1]) * scale_y),
            ],
            "height_art": round(height, 2),
            "feet_pano": figure["feetPano"],
            "feet_art": feet,
            "erase": figure["erase"],
        }
    sidecar = {
        "map": spec["map"],
        "crop": spec["crop"],
        "art_size": art_size,
        "scale": [scale_x, scale_y],
        "figures": figures,
    }
    CANAL_SIDECAR.write_text(
        json.dumps(sidecar, ensure_ascii=False, indent=2) + "\n",
        encoding="utf8",
    )
    print(
        "wrote public/art/ming/bg_canal_street.png, "
        f"{spec['retouched']}, {spec['clean']}, and {CANAL_SIDECAR.relative_to(ROOT)}"
    )


def apply_canal_art_repairs(spec: dict) -> None:
    path = OUT_DIR / "bg_canal_street.png"
    art = Image.open(path).convert("RGB")
    for repair in spec.get("artRepairs", []):
        paste_box_edit(art, repair["patch"], repair["box"], repair["feather"])
    art.save(path, optimize=False)
    print(f"applied {len(spec.get('artRepairs', []))} fixed-box art repairs to {path.relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scene", choices=("ming_scriptorium", "ming_canal_street"), default="ming_scriptorium")
    parser.add_argument("--prepare-inputs", action="store_true")
    parser.add_argument("--apply-art-repairs", action="store_true")
    args = parser.parse_args()
    if args.scene == "ming_canal_street":
        spec = json.loads(CANAL_SPEC_PATH.read_text(encoding="utf8"))
        if args.prepare_inputs:
            prepare_canal_inputs(spec)
            return
        if args.apply_art_repairs:
            apply_canal_art_repairs(spec)
            return
        build_canal_scene(spec)
        return
    if args.prepare_inputs:
        parser.error("--prepare-inputs is only supported for ming_canal_street")

    spec = json.loads(SPEC_PATH.read_text(encoding="utf8"))
    scale = spec["art_size"][0] / spec["pano_size"][0]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    plate = build_plate(spec)
    plate.resize(tuple(spec["art_size"]), Image.Resampling.LANCZOS).save(
        OUT_DIR / "bg_scriptorium.png", optimize=False
    )
    positions = {"map": "ming_scriptorium", "scale": scale, "poses": {}}
    for key, pose in spec["poses"].items():
        positions["poses"][key] = build_pose(spec, plate, key, pose, scale)
    SIDECAR.write_text(json.dumps(positions, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"wrote public/art/ming/bg_scriptorium.png and {len(positions['poses'])} pose sheets")


if __name__ == "__main__":
    main()
