#!/usr/bin/env python3
"""Validate QualCanvas masters and generate visual-inspection contact sheets."""

from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[1]
SERIES = json.loads((ROOT / "series.json").read_text(encoding="utf-8"))
VIDEOS = ROOT / "videos"
THUMBNAILS = ROOT / "thumbnails"
SUBTITLES = ROOT / "subtitles"
QA = ROOT / "qa"
FRAMES = QA / "frames"
CONTACTS = QA / "contact-sheets"


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=ROOT, text=True, capture_output=True)


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    path = Path("C:/Windows/Fonts") / name
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def probe(path: Path) -> dict:
    result = run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size,bit_rate:stream=index,codec_name,codec_type,width,height,pix_fmt,sample_rate,channels",
        "-of", "json", str(path),
    ])
    if result.returncode:
        raise RuntimeError(result.stderr)
    return json.loads(result.stdout)


def loudness(path: Path) -> tuple[float | None, float | None]:
    result = run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a:0",
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-",
    ])
    match_i = re.search(r'"input_i"\s*:\s*"?(-?[\d.]+)', result.stderr)
    match_tp = re.search(r'"input_tp"\s*:\s*"?(-?[\d.]+)', result.stderr)
    return (float(match_i.group(1)) if match_i else None, float(match_tp.group(1)) if match_tp else None)


def black_segments(path: Path) -> list[str]:
    result = run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-vf", "blackdetect=d=0.75:pic_th=0.98:pix_th=0.10", "-an", "-f", "null", "-",
    ])
    return re.findall(r"black_start:[^\r\n]+", result.stderr)


def subtitle_bounds(path: Path, duration: float) -> tuple[bool, str]:
    content = path.read_text(encoding="utf-8-sig")
    matches = re.findall(
        r"(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})",
        content,
    )
    if not matches:
        return False, "No subtitle cues"
    previous_end = 0.0
    for cue in matches:
        values = [int(value) for value in cue]
        start = values[0] * 3600 + values[1] * 60 + values[2] + values[3] / 1000
        end = values[4] * 3600 + values[5] * 60 + values[6] + values[7] / 1000
        if start < previous_end - 0.02 or end <= start or end > duration + 0.25:
            return False, f"Invalid cue {start:.3f}–{end:.3f} for {duration:.3f}s master"
        previous_end = end
    return True, f"{len(matches)} timed cues"


def extract_frame(video: Path, timestamp: float, output: Path) -> None:
    result = run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{timestamp:.3f}",
        "-i", str(video), "-frames:v", "1", "-q:v", "2", str(output),
    ])
    if result.returncode:
        raise RuntimeError(result.stderr)


def build_contact_sheet(items: list[dict], group_number: int) -> Path:
    sheet = Image.new("RGB", (1500, len(items) * 295 + 70), "#0B1530")
    draw = ImageDraw.Draw(sheet)
    draw.text((35, 22), f"QualCanvas masters — visual QA {group_number}", font=font(28, bold=True), fill="#F7F5EF")
    for row, item in enumerate(items):
        y = 70 + row * 295
        draw.text((35, y + 6), f"{item['id']}. {item['shortTitle']}", font=font(21, bold=True), fill="#C59128")
        for column, label in enumerate(("BEGIN", "MIDDLE", "END")):
            frame = Image.open(item["frames"][column]).convert("RGB")
            frame.thumbnail((450, 253), Image.Resampling.LANCZOS)
            x = 35 + column * 485
            sheet.paste(frame, (x, y + 40))
            draw.rectangle((x, y + 40, x + frame.width, y + 40 + frame.height), outline="#C7CBD8", width=1)
            draw.rectangle((x + 8, y + 48, x + 97, y + 78), fill="#0B1530")
            draw.text((x + 16, y + 51), label, font=font(15, bold=True), fill="#F7F5EF")
    output = CONTACTS / f"contact-sheet-{group_number}.jpg"
    sheet.save(output, quality=91, optimize=True)
    return output


