#!/usr/bin/env python3
"""Render the QualCanvas launch video library from series.json.

The script deliberately keeps generated masters and audio outside version control.
It produces reviewable scripts, upload metadata, subtitles, thumbnails and channel
artwork alongside 1080p H.264/AAC masters.
"""

from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SERIES = json.loads((ROOT / "series.json").read_text(encoding="utf-8"))
WORK = ROOT / "production" / ".work"
CAPTURES = ROOT / "captures"
VIDEOS = ROOT / "videos"
AUDIO = ROOT / "audio"
SUBTITLES = ROOT / "subtitles"
THUMBNAILS = ROOT / "thumbnails"
SCRIPTS = ROOT / "scripts"
METADATA = ROOT / "metadata"
BRANDING = ROOT / "branding"

WIDTH, HEIGHT = 1920, 1080
TRANSITION = 0.35
TAIL = 0.75

INK = "#0B1530"
PAPER = "#F7F5EF"
OCHRE = "#C59128"
INDIGO = "#6768C8"
MUTED = "#C7CBD8"


def run(args: list[str], *, quiet: bool = False) -> str:
    if not quiet:
        print("  $", " ".join(args[:6]), "..." if len(args) > 6 else "", flush=True)
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise SystemExit(result.returncode)
    return result.stdout.strip()


def ensure_tools() -> None:
    for tool in ("ffmpeg", "ffprobe", "edge-tts"):
        if not shutil.which(tool):
            raise SystemExit(f"Required command is missing: {tool}")


def font(size: int, *, serif: bool = False, bold: bool = False) -> ImageFont.FreeTypeFont:
    windir = Path("C:/Windows/Fonts")
    candidates = (
        (["georgiab.ttf", "Georgia Bold.ttf"] if bold else ["georgia.ttf"])
        if serif
        else (["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"])
    )
    for candidate in candidates:
        path = windir / candidate
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def hex_rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def fit_cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_ratio = size[0] / size[1]
    ratio = image.width / image.height
    if ratio > target_ratio:
        width = round(image.height * target_ratio)
        left = (image.width - width) // 2
        image = image.crop((left, 0, left + width, image.height))
    else:
        height = round(image.width / target_ratio)
        top = (image.height - height) // 2
        image = image.crop((0, top, image.width, top + height))
    return image.resize(size, Image.Resampling.LANCZOS)


def rounded_image(image: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width, image.height), radius=radius, fill=255)
    result = Image.new("RGBA", image.size)
    result.paste(image.convert("RGBA"), mask=mask)
    return result


