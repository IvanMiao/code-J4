#!/usr/bin/env python3
"""Download, pin, and subset the game's OFL handwriting fonts."""

from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "fonts-src"
OUTPUT = ROOT / "public" / "fonts" / "hands"
PUNCTUATION = "。，、；：？！…—「」『』（）《》〔〕·｜"
FONTS = {
    "song": {
        "font": "NotoSerifSC[wght].ttf",
        "url": "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
        "license": "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/OFL.txt",
        "variable": True,
    },
    "kai": {
        "font": "LXGWWenKai-Regular.ttf",
        "url": "https://github.com/lxgw/LxgwWenKai/releases/latest/download/LXGWWenKai-Regular.ttf",
        "license": "https://raw.githubusercontent.com/lxgw/LxgwWenKai/main/OFL.txt",
    },
    "brush": {
        "font": "MaShanZheng-Regular.ttf",
        "url": "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf",
        "license": "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/OFL.txt",
    },
    "xing": {
        "font": "ZhiMangXing-Regular.ttf",
        "url": "https://raw.githubusercontent.com/google/fonts/main/ofl/zhimangxing/ZhiMangXing-Regular.ttf",
        "license": "https://raw.githubusercontent.com/google/fonts/main/ofl/zhimangxing/OFL.txt",
    },
    "rough": {
        "font": "LongCang-Regular.ttf",
        "url": "https://raw.githubusercontent.com/google/fonts/main/ofl/longcang/LongCang-Regular.ttf",
        "license": "https://raw.githubusercontent.com/google/fonts/main/ofl/longcang/OFL.txt",
    },
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
    download(str(config["url"]), source)
    download(str(config["license"]), license_path)

    font = TTFont(source)
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


def main() -> None:
    SOURCE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    chars = character_set()
    (OUTPUT / "charset.txt").write_text(chars + "\n", encoding="utf8")
    for key, config in FONTS.items():
        make_subset(key, config, chars)
        output = OUTPUT / f"{key}.woff2"
        print(f"{key}: {output.stat().st_size:,} bytes")
    print(f"charset: {len(chars):,} characters")


if __name__ == "__main__":
    main()
