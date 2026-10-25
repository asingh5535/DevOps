from pathlib import Path

import pytest

from vachi.core.config import load_config, substitute_env
from vachi.core.errors import ConfigError
from vachi.core.registry import ProviderRegistry, discover_provider_types
from vachi.providers.anthropic import AnthropicProvider
from vachi.providers.ollama import OllamaProvider

CONFIG = """
providers:
  - id: local
    type: ollama
  - id: claude
    type: anthropic
    api_key: ${TEST_VACHI_KEY}
models:
  default: local/llama3.2
"""


def write_config(tmp_path: Path, text: str = CONFIG) -> Path:
    path = tmp_path / "vachi.yaml"
    path.write_text(text)
    return path


def test_builtin_providers_are_registered_as_entry_points():
    types = discover_provider_types()
    assert {"ollama", "anthropic", "openai"} <= set(types)


def test_resolve_default_model(tmp_path):
    registry = ProviderRegistry(load_config(write_config(tmp_path)))
    provider, model = registry.resolve(None)
    assert isinstance(provider, OllamaProvider)
    assert model == "llama3.2"


def test_model_names_may_contain_slashes(tmp_path):
    registry = ProviderRegistry(load_config(write_config(tmp_path)))
    _, model = registry.resolve("local/library/qwen3:8b")
    assert model == "library/qwen3:8b"


def test_missing_api_key_only_fails_when_provider_is_used(tmp_path, monkeypatch):
    monkeypatch.delenv("TEST_VACHI_KEY", raising=False)
    registry = ProviderRegistry(load_config(write_config(tmp_path)))
    registry.resolve("local/llama3.2")  # unaffected
    with pytest.raises(ConfigError, match="TEST_VACHI_KEY"):
        registry.resolve("claude/claude-opus-5-5")


def test_api_key_from_dotenv(tmp_path, monkeypatch):
    monkeypatch.delenv("TEST_VACHI_KEY", raising=False)
    (tmp_path / ".env").write_text("# comment\nTEST_VACHI_KEY='sk-test'\n")
    registry = ProviderRegistry(load_config(write_config(tmp_path)))
    provider, _ = registry.resolve("claude/claude-opus-5-5")
    assert isinstance(provider, AnthropicProvider)
    assert provider.config.api_key.get_secret_value() == "sk-test"
    assert "sk-test" not in repr(provider.config)  # secrets are hidden in logs/reprs


def test_real_environment_wins_over_dotenv(tmp_path, monkeypatch):
    monkeypatch.setenv("TEST_VACHI_KEY", "from-shell")
    (tmp_path / ".env").write_text("TEST_VACHI_KEY=from-file\n")
    registry = ProviderRegistry(load_config(write_config(tmp_path)))
    provider, _ = registry.resolve("claude/x")
    assert provider.config.api_key.get_secret_value() == "from-shell"


@pytest.mark.parametrize(
    ("ref", "message"),
    [
        ("nope/model", "Unknown provider 'nope'"),
        ("llama3.2", "must look like provider/model"),
        ("local/", "provider/model"),
    ],
)
def test_bad_model_refs_give_clear_errors(tmp_path, ref, message):
    registry = ProviderRegistry(load_config(write_config(tmp_path)))
    with pytest.raises(ConfigError, match=message):
        registry.resolve(ref)


def test_unknown_provider_type(tmp_path):
    path = write_config(tmp_path, "providers:\n  - id: x\n    type: magic\n")
    with pytest.raises(ConfigError, match="unknown type 'magic'"):
        ProviderRegistry(load_config(path)).get("x")


def test_invalid_provider_settings(tmp_path):
    path = write_config(tmp_path, "providers:\n  - id: x\n    type: ollama\n    timeout_seconds: soon\n")
    with pytest.raises(ConfigError, match="invalid settings"):
        ProviderRegistry(load_config(path)).get("x")


def test_duplicate_provider_ids(tmp_path):
    path = write_config(tmp_path, "providers:\n  - {id: a, type: ollama}\n  - {id: a, type: ollama}\n")
    with pytest.raises(ConfigError, match="Duplicate provider"):
        load_config(path)


def test_invalid_yaml(tmp_path):
    with pytest.raises(ConfigError, match="not valid YAML"):
        load_config(write_config(tmp_path, "providers: [unclosed"))


def test_substitute_env_recurses(monkeypatch):
    monkeypatch.setenv("A_VAR", "1")
    assert substitute_env({"x": ["${A_VAR}", {"y": "v${A_VAR}"}], "n": 3}, context="t") == {
        "x": ["1", {"y": "v1"}],
        "n": 3,
    }


def test_example_config_is_valid():
    example = Path(__file__).resolve().parents[2] / "vachi.example.yaml"
    config = load_config(example)
    registry = ProviderRegistry(config)
    provider, _ = registry.resolve(None)
    assert provider.id == "local"


def test_substitute_env_default(monkeypatch):
    monkeypatch.delenv("UNSET_VAR", raising=False)
    monkeypatch.setenv("SET_VAR", "real")
    assert substitute_env("${UNSET_VAR:-http://localhost:11434}", context="t") == "http://localhost:11434"
    assert substitute_env("${SET_VAR:-fallback}", context="t") == "real"
    assert substitute_env("${UNSET_VAR:-}", context="t") == ""
