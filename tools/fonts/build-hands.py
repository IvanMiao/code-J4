#!/usr/bin/env python3
"""Download, pin, and subset the game's OFL handwriting fonts."""

from __future__ import annotations

import json
import re
import urllib.request
import zipfile
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "fonts-src"
OUTPUT = ROOT / "public" / "fonts" / "hands"
REVIEW = OUTPUT / "candidates"
PUNCTUATION = "。，、；：？！…—「」『』（）《》〔〕·｜"
FONTS = {
    "song": {
        "font": "NotoSerifTC[wght].ttf",
        "url": "https://raw.githubusercontent.com/google/fonts/main/ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf",
        "license": "https://raw.githubusercontent.com/google/fonts/main/ofl/notoseriftc/OFL.txt",
        "variable": True,
    },
    "kai": {
        "font": "LXGWWenKaiTC-Regular.ttf",
        "url": "https://github.com/lxgw/LxgwWenKaiTC/releases/download/v1.530/LXGWWenKaiTC-Regular.ttf",
        "license": "https://raw.githubusercontent.com/lxgw/LxgwWenKaiTC/main/OFL.txt",
    },
    "brush": {
        "font": "Iansui-Regular.ttf",
        "url": "https://github.com/ButTaiwan/iansui/releases/download/v1.020/iansui.zip",
        "license": "https://raw.githubusercontent.com/ButTaiwan/iansui/main/OFL.txt",
        "archive": "Iansui-Regular.ttf",
    },
    "xing": {
        "font": "ChenYuluoyan-2.0-Thin.ttf",
        "url": "https://github.com/Chenyu-otf/chenyuluoyan_thin/releases/download/v2.0/ChenYuluoyan-2.0-Thin.ttf",
        "license": "https://raw.githubusercontent.com/Chenyu-otf/chenyuluoyan_thin/main/license.txt",
    },
    "rough": {
        "font": "LXGWWenKaiTC-Regular.ttf",
        "url": "https://github.com/lxgw/LxgwWenKaiTC/releases/download/v1.530/LXGWWenKaiTC-Regular.ttf",
        "license": "https://raw.githubusercontent.com/lxgw/LxgwWenKaiTC/main/OFL.txt",
    },
}
CANDIDATES = {
    "Iansui": ("brush", "SIL OFL 1.1 — ButTaiwan/iansui"),
    "ChenYuluoyan": ("xing", "SIL OFL 1.1 — Chenyu-otf/chenyuluoyan_thin"),
    "LXGW-WenKai-TC": ("kai", "SIL OFL 1.1 — lxgw/LxgwWenKaiTC"),
}


def download(url: str, destination: Path) -> None:
    if destination.exists():
        return
    request = urllib.request.Request(url, headers={"User-Agent": "code-J4 font builder"})
    with urllib.request.urlopen(request, timeout=90) as response, destination.open("wb") as out:
        out.write(response.read())


def character_set() -> str:
    chars = set(chr(i) for i in range(32, 127))
    chars.update(PUNCTUATION)
    for path in (ROOT / "content" / "story").glob("*.ink"):
        chars.update(path.read_text(encoding="utf8"))
    for path in (ROOT / "content").rglob("*.yaml"):
        chars.update(path.read_text(encoding="utf8"))
    for path in (ROOT / "content" / "maps").glob("*.tmj"):
        data = json.loads(path.read_text(encoding="utf8"))
        for prop in data.get("properties", []):
            if prop.get("name") == "title":
                chars.update(str(prop.get("value", "")))
    for path in (ROOT / "src").rglob("*.ts"):
        source = path.read_text(encoding="utf8")
        for literal in re.findall(r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"|`(?:\\.|[^`\\])*`", source):
            chars.update(literal[1:-1])
    return "".join(sorted(chars))


def make_subset(key: str, config: dict[str, str | bool], chars: str) -> None:
    source = SOURCE / str(config["font"])
    license_path = SOURCE / f"OFL-{key}.txt"
    download(str(config["url"]), source if not config.get("archive") else SOURCE / "iansui.zip")
    if config.get("archive") and not source.exists():
        with zipfile.ZipFile(SOURCE / "iansui.zip") as archive:
            match = next(name for name in archive.namelist() if name.endswith(str(config["archive"])))
            source.write_bytes(archive.read(match))
    download(str(config["license"]), license_path)

    font = TTFont(source)
    ming_chars = set((ROOT / "content/story/ming.ink").read_text(encoding="utf8"))
    cmap = font.getBestCmap() or {}
    missing = sorted(ch for ch in ming_chars if ord(ch) > 127 and ord(ch) not in cmap)
    if missing:
        raise RuntimeError(f"{key} misses Ming glyphs: {''.join(missing)}")
    if config.get("variable"):
        instantiateVariableFont(font, {"wght": 600}, inplace=True)
    options = subset.Options()
    options.flavor = "woff2"
    options.retain_gids = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=chars)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(OUTPUT / f"{key}.woff2")
    (OUTPUT / f"OFL-{key}.txt").write_text(license_path.read_text(encoding="utf8"), encoding="utf8")
    if key in {"brush", "xing", "kai"}:
        REVIEW.mkdir(parents=True, exist_ok=True)
        font.save(REVIEW / f"{key}.woff2")
        (REVIEW / f"OFL-{key}.txt").write_text(license_path.read_text(encoding="utf8").rstrip() + "\n", encoding="utf8")

def candidates_json() -> None:
    (REVIEW / "candidates.json").write_text(json.dumps([
        {"name": name, "font": f"/fonts/hands/candidates/{key}.woff2", "license": license}
        for name, (key, license) in CANDIDATES.items()
    ], ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def main() -> None:
    SOURCE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    chars = character_set()
    (OUTPUT / "charset.txt").write_text(chars + "\n", encoding="utf8")
    for key, config in FONTS.items():
        make_subset(key, config, chars)
        output = OUTPUT / f"{key}.woff2"
        print(f"{key}: {output.stat().st_size:,} bytes")
    candidates_json()
    print(f"charset: {len(chars):,} characters")


if __name__ == "__main__":
    main()