def main() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    CONTACTS.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []
    visual_items: list[dict] = []

    for video in SERIES["videos"]:
        master = VIDEOS / video["filename"]
        subtitle = SUBTITLES / f"{video['id']}-{video['slug']}.en-IE.srt"
        thumbnail = THUMBNAILS / f"{video['id']}-{video['slug']}.jpg"
        errors: list[str] = []
        warnings: list[str] = []
        info = probe(master)
        duration = float(info["format"]["duration"])
        streams = info["streams"]
        video_stream = next((stream for stream in streams if stream.get("codec_type") == "video"), {})
        audio_stream = next((stream for stream in streams if stream.get("codec_type") == "audio"), {})
        if video_stream.get("codec_name") != "h264": errors.append("Video codec is not H.264")
        if (video_stream.get("width"), video_stream.get("height")) != (1920, 1080): errors.append("Master is not 1920×1080")
        if video_stream.get("pix_fmt") != "yuv420p": errors.append("Pixel format is not yuv420p")
        if audio_stream.get("codec_name") != "aac": errors.append("Audio codec is not AAC")
        if audio_stream.get("sample_rate") != "48000": errors.append("Audio sample rate is not 48 kHz")
        if audio_stream.get("channels") != 2: errors.append("Audio is not stereo")

        integrated, peak = loudness(master)
        if integrated is None: errors.append("Could not measure integrated loudness")
        elif not -18.0 <= integrated <= -14.0: warnings.append(f"Integrated loudness {integrated:.1f} LUFS is outside −16±2")
        if peak is None: errors.append("Could not measure true peak")
        elif peak > -1.0: errors.append(f"True peak is too high: {peak:.1f} dBTP")

        blacks = black_segments(master)
        if blacks: errors.append(f"Detected black segment(s): {'; '.join(blacks)}")

        subtitle_ok, subtitle_note = subtitle_bounds(subtitle, duration)
        if not subtitle_ok: errors.append(subtitle_note)
        with Image.open(thumbnail) as thumb:
            if thumb.size != (1280, 720): errors.append(f"Thumbnail is {thumb.size}, not 1280×720")

        points = (min(2.0, duration * 0.1), duration / 2, max(0.1, duration - 3.0))
        frame_paths: list[Path] = []
        frame_brightness: list[float] = []
        for label, point in zip(("begin", "middle", "end"), points):
            frame_path = FRAMES / f"{video['id']}-{label}.jpg"
            extract_frame(master, point, frame_path)
            frame_paths.append(frame_path)
            with Image.open(frame_path).convert("L") as frame:
                frame_brightness.append(ImageStat.Stat(frame).mean[0])
        if min(frame_brightness) < 10: errors.append("A sampled frame is effectively blank")

        record = {
            "id": video["id"], "title": video["title"], "file": video["filename"],
            "durationSeconds": round(duration, 3), "codec": video_stream.get("codec_name"),
            "resolution": f"{video_stream.get('width')}x{video_stream.get('height')}",
            "audioCodec": audio_stream.get("codec_name"), "sampleRate": audio_stream.get("sample_rate"),
            "integratedLufs": integrated, "truePeakDbtp": peak, "blackSegments": blacks,
            "subtitleStatus": subtitle_note, "sampleBrightness": [round(value, 1) for value in frame_brightness],
            "errors": errors, "warnings": warnings, "status": "PASS" if not errors else "FAIL",
        }
        records.append(record)
        visual_items.append({"id": video["id"], "shortTitle": video["shortTitle"], "frames": frame_paths})
        print(f"{record['status']} {video['id']} {duration:.1f}s {integrated} LUFS {peak} dBTP")

    contacts = [build_contact_sheet(visual_items[index : index + 4], index // 4 + 1) for index in range(0, len(visual_items), 4)]
    passed = all(record["status"] == "PASS" for record in records)
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(), "overallStatus": "PASS" if passed else "FAIL",
        "masterCount": len(records), "contactSheets": [str(path.relative_to(ROOT)).replace("\\", "/") for path in contacts],
        "records": records,
    }
    (QA / "media-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    lines = [
        "# QualCanvas media QA report", "", f"**Overall status:** {report['overallStatus']}",
        f"**Masters checked:** {len(records)}", f"**Generated:** {report['generatedAt']}", "",
        "Automated checks cover codec, dimensions, pixel format, audio format, loudness, true peak, black frames, subtitle bounds and thumbnail dimensions. Beginning, middle and end frames were extracted for mandatory visual review.", "",
        "| # | Duration | Video | Audio | Loudness | Subtitles | Result |", "|---:|---:|---|---|---:|---|---|",
    ]
    for record in records:
        lines.append(
            f"| {record['id']} | {record['durationSeconds']:.1f}s | {record['codec']} {record['resolution']} | {record['audioCodec']} {record['sampleRate']} Hz | {record['integratedLufs']} LUFS / {record['truePeakDbtp']} dBTP | {record['subtitleStatus']} | {record['status']} |"
        )
        for issue in record["errors"] + record["warnings"]:
            lines.append(f"\n- {record['id']}: {issue}")
    lines.extend(["", "## Visual inspection", "", *[f"- `{path.relative_to(ROOT).as_posix()}`" for path in contacts], ""])
    (QA / "media-report.md").write_text("\n".join(lines), encoding="utf-8")
    raise SystemExit(0 if passed else 1)


if __name__ == "__main__":
    main()