def wrap(draw: ImageDraw.ImageDraw, text: str, chosen_font: ImageFont.ImageFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=chosen_font)[2] <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_logo(canvas: Image.Image, centre: tuple[int, int], size: int, *, with_word: bool = False) -> None:
    draw = ImageDraw.Draw(canvas, "RGBA")
    x, y = centre
    radius = size // 2
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=hex_rgba(PAPER, 238))
    draw.ellipse((x - radius + 7, y - radius + 7, x + radius - 7, y + radius - 7), outline=hex_rgba(OCHRE), width=max(4, size // 18))
    draw.arc((x - radius // 2, y - radius // 2, x + radius // 2, y + radius // 2), 35, 325, fill=hex_rgba(INK), width=max(5, size // 15))
    draw.line((x + size * 0.10, y + size * 0.10, x + size * 0.29, y + size * 0.29), fill=hex_rgba(INK), width=max(5, size // 15))
    for dx, dy, colour in ((-0.25, -0.18, INDIGO), (0.22, -0.17, OCHRE), (-0.16, 0.25, OCHRE)):
        nr = max(4, size // 20)
        nx, ny = x + int(dx * size), y + int(dy * size)
        draw.ellipse((nx - nr, ny - nr, nx + nr, ny + nr), fill=hex_rgba(colour))
    if with_word:
        draw.text((x + radius + 22, y), "QualCanvas", font=font(size // 2, serif=True, bold=True), fill=hex_rgba(PAPER), anchor="lm")


def background() -> Image.Image:
    source = Image.open(BRANDING / "qualcanvas-channel-background.png").convert("RGB")
    return fit_cover(source, (WIDTH, HEIGHT))


def render_brand_frame(scene: dict, category: str) -> Image.Image:
    canvas = background().convert("RGBA")
    shade = Image.new("RGBA", canvas.size, hex_rgba(INK, 164))
    canvas = Image.alpha_composite(canvas, shade)
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rounded_rectangle((105, 100, 1815, 980), radius=42, fill=hex_rgba(INK, 208), outline=hex_rgba(PAPER, 42), width=2)
    draw_logo(canvas, (195, 190), 92)
    draw.text((270, 190), f"QUALCANVAS  /  {category.upper()}", font=font(28, bold=True), fill=hex_rgba(OCHRE), anchor="lm")

    title_font = font(78, serif=True, bold=True)
    title_lines = wrap(draw, scene["title"], title_font, 1440)
    title_y = 325
    for line in title_lines[:3]:
        draw.text((190, title_y), line, font=title_font, fill=hex_rgba(PAPER))
        title_y += 94

    draw.line((190, title_y + 28, 520, title_y + 28), fill=hex_rgba(OCHRE), width=6)
    callout_font = font(38)
    for line in wrap(draw, scene["callout"], callout_font, 1450)[:3]:
        title_y += 62
        draw.text((190, title_y), line, font=callout_font, fill=hex_rgba(MUTED))

    draw.text((190, 913), "Research reasoning, kept visible", font=font(24, bold=True), fill=hex_rgba(PAPER, 220))
    draw.text((1730, 913), "qualcanvas.com", font=font(24, bold=True), fill=hex_rgba(OCHRE), anchor="ra")
    return canvas.convert("RGB")


def render_ui_frame(scene: dict, category: str) -> Image.Image:
    screenshot = Image.open(ROOT / scene["source"]).convert("RGB")
    backdrop = fit_cover(screenshot, (WIDTH, HEIGHT)).filter(ImageFilter.GaussianBlur(26))
    backdrop = ImageEnhance.Brightness(backdrop).enhance(0.36).convert("RGBA")
    canvas = Image.alpha_composite(backdrop, Image.new("RGBA", (WIDTH, HEIGHT), hex_rgba(INK, 80)))

    shot = fit_cover(screenshot, (1600, 900))
    shadow = Image.new("RGBA", (1640, 940), (0, 0, 0, 0))
    ImageDraw.Draw(shadow, "RGBA").rounded_rectangle((20, 20, 1620, 920), radius=30, fill=(0, 0, 0, 130))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    canvas.alpha_composite(shadow, (140, 92))
    canvas.alpha_composite(rounded_image(shot, 26), (160, 112))

    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    draw.rectangle((0, 0, WIDTH, 137), fill=hex_rgba(INK, 244))
    draw.rectangle((0, 874, WIDTH, HEIGHT), fill=hex_rgba(INK, 238))
    draw_logo(overlay, (78, 68), 66)
    draw.text((132, 42), category.upper(), font=font(19, bold=True), fill=hex_rgba(OCHRE))
    draw.text((132, 71), scene["title"], font=font(42, serif=True, bold=True), fill=hex_rgba(PAPER))
    draw.line((160, 910, 160, 1034), fill=hex_rgba(OCHRE), width=7)
    callout_font = font(36, bold=True)
    y = 905
    for line in wrap(draw, scene["callout"], callout_font, 1560)[:3]:
        draw.text((205, y), line, font=callout_font, fill=hex_rgba(PAPER))
        y += 48
    draw.text((1790, 1032), "qualcanvas.com", font=font(21, bold=True), fill=hex_rgba(MUTED), anchor="ra")
    return Image.alpha_composite(canvas, overlay).convert("RGB")


def render_thumbnail(video: dict) -> None:
    source = next((scene.get("source") for scene in video["scenes"] if scene.get("source")), None)
    image = fit_cover(Image.open(ROOT / source).convert("RGB") if source else background(), (1280, 720))
    image = ImageEnhance.Brightness(image).enhance(0.50).convert("RGBA")
    gradient = Image.new("RGBA", image.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(gradient, "RGBA")
    for x in range(900):
        gd.line((x, 0, x, 720), fill=hex_rgba(INK, round(244 * (1 - x / 1050))))
    image = Image.alpha_composite(image, gradient)
    draw = ImageDraw.Draw(image, "RGBA")
    draw_logo(image, (105, 91), 88)
    draw.text((170, 90), "QUALCANVAS", font=font(27, bold=True), fill=hex_rgba(PAPER), anchor="lm")
    draw.rounded_rectangle((65, 166, 820, 610), radius=34, fill=hex_rgba(INK, 222), outline=hex_rgba(PAPER, 40), width=2)
    draw.text((108, 210), f"{int(video['id']):02d}", font=font(31, bold=True), fill=hex_rgba(OCHRE))
    thumb_font = font(60, serif=True, bold=True)
    y = 270
    for line in wrap(draw, video["thumbnail"], thumb_font, 650)[:4]:
        draw.text((108, y), line, font=thumb_font, fill=hex_rgba(PAPER))
        y += 72
    draw.rounded_rectangle((1010, 535, 1210, 625), radius=45, fill=hex_rgba(OCHRE))
    draw.polygon(((1090, 557), (1090, 604), (1134, 580)), fill=hex_rgba(INK))
    image.convert("RGB").save(THUMBNAILS / f"{video['id']}-{video['slug']}.jpg", quality=94, optimize=True)


def render_channel_art() -> None:
    # Profile image
    avatar = fit_cover(background(), (800, 800)).convert("RGBA")
    avatar = Image.alpha_composite(avatar, Image.new("RGBA", avatar.size, hex_rgba(INK, 145)))
    draw_logo(avatar, (400, 400), 460)
    avatar.convert("RGB").save(BRANDING / "qualcanvas-profile.jpg", quality=95)

    # Watermark
    watermark = Image.new("RGBA", (150, 150), (0, 0, 0, 0))
    draw_logo(watermark, (75, 75), 134)
    watermark.save(BRANDING / "qualcanvas-video-watermark.png")

    # YouTube desktop, television and mobile safe banner.
    banner = fit_cover(background(), (2560, 1440)).convert("RGBA")
    banner = Image.alpha_composite(banner, Image.new("RGBA", banner.size, hex_rgba(INK, 150)))
    bd = ImageDraw.Draw(banner, "RGBA")
    bd.rounded_rectangle((507, 509, 2053, 932), radius=34, fill=hex_rgba(INK, 205), outline=hex_rgba(PAPER, 34), width=2)
    draw_logo(banner, (770, 720), 210)
    bd.text((930, 660), "QualCanvas", font=font(104, serif=True, bold=True), fill=hex_rgba(PAPER))
    bd.text((935, 790), "Visual qualitative analysis you can explain", font=font(39), fill=hex_rgba(MUTED))
    banner.convert("RGB").save(BRANDING / "qualcanvas-channel-banner.jpg", quality=94, optimize=True)


def probe_duration(path: Path) -> float:
    value = run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], quiet=True)
    return float(value)


def timestamp(seconds: float, *, srt: bool = False) -> str:
    seconds = max(0, seconds)
    whole = int(seconds)
    millis = round((seconds - whole) * 1000)
    if millis == 1000:
        whole += 1
        millis = 0
    hours, remainder = divmod(whole, 3600)
    minutes, secs = divmod(remainder, 60)
    if srt:
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
    return f"{minutes + hours * 60}:{secs:02d}"


def subtitle_chunks(text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks: list[str] = []
    for sentence in sentences:
        words = sentence.split()
        if len(words) <= 12:
            chunks.append(sentence)
            continue
        for index in range(0, len(words), 10):
            chunks.append(" ".join(words[index : index + 10]))
    return [chunk for chunk in chunks if chunk]


def write_srt(video: dict, raw_durations: list[float], scene_durations: list[float]) -> None:
    entries: list[tuple[float, float, str]] = []
    start = 0.0
    for index, scene in enumerate(video["scenes"]):
        chunks = subtitle_chunks(scene["narration"])
        weights = [max(1, len(chunk.split())) for chunk in chunks]
        usable = max(1.0, raw_durations[index])
        position = start + 0.08
        for chunk, weight in zip(chunks, weights):
            length = usable * weight / sum(weights)
            entries.append((position, position + length, chunk))
            position += length
        start += scene_durations[index] - (TRANSITION if index < len(video["scenes"]) - 1 else 0)

    lines: list[str] = []
    for index, (start, end, words) in enumerate(entries, 1):
        lines.extend([str(index), f"{timestamp(start, srt=True)} --> {timestamp(end, srt=True)}", words, ""])
    (SUBTITLES / f"{video['id']}-{video['slug']}.en-IE.srt").write_text("\n".join(lines), encoding="utf-8")


def write_script_and_metadata(video: dict, scene_durations: list[float]) -> None:
    script_lines = [
        f"# {video['title']}", "", f"**Outcome:** {video['outcome']}", "",
        f"**Audience:** {SERIES['audience']}  ", f"**Language:** {SERIES['language']}  ",
        f"**Voice:** {SERIES['voice']}", "", "## Scene plan", "",
    ]
    elapsed = 0.0
    chapters: list[str] = []
    for index, (scene, duration) in enumerate(zip(video["scenes"], scene_durations), 1):
        chapters.append(f"{timestamp(elapsed)} {scene['title']}")
        script_lines.extend([
            f"### {index}. {scene['title']} ({timestamp(elapsed)})", "",
            f"- Visual: {scene.get('source', 'Original QualCanvas brand frame')}",
            f"- On-screen callout: {scene['callout']}",
            f"- Narration: {scene['narration']}", "",
        ])
        elapsed += duration - (TRANSITION if index < len(video["scenes"]) else 0)
    script_lines.extend(["## Call to action", "", "Visit https://qualcanvas.com/training and start with one approved transcript.", ""])
    (SCRIPTS / f"{video['id']}-{video['slug']}.md").write_text("\n".join(script_lines), encoding="utf-8")

    description = [
        video["outcome"], "",
        "QualCanvas keeps transcripts, codes, memos and analysis views connected in a visual workspace, so the reasoning behind a qualitative interpretation remains reviewable.", "",
        "Start QualCanvas: https://qualcanvas.com", "Training centre: https://qualcanvas.com/training",
        "Complete guide: https://qualcanvas.com/guide", "AI use and privacy: https://qualcanvas.com/trust/ai", "", "CHAPTERS", *chapters, "",
        "This demonstration uses fictional, synthetic research material. Always follow your consent terms, ethics approval and institutional policy when working with real participant data.", "",
        "#QualCanvas #QualitativeResearch #ResearchMethods", "", "TAGS", ", ".join(video["tags"]), "",
        "UPLOAD SETTINGS", f"Language: {SERIES['language']}", f"Audience: {SERIES['audience']}",
        f"Visibility after QA: {SERIES['visibility']}", f"Category: {video['category']}",
        f"Subtitle file: subtitles/{video['id']}-{video['slug']}.en-IE.srt",
        f"Thumbnail: thumbnails/{video['id']}-{video['slug']}.jpg", "",
    ]
    (METADATA / f"{video['id']}-{video['slug']}.txt").write_text(
        f"TITLE\n{video['title']}\n\nDESCRIPTION\n" + "\n".join(description), encoding="utf-8"
    )


def synthesize(scene: dict, output: Path) -> tuple[float, float]:
    raw = output.with_suffix(".raw.mp3")
    if not raw.exists() or raw.stat().st_size == 0:
        raw.unlink(missing_ok=True)
        for attempt in range(3):
            try:
                run(["edge-tts", "--voice", SERIES["voice"], "--text", scene["narration"], "--write-media", str(raw)])
                if raw.exists() and raw.stat().st_size > 0:
                    break
            except SystemExit:
                raw.unlink(missing_ok=True)
                if attempt == 2:
                    raise
    raw_duration = probe_duration(raw)
    scene_duration = raw_duration + TAIL
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(raw),
        "-af", f"loudnorm=I=-16:TP=-1.5:LRA=9,apad=pad_dur={TAIL}",
        "-t", f"{scene_duration:.3f}", "-ar", "48000", "-ac", "2", str(output),
    ], quiet=True)
    return raw_duration, scene_duration


def render_video(video: dict) -> None:
    print(f"\n[{video['id']}/{len(SERIES['videos'])}] {video['title']}", flush=True)
    video_work = WORK / video["id"]
    video_work.mkdir(parents=True, exist_ok=True)
    raw_durations: list[float] = []
    scene_durations: list[float] = []
    inputs: list[str] = []
    video_filters: list[str] = []
    audio_labels: list[str] = []

    for index, scene in enumerate(video["scenes"]):
        frame_path = video_work / f"scene-{index + 1:02d}.png"
        wav_path = AUDIO / f"{video['id']}-scene-{index + 1:02d}.wav"
        frame = render_brand_frame(scene, video["category"]) if scene["kind"] == "brand" else render_ui_frame(scene, video["category"])
        frame.save(frame_path, optimize=True)
        raw_duration, scene_duration = synthesize(scene, wav_path)
        raw_durations.append(raw_duration)
        scene_durations.append(scene_duration)

        input_number = index * 2
        inputs.extend(["-loop", "1", "-t", f"{scene_duration:.3f}", "-i", str(frame_path), "-i", str(wav_path)])
        video_filters.append(
            f"[{input_number}:v]fps=30,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[v{index}]"
        )
        audio_labels.append(f"[{input_number + 1}:a]")

    video_label = "[v0]"
    elapsed = scene_durations[0]
    for index in range(1, len(scene_durations)):
        output_label = f"[vx{index}]"
        offset = elapsed - TRANSITION * index
        video_filters.append(
            f"{video_label}[v{index}]xfade=transition=fade:duration={TRANSITION}:offset={offset:.3f}{output_label}"
        )
        video_label = output_label
        elapsed += scene_durations[index]

    audio_label = audio_labels[0]
    for index in range(1, len(audio_labels)):
        output_label = f"[ax{index}]"
        video_filters.append(f"{audio_label}{audio_labels[index]}acrossfade=d={TRANSITION}:c1=tri:c2=tri{output_label}")
        audio_label = output_label

    output_path = VIDEOS / video["filename"]
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *inputs,
        "-filter_complex", ";".join(video_filters), "-map", video_label, "-map", audio_label,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-shortest", str(output_path),
    ])
    write_srt(video, raw_durations, scene_durations)
    write_script_and_metadata(video, scene_durations)
    render_thumbnail(video)
    print(f"  rendered {output_path.name} ({timestamp(probe_duration(output_path))})", flush=True)


def main() -> None:
    ensure_tools()
    for directory in (WORK, VIDEOS, AUDIO, SUBTITLES, THUMBNAILS, SCRIPTS, METADATA, BRANDING):
        directory.mkdir(parents=True, exist_ok=True)
    render_channel_art()
    selected = set(sys.argv[1:])
    videos = [video for video in SERIES["videos"] if not selected or video["id"] in selected or video["slug"] in selected]
    if selected and not videos:
        raise SystemExit(f"No video matched: {', '.join(sorted(selected))}")
    for video in videos:
        render_video(video)
    print("\nAll QualCanvas launch videos rendered.", flush=True)


if __name__ == "__main__":
    main()
