#!/usr/bin/env python3
"""Build the Ming scriptorium plate and fixed pose overlays from the approved inputs."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = ROOT / "assets/scenes/ming_scriptorium.yaml"
OUT_DIR = ROOT / "public/art/ming"
SIDECAR = ROOT / "assets/scenes/ming_scriptorium.art.json"


def box_crop(image: Image.Image, box: list[int]) -> Image.Image:
    return image.crop(tuple(box))


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
    mask = ImageChops.difference(edited_roi, plate_source).convert("L").point(lambda p: 255 if p > 30 else 0)
    mask = mask.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.5))

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


def main() -> None:
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
