"""``/command@ourbot args`` from Telegram's group command menu reaches the gateway as ``/command args``.

Driven through the adapter's real command entry point (``_handle_command``).
"""

import asyncio
import re
from types import SimpleNamespace

import pytest

from tests.gateway.test_telegram_group_gating import _group_message, _make_adapter


def _telegram_entities(text):
    return [SimpleNamespace(
        type="bot_command" if m.group().startswith("/") else "mention",
        offset=len(text[:m.start()].encode("utf-16-le")) // 2,
        length=len(m.group().encode("utf-16-le")) // 2,
    ) for m in re.finditer(r"/[A-Za-z0-9_]+(?:@[A-Za-z0-9_]{1,32})?|@[A-Za-z0-9_]{1,32}", text)]


def _dispatch(text, *, adapter=None, entities=None):
    adapter = adapter or _make_adapter(require_mention=True)
    seen = []

    async def _capture(event):
        seen.append(event)

    adapter.handle_message = _capture
    adapter._enqueue_text_event = seen.append
    msg = _group_message(text, entities=_telegram_entities(text) if entities is None else entities)
    handler = adapter._handle_command if text.startswith("/") else adapter._handle_text_message
    asyncio.run(handler(SimpleNamespace(update_id=7, message=msg, effective_message=msg), SimpleNamespace()))
    return seen


def _dispatched_command(text):
    seen = _dispatch(text)
    assert len(seen) == 1, "the addressed command was not dispatched"
    return seen[0]


@pytest.mark.parametrize("text, command, args", [
    ("/reasoning@eir_bot medium", "reasoning", "medium"),
    ("/reasoning@eir_bot: high --global", "reasoning", "high --global"),
    ("/memory@eir_bot approve abc123", "memory", "approve abc123"),
    ("/new@eir_bot", "new", ""),
    ("@eir_bot /model@eir_bot gpt-5", "model", "gpt-5"),
    ("@eir_bot, /model gpt-5", "model", "gpt-5"),
    ("/btw did @eir_bot already answer Alice?", "btw", "did @eir_bot already answer Alice?"),
    ("/btw@eir_bot did @eir_bot already answer?", "btw", "did @eir_bot already answer?"),
    ("/btw 👋 did @eir_bot already answer?", "btw", "👋 did @eir_bot already answer?"),
    ("/model @eir_bot gpt-5", "model", "gpt-5"),
    ("/model gpt-5 @eir_bot", "model", "gpt-5"),
    ("/model gpt-5 @eir_bot @eir_bot", "model", "gpt-5"),
    ("/reasoning high @eir_bot --global", "reasoning", "high --global"),
    ("/reasoning high @eir_bot @eir_bot --global", "reasoning", "high --global"),
    ("/btw did @eir_bot — our helper — already answer?", "btw", "did @eir_bot — our helper — already answer?"),
    ("/x a @eir_bot --level 3", "x", "a --level 3"),
    ("/x a @eir_bot -v", "x", "a -v"),
    ("/x a @eir_bot —global", "x", "a —global"),
    ("/x a @eir_bot –global", "x", "a –global"),
    ("/reload-mcp@eir_bot x", "reload-mcp", "x"),
])
def test_command_menu_form_keeps_its_arguments(text, command, args):
    event = _dispatched_command(text)
    assert event.get_command() == command
    assert event.text == f"/{command} {args}".rstrip()
    assert event.get_command_args() == args.replace("—", "--").replace("–", "-")


def test_prose_mention_cleanup_is_unchanged():
    adapter = _make_adapter(require_mention=True)
    assert adapter._clean_bot_trigger_text("@eir_bot, summarize this") == "summarize this"
    assert adapter._clean_bot_trigger_text("thanks @eir_bot") == "thanks"


@pytest.mark.parametrize("text, expected", [
    ("@eir_bot /new@eir_bot/log.txt", "/new/log.txt"),
    ("/new@eir_bot/log.txt", "/new /log.txt"),
    ("@eir_bot /new@alice/log.txt is missing", "/new@alice/log.txt is missing"),
    ("/file.txt is missing", "/file.txt is missing"),
    ("/file-name.txt mentions @eir_bot here", "/file-name.txt mentions here"),
    ("@eir_bot , @ops_bot are you both listening?", "@eir_bot , @ops_bot are you both listening?"),
    ("@eir_bot", "@eir_bot"),
    ("@eir_bot, summarize this", "summarize this"),
    ("thanks @eir_bot", "thanks"),
    ("/new", "/new"),
    ("@eir_bot /new", "/new"),
    ("@file: /model@eir_bot gpt-5", "@file: /model@eir_bot gpt-5"),
    ("/set-home @eir_bot", "/set-home"),
    ("/codex-runtime", "/codex-runtime"),
    ("/reload-mcp x", "/reload-mcp x"),
    ("@alice /model@OtherBot failed; @eir_bot can you explain?",
     "@alice /model@OtherBot failed; @eir_bot can you explain?"),
    ("/model@eir_bot gpt-5 @OtherBot", "/model@eir_bot gpt-5 @OtherBot"),
    ("@eir_bot /btw ask @alice", "@eir_bot /btw ask @alice"),
])
def test_other_inputs_keep_parent_behavior(text, expected):
    entities = _telegram_entities(text)
    if text.endswith("/new"):
        next(e for e in entities if e.type == "bot_command").type = "code"
    events = _dispatch(text, adapter=_make_adapter(require_mention=False), entities=entities)
    assert [e.text for e in events] == [expected]


def test_full_length_bot_username_keeps_parent_behavior():
    username = "a" * 32
    events = _dispatch(f"/model@{username} gpt-5", adapter=_make_adapter(bot_username=username))
    assert [e.text for e in events] == ["/model gpt-5"]


def test_path_without_entities_keeps_parent_behavior():
    text = "@eir_bot /new@alice/log.txt is missing"
    assert [e.text for e in _dispatch(text, entities=[])] == ["/new@alice/log.txt is missing"]
