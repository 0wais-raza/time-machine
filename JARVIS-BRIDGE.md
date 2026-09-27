# J.A.R.V.I.S. Bridge Protocol

**Who talks to whom**

```
┌──────────────────────┐        HTTP (2s poll)        ┌──────────────────────┐
│  Chronos Vizier GUI  │ ───────────────────────────► │  YOUR Python JARVIS  │
│  (this dashboard —   │  GET  /jarvis/sync?since=N   │  core (your code,    │
│   localhost OR the   │  POST /jarvis/ack            │  your disk, your     │
│   Vercel deploy)     │  POST /jarvis/journal        │  rules)              │
└──────────────────────┘                              └──────────────────────┘
```

The **browser is the client**, Python is the server. No Vercel server code, no
cloud keys, no database. The dashboard works whether it's served from
`localhost` or `https://cyber-timemachine.vercel.app` — because browsers treat
`http://127.0.0.1` / `http://localhost` as *potentially trustworthy origins*
(secure-context spec), so the HTTPS page may call your local HTTP server.

---

## 1. Endpoints your Python server implements

All requests carry:

```
Authorization: Bearer <pairing key>
```

The pairing key is generated in **System Core → J.A.R.V.I.S. Bridge** (eye icon
to reveal, refresh icon to regenerate). Reject anything else with `401`.

### GET /jarvis/sync?since=\<lastSeq\>

Response — `application/json`:

```json
{
  "agent": { "name": "jarvis-core", "version": "0.1" },
  "events": [
    {
      "id": "evt_001",
      "seq": 1,
      "kind": "notification",
      "title": "Block starting",
      "body": "Deep Study Block at 9:00 AM",
      "level": "info"
    }
  ]
}
```

- `since` = highest `seq` the GUI has already delivered. Only return events
  with `seq > since`. Keep the number small (pending queue).
- `seq` must be a monotonically increasing integer (per core restart is fine).
- `agent` is optional but shown in the GUI log on connect.

### POST /jarvis/ack

Body:

```json
{ "acks": [ { "eventId": "evt_001", "ok": true }, { "eventId": "evt_002", "ok": false, "error": "task.title required" } ] }
```

Return `204` (or `{}`). On `ok: true` you may drop the event from your pending
queue. On failure, keep it (or log it) — the GUI won't retry automatically.

### POST /jarvis/journal

Body — the GUI streams activity every ~4s when there's new activity:

```json
{
  "entries": [
    { "kind": "block_completed", "at": "2026-09-26T10:00:00Z", "label": "Block done: Deep Study", "meta": { "blockId": "x" } },
    { "kind": "task_completed",  "at": "2026-09-26T10:05:00Z", "label": "Task done: Algorithms" }
  ],
  "state": { "timestamp": "…", "operator": "Operator", "credits": 42, "streak": 3, "activeBlock": null, "nextBlock": { "title": "Client Work", "start": "13:00", "end": "16:00" }, "…": "…" }
}
```

`state` is a **full live snapshot** (tasks, today's blocks + done flags,
prayers logged today, credits, streak, goals, focus session, alarms). Treat it
as the ground truth of what the operator is doing. Journal kinds you'll see:
`gui_boot`, `task_completed`, `block_started`, `block_completed`,
`prayer_reminder`, `prayer_cycle_complete`, `deadline_hit`, `milestone`,
`alarm_fired`, `alarm_snoozed`.

Return `204` if you don't need it. Return `404` if you haven't implemented it —
the GUI will buffer and retry silently.

---

## 2. Event kinds Python can push

| `kind`          | Required fields                                   | Effect in the GUI                                        |
| --------------- | ------------------------------------------------- | -------------------------------------------------------- |
| `notification`  | `title`, optional `body`, `level`                 | Toast + Alert Feed + OS notification                     |
| `task`          | `task: { title, priority?, dueDate?, … }`         | Upserts a task (matches by exact title)                  |
| `block`         | `block: { title, start, end }` (HH:mm 24h)        | Adds a schedule block (conflicts auto-resolved)          |
| `command`       | `command: "navigate" \| "complete_task" \| "ping"`| Switch tab / complete a matching task / no-op            |
| `memory`        | `note`                                            | Appends to Assistant Memory (sent back in every journal) |

Notes:
- `dueDate` is ISO 8601. `priority` ∈ `low | medium | high | critical`.
- `command: "navigate"` takes `tab` ∈ `dashboard, namaz, todo, schedule, analytics, workbench, settings`.

