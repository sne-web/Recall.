from services.transcript_parser import parse_transcript, extract_speakers

VTT = """WEBVTT

NOTE recorded on zoom

1
00:00:00.000 --> 00:00:08.000
Alex: Good morning everyone.

2
00:00:08.000 --> 00:00:12.000
Alex: Let's review the roadmap.

00:00:12.000 --> 00:00:18.000
<v Priya>Offline mode is the top request.</v>
"""


def test_vtt_strips_structure_and_merges_consecutive_speaker_cues():
    text = parse_transcript(VTT, ".vtt")
    assert text == (
        "Alex: Good morning everyone. Let's review the roadmap.\n\n"
        "Priya: Offline mode is the top request."
    )


def test_vtt_timestamps_are_not_detected_as_speakers():
    # The old splitter took everything before the first ":" — so "00" became a speaker.
    assert extract_speakers(parse_transcript(VTT, ".vtt")) == ["Alex", "Priya"]


def test_txt_speakers_in_order_of_first_appearance():
    text = "John: Hi.\nSarah: Hello.\nJohn: Let's start.\nDr. Patel: Agreed."
    assert extract_speakers(text) == ["John", "Sarah", "Dr. Patel"]


def test_txt_ignores_metadata_labels_and_handles_leading_timestamps():
    text = "Agenda: roadmap\nDate: Monday\n[00:01:02] Ben: Six weeks.\n00:05 Speaker 2: Fine."
    assert extract_speakers(text) == ["Ben", "Speaker 2"]


def test_txt_normalises_line_endings_and_bom():
    assert parse_transcript("﻿A: one\r\nB: two\r\n", ".txt") == "A: one\nB: two"


def test_vtt_with_doubled_carriage_returns():
    raw = "WEBVTT\r\r\n\r\r\n00:00:00.000 --> 00:00:08.000\r\r\nAlex: Morning.\r\r\n"
    assert parse_transcript(raw, ".vtt") == "Alex: Morning."
