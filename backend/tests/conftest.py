"""
Shared fixtures. Supabase, Groq and the vector store are all faked, so the suite
runs offline and never touches real user data.
"""
import os
import sys
from types import SimpleNamespace

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402
from routers.auth import get_current_user, get_user_db  # noqa: E402

USER_ID = "11111111-1111-1111-1111-111111111111"


class FakeQuery:
    """Minimal stand-in for supabase-py's chained query builder."""

    def __init__(self, db, table):
        self.db, self.table = db, table
        self.op, self.payload, self.filters = "select", None, []

    def select(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def insert(self, rows):
        self.op, self.payload = "insert", rows if isinstance(rows, list) else [rows]
        return self

    def update(self, values):
        self.op, self.payload = "update", values
        return self

    def delete(self):
        self.op = "delete"
        return self

    def _matches(self, row):
        return all(str(row.get(c)) == str(v) for c, v in self.filters)

    def execute(self):
        rows = self.db.tables.setdefault(self.table, [])
        if self.op == "insert":
            inserted = [{"upload_date": "2026-01-01T00:00:00+00:00", **r} for r in self.payload]
            rows.extend(inserted)
            return SimpleNamespace(data=inserted)
        matched = [r for r in rows if self._matches(r)]
        if self.op == "update":
            for r in matched:
                r.update(self.payload)
        elif self.op == "delete":
            self.db.tables[self.table] = [r for r in rows if not self._matches(r)]
        return SimpleNamespace(data=[dict(r) for r in matched])


class FakeDB:
    def __init__(self):
        self.tables = {}

    def table(self, name):
        return FakeQuery(self, name)


@pytest.fixture
def db():
    return FakeDB()


@pytest.fixture
def client(db, monkeypatch):
    user = SimpleNamespace(id=USER_ID, email="test@example.com", user_metadata={"full_name": "Test"})
    main.app.dependency_overrides[get_current_user] = lambda: user
    main.app.dependency_overrides[get_user_db] = lambda: db

    # Keep the real on-disk Chroma store out of tests.
    import routers.analysis, routers.transcripts
    monkeypatch.setattr(routers.analysis, "index_transcript", lambda *_: 1)
    monkeypatch.setattr(routers.transcripts, "delete_index", lambda *_: None)

    yield TestClient(main.app, headers={"Authorization": "Bearer test-token"})
    main.app.dependency_overrides.clear()


@pytest.fixture
def meeting(db):
    row = {
        "id": "22222222-2222-2222-2222-222222222222",
        "user_id": USER_ID,
        "filename": "standup & sync.txt",
        "upload_date": "2026-01-01T00:00:00+00:00",
        "status": "uploaded",
        "word_count": 12,
        "speakers": ["Sarah", "Mike"],
        "transcript_text": "Sarah: Let's ship Friday.\n\nMike: I'll write the <release> notes.",
        "analysis_results": None,
    }
    db.tables["meetings"] = [row]
    return row