---

## 3. Reference Python server (works today — stdlib only)

Save as `jarvis_server.py`, run `python jarvis_server.py`, then in the GUI:
**System Core → J.A.R.V.I.S. Bridge → copy the pairing key → Test connection.**

```python
#!/usr/bin/env python3
"""Minimal J.A.R.V.I.S. bridge server — stdlib only, no dependencies."""
import json, time, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PAIRING_KEY = "PASTE_KEY_FROM_SYSTEM_CORE_HERE"

# --- your JARVIS brain hooks in here -------------------------------------
PENDING: list[dict] = []          # events waiting for the GUI to pick up
_seq = 0

def push_event(kind: str, **fields):
    """Call this from anywhere in your Python core."""
    global _seq
    _seq += 1
    ev = {"id": f"evt_{_seq}", "seq": _seq, "kind": kind, **fields}
    PENDING.append(ev)
    return ev

# Demo: a notification 5s after boot so you can see the pipeline work.
threading.Timer(5.0, lambda: push_event(
    "notification", title="J.A.R.V.I.S. online",
    body="Bridge verified. I will keep watch.", level="success",
)).start()

# -------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def _auth(self) -> bool:
        return self.headers.get("Authorization") == f"Bearer {PAIRING_KEY}"

    def _json(self, code: int, payload=None):
        body = json.dumps(payload or {}).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # Allow the Vercel page (or localhost) to read responses.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._json(204)

    def do_GET(self):
        if not self._auth():
            return self._json(401, {"error": "bad pairing key"})
        if self.path.startswith("/jarvis/sync"):
            since = int(self.path.split("since=")[-1] or 0) if "since=" in self.path else 0
            due = [e for e in PENDING if e["seq"] > since]
            return self._json(200, {"agent": {"name": "jarvis-core", "version": "0.1"},
                                    "events": due})
        return self._json(404, {"error": "unknown endpoint"})

    def do_POST(self):
        if not self._auth():
            return self._json(401, {"error": "bad pairing key"})
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n) or b"{}")
        if self.path == "/jarvis/ack":
            for a in body.get("acks", []):
                if a.get("ok"):
                    PENDING[:] = [e for e in PENDING if e["id"] != a.get("eventId")]
                else:
                    print("[jarvis] event failed:", a)
            return self._json(204)
        if self.path == "/jarvis/journal":
            for e in body.get("entries", []):
                print(f"[activity] {e.get('kind')}: {e.get('label')}")
            state = body.get("state", {})
            print(f"[state] {state.get('operator')} · {state.get('credits')} CR · "
                  f"streak {state.get('streak')} · active={state.get('activeBlock')}")
            return self._json(204)
        return self._json(404, {"error": "unknown endpoint"})

    def log_message(self, *a):  # silence default request spam
        pass

if __name__ == "__main__":
    print("J.A.R.V.I.S. bridge on http://127.0.0.1:8765")
    # probe = push_event("notification", title="Test", body="hello", level="info")
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
```

Your real core replaces the demo block: schedule rules, timers, an LLM, a
voice stack — whatever `push_event` you call lands in the dashboard within ~2
seconds, and every journal POST hands your core the operator's live state.

---

## 4. Production notes

- **Firewall**: the server binds to `127.0.0.1`, so it is not reachable from
  your network. Don't bind `0.0.0.0` — the pairing key is good but loopback is
  better.
- **HTTPS page → HTTP localhost**: allowed by secure-context rules in Chrome,
  Edge and Firefox. Safari is stricter; if you use Safari daily, run the GUI
  from `localhost` too (or upgrade the Python side to `ssl` — the same code
  works with `ThreadingHTTPServer` wrapped in `ssl.SSLContext`).
- **Latency**: the GUI polls every 2s and flushes activity every 4s. That's
  imperceptible for human schedules and keeps the Python side dumb-simple (no
  websockets needed). If you later want instant push, upgrade the Python side
  to SSE (`GET /jarvis/stream`) — the GUI's poller is the only thing to change.
- **Multiple machines**: each browser generates its own pairing key. Run one
  Python core per machine, or expose the core on your LAN (`192.168.x.x`) and
  set the Core URL on the other device — keep the key strong.
- **Vercel deploy needs nothing**: no env vars, no server code. The bridge is
  entirely browser→Python.
