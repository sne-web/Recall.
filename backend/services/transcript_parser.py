import re

# "00:00:08.000 --> 00:00:18.000" (hours optional, "," allowed as in SRT)
VTT_TIMESTAMP = re.compile(r"^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->")
# WebVTT voice span: "<v Sarah>Hello" or "<v.loud Sarah>Hello</v>"
VTT_VOICE = re.compile(r"<v(?:\.[^\s>]*)?\s+([^>]+)>")
HTML_TAG = re.compile(r"</?[^>]+>")
# Optional leading "[00:01:02]" / "00:01" timestamp on plain-text transcript lines
LEADING_TIMESTAMP = re.compile(r"^\s*\[?\(?(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d+)?\]?\)?\s*[-–]?\s*")
# "Sarah:", "Dr. Patel:", "Speaker 2:" — up to 4 words, each starting with a capital or a number
SPEAKER_PREFIX = re.compile(r"^((?:[A-Z][\w.'\-]*|\d+)(?: (?:[A-Z][\w.'\-]*|\d+)){0,3})\s*:\s*\S")

# Capitalised labels that look like speakers but are usually transcript metadata
NOT_SPEAKERS = {
    "Note", "Notes", "Agenda", "Date", "Time", "Subject", "Attendees", "Participants",
    "Location", "Meeting", "Summary", "Action", "Action Item", "Action Items",
    "Decision", "Decisions", "Topic", "Re", "Http", "Https", "Transcript",
}


def parse_transcript(raw: str, extension: str) -> str:
    """Normalises an uploaded file into plain 'Speaker: text' lines."""
    # "\r+\n" also catches "\r\r\n", produced when a CRLF file is re-saved by a Windows tool
    text = re.sub(r"\r+\n|\r", "\n", raw).lstrip("﻿")
    if extension == ".vtt":
        return parse_vtt(text)
    return text.strip()


def parse_vtt(text: str) -> str:
    """
    Strips WebVTT structure (header, cue ids, timestamps, NOTE/STYLE blocks, markup)
    and merges consecutive cues from the same speaker into one line.

    Works line by line rather than splitting on blank lines, because exported files
    are often double-spaced (blank line between a timestamp and its text).
    """
    lines = [l.strip() for l in text.split("\n")]

    def next_nonempty(i):
        return next((l for l in lines[i + 1:] if l), "")

    cues = []          # one list of payload lines per cue
    in_cue = False     # False while in the header or a NOTE/STYLE/REGION block
    for i, line in enumerate(lines):
        if VTT_TIMESTAMP.match(line):
            cues.append([])
            in_cue = True
        elif not line:
            continue
        elif line.split(" ")[0] in {"WEBVTT", "NOTE", "STYLE", "REGION"}:
            in_cue = False
        elif (i + 1 < len(lines) and VTT_TIMESTAMP.match(lines[i + 1])) or (
            line.isdigit() and VTT_TIMESTAMP.match(next_nonempty(i))
        ):
            continue  # cue identifier
        elif in_cue:
            cues[-1].append(line)

    lines_out = []
    last_speaker = None
    for cue in cues:
        payload = " ".join(cue)
        if not payload:
            continue

        voice = VTT_VOICE.search(payload)
        speaker = voice.group(1).strip() if voice else None
        content = HTML_TAG.sub("", payload).strip()

        if not speaker:
            match = SPEAKER_PREFIX.match(content)
            if match:
                speaker = match.group(1)
                content = content[len(speaker):].lstrip(" :")

        if speaker and speaker == last_speaker and lines_out:
            lines_out[-1] += " " + content
        else:
            lines_out.append(f"{speaker}: {content}" if speaker else content)
        last_speaker = speaker

    return "\n\n".join(lines_out)


def extract_speakers(text: str) -> list[str]:
    """Returns speaker names in order of first appearance."""
    speakers = []
    for line in text.split("\n"):
        line = LEADING_TIMESTAMP.sub("", line)
        match = SPEAKER_PREFIX.match(line)
        if not match:
            continue
        name = match.group(1).strip()
        if name not in NOT_SPEAKERS and name not in speakers:
            speakers.append(name)
    return speakers
