import json

import httpx
import pytest

from vachi import cli
from vachi.providers.ollama import OllamaProvider

CONFIG = """
providers:
  - id: local
    type: ollama
  - id: claude
    type: anthropic
    api_key: ${TEST_CLI_MISSING_KEY}
models:
  default: local/llama3.2
system_prompt: You are Vachi.
"""


@pytest.fixture
def config_path(tmp_path, monkeypatch):
    monkeypatch.delenv("TEST_CLI_MISSING_KEY", raising=False)
    path = tmp_path / "vachi.yaml"
    path.write_text(CONFIG)
    return str(path)


@pytest.fixture
def fake_ollama(monkeypatch):
    """Make every OllamaProvider talk to a fake server that echoes the last message."""
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "llama3.2:latest"}]})
        body = json.loads(request.content)
        requests.append(body)
        reply = f"echo: {body['messages'][-1]['content']}"
        return httpx.Response(
            200,
            content=json.dumps(
                {"message": {"content": reply}, "done": True, "prompt_eval_count": 5, "eval_count": 2}
            ).encode(),
        )

    original_init = OllamaProvider.__init__

    def patched_init(self, provider_id, config, transport=None):
        original_init(self, provider_id, config, transport=httpx.MockTransport(handler))

    monkeypatch.setattr(OllamaProvider, "__init__", patched_init)
    return requests


def test_ask_prints_answer_and_usage(config_path, fake_ollama, capsys):
    assert cli.main(["--config", config_path, "ask", "hello"]) == 0
    out, err = capsys.readouterr()
    assert out.strip() == "echo: hello"
    assert "5 tokens in, 2 tokens out" in err
    assert fake_ollama[0]["messages"][0] == {"role": "system", "content": "You are Vachi."}


def test_missing_api_key_is_a_clear_error_not_a_traceback(config_path, capsys):
    assert cli.main(["--config", config_path, "ask", "hi", "--model", "claude/claude-opus-5-5"]) == 1
    err = capsys.readouterr().err
    assert "TEST_CLI_MISSING_KEY" in err and "Traceback" not in err


def test_chat_keeps_history_and_switches_model(config_path, fake_ollama, monkeypatch, capsys):
    inputs = iter(["first", "/model local/other", "second", "/clear", "third", "/exit"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(inputs))
    assert cli.main(["--config", config_path, "chat"]) == 0

    assert [r["model"] for r in fake_ollama] == ["llama3.2", "other", "other"]
    second = [m["content"] for m in fake_ollama[1]["messages"]]
    assert second == ["You are Vachi.", "first", "echo: first", "second"]  # history kept across /model
    third = [m["content"] for m in fake_ollama[2]["messages"]]
    assert third == ["You are Vachi.", "third"]  # /clear started a new conversation
    assert "now using local/other" in capsys.readouterr().out


def test_chat_bad_model_command_keeps_old_model(config_path, fake_ollama, monkeypatch, capsys):
    inputs = iter(["/model nonsense", "hi", "/exit"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(inputs))
    assert cli.main(["--config", config_path, "chat"]) == 0
    assert fake_ollama[0]["model"] == "llama3.2"
    assert "provider/model" in capsys.readouterr().err


def test_models_reports_unavailable_provider_and_continues(config_path, fake_ollama, capsys):
    assert cli.main(["--config", config_path, "models"]) == 1  # claude has no key
    out, err = capsys.readouterr()
    assert "local/llama3.2:latest" in out
    assert "claude: unavailable" in err
