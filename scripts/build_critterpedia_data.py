from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
SOURCE_PATH = WORKSPACE_ROOT / "nookipedia-api" / "data" / "content_full_snapshot.json"
OUTPUT_PATH = ROOT / "data" / "critters.json"

TYPE_LABELS = {
    "bugs": "곤충",
    "fish": "물고기",
    "sea": "해산물",
}

LOCATION_KO_MAP = {
    "Pier": "부두",
    "Pond": "연못",
    "River": "강",
    "River (clifftop)": "절벽 위 강",
    "River (mouth)": "강 하구",
    "Sea": "바다",
    "Sea (raining)": "바다(비 오는 날)",
    "Disguised on shoreline": "해변가 위장",
    "Disguised under trees": "나무 아래 위장",
    "Flying": "비행",
    "Flying near blue, purple, and black flowers": "파랑/보라/검정 꽃 주변 비행",
    "Flying near flowers": "꽃 주변 비행",
    "Flying near light sources": "광원 주변 비행",
    "Flying near trash or rotten turnips": "쓰레기/썩은 무 주변 비행",
    "Flying near water": "물가 주변 비행",
    "From hitting rocks": "바위 치기",
    "On beach rocks": "해변 바위",
    "On flowers": "꽃 위",
    "On palm trees": "야자수",
    "On rivers and ponds": "강/연못 주변",
    "On rocks and bushes": "바위/덤불",
    "On the ground": "지면",
    "On tree stumps": "그루터기",
    "On trees (any kind)": "나무(모든 종류)",
    "On trees (hardwood and cedar)": "활엽수/침엽수",
    "On villagers": "주민 위",
    "On white flowers": "흰 꽃 위",
    "On/near spoiled turnips/candy/lollipops": "썩은 무/사탕/막대사탕 주변",
    "Pushing snowballs": "눈덩이 굴리기",
    "Shaking non-fruit hardwood trees or cedar trees": "열매 없는 활엽수/침엽수 흔들기",
    "Shaking trees": "나무 흔들기",
    "Shaking trees (hardwood and cedar)": "활엽수/침엽수 흔들기",
    "Underground": "땅속",
}


def format_location(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    return LOCATION_KO_MAP.get(raw, raw)


def format_shadow_label(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    lowered = raw.lower()
    has_fin = "with fin" in lowered or "finned" in lowered or "등지느러미" in raw
    base = lowered.replace("with fin", "").replace("finned", "")
    base = re.sub(r"\(\d+\)", "", base)
    normalized = re.sub(r"[^a-z]", "", base)

    number_text = {
        "tiny": "1",
        "smallest": "1",
        "small": "2",
        "medium": "3",
        "large": "4",
        "largest": "5",
        "huge": "5",
        "verylarge": "5",
        "long": "long",
        "narrow": "long",
    }.get(normalized)

    if number_text:
        return f"{number_text} (등지느러미)" if has_fin else number_text

    number_match = re.search(r"\((\d+)\)", raw) or re.search(r"\b(\d+)\b", raw)
    if number_match:
        return f"{number_match.group(1)} (등지느러미)" if has_fin else number_match.group(1)
    return raw


def parse_clock(token: str) -> int:
    text = str(token or "").strip().upper()
    match = re.fullmatch(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", text)
    if not match:
        raise ValueError(f"Unsupported time token: {token}")
    hour = int(match.group(1)) % 12
    if match.group(3) == "PM":
        hour += 12
    return hour


def parse_time_ranges(value: str) -> list[str]:
    raw = str(value or "").strip()
    if not raw or raw == "NA":
        return []
    if raw == "All day":
        return ["all-day"]

    parts = re.split(r"\s*&\s*|\s*,\s*", raw)
    ranges: list[str] = []
    for part in parts:
        chunk = str(part or "").strip()
        if not chunk:
            continue
        bounds = re.split(r"\s*[–-]\s*", chunk)
        if len(bounds) != 2:
            continue
        start = parse_clock(bounds[0])
        end = parse_clock(bounds[1])
        ranges.append(f"{start}-{end}")
    return ranges


def build_region(region: dict) -> dict:
    months_array = region.get("months_array") if isinstance(region, dict) else []
    times_by_month = region.get("times_by_month") if isinstance(region, dict) else {}
    normalized_times_by_month: dict[str, str] = {}
    normalized_ranges_by_month: dict[str, list[str]] = {}

    for month in range(1, 13):
        value = str(times_by_month.get(str(month), "") or "").strip()
        normalized_times_by_month[str(month)] = value
        normalized_ranges_by_month[str(month)] = parse_time_ranges(value)

    availability_array = []
    for row in region.get("availability_array", []) if isinstance(region, dict) else []:
        if not isinstance(row, dict):
            continue
        availability_array.append(
            {
                "months": str(row.get("months") or "").strip(),
                "time": str(row.get("time") or "").strip(),
            }
        )

    time_text_parts = []
    for row in availability_array:
        months = row["months"]
        time = row["time"]
        if months and time:
            time_text_parts.append(f"{months}: {time}")
        elif time:
            time_text_parts.append(time)
        elif months:
            time_text_parts.append(months)

    return {
        "monthsText": str(region.get("months") or "").strip(),
        "timeText": " / ".join(time_text_parts),
        "monthsArray": months_array if isinstance(months_array, list) else [],
        "timesByMonth": normalized_times_by_month,
        "timeRangesByMonth": normalized_ranges_by_month,
    }


def build_item(catalog_type: str, row: dict) -> dict:
    item = row.get("item") or {}
    raw = row.get("raw") or {}
    return {
        "id": str(item.get("id") or ""),
        "type": catalog_type,
        "typeLabel": TYPE_LABELS[catalog_type],
        "number": int(item.get("number") or 0),
        "nameKo": str(item.get("name_ko") or item.get("name") or "").strip(),
        "nameEn": str(item.get("name_en") or raw.get("name") or "").strip(),
        "wikiUrl": str(item.get("url") or raw.get("url") or "").strip(),
        "iconImageUrl": str(item.get("image_url") or raw.get("image_url") or "").strip(),
        "imageUrl": str(raw.get("render_url") or item.get("image_url") or "").strip(),
        "locationKo": format_location(raw.get("location") or ""),
        "locationEn": str(raw.get("location") or "").strip(),
        "rarity": str(raw.get("rarity") or "").strip(),
        "shadowLabel": format_shadow_label(raw.get("shadow_size") or ""),
        "movementLabel": str(raw.get("shadow_movement") or "").strip(),
        "weatherLabel": str(raw.get("weather") or "").strip(),
        "sellPrice": int(raw.get("sell_nook") or 0),
        "sellBonusPrice": int(raw.get("sell_flick") or raw.get("sell_cj") or 0),
        "catchphrase": next(iter(raw.get("catchphrases") or []), ""),
        "museumPhrase": str(raw.get("museum_phrase") or raw.get("museum-phrase") or "").strip(),
        "north": build_region(raw.get("north") or {}),
        "south": build_region(raw.get("south") or {}),
    }


def main() -> None:
    payload = json.loads(SOURCE_PATH.read_text())
    catalog = payload.get("catalog") or {}
    items = []

    for catalog_type in ("bugs", "fish", "sea"):
        rows = ((catalog.get(catalog_type) or {}).get("items")) or []
        for row in rows:
            built = build_item(catalog_type, row)
            if built["id"]:
                items.append(built)

    items.sort(key=lambda item: (item["type"], item["number"], item["nameKo"]))

    OUTPUT_PATH.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(UTC).isoformat(),
                "count": len(items),
                "items": items,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )

    print(f"Wrote {len(items)} critters to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
