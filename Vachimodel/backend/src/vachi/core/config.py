"""Loading vachi.yaml.

Secrets never live in the YAML file. Write `${ENV_VAR}` in the YAML and put the value
in the environment or in a `.env` file next to the YAML. `${ENV_VAR:-default}` uses
`default` when the variable isn't set. Variables are substituted
only when a provider is actually used, so a missing key for a provider you aren't
using doesn't stop the app from starting.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from vachi.core.errors import ConfigError

CONFIG_NAMES = ("vachi.yaml", "vachi.example.yaml")
_ENV_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}")


class ProviderEntry(BaseModel):
    model_config = ConfigDict(extra="allow")  # the rest is provider-specific settings

    id: str
    type: str

    def settings(self) -> dict[str, Any]:
        return dict(self.model_extra or {})


class ModelsSection(BaseModel):
    default: str | None = None


class VachiConfig(BaseModel):
    providers: list[ProviderEntry] = Field(default_factory=list)
    models: ModelsSection = Field(default_factory=ModelsSection)
    system_prompt: str | None = None
    path: Path | None = None  # where the config was loaded from


def find_config_file(start: Path | None = None) -> Path:
    """Look in `start` and its parents for vachi.yaml, then vachi.example.yaml."""
    start = (start or Path.cwd()).resolve()
    candidates = [start, *start.parents][:4]
    for name in CONFIG_NAMES:
        for directory in candidates:
            path = directory / name
            if path.is_file():
                return path
    raise ConfigError(
        "No vachi.yaml found. Copy vachi.example.yaml to vachi.yaml in the Vachimodel "
        "folder, or pass --config /path/to/vachi.yaml."
    )


def load_dotenv(path: Path) -> None:
    """Minimal .env loader. Real environment variables always win."""
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        value = value.strip().strip('"').strip("'")
        if key and value:
            os.environ.setdefault(key, value)


def load_config(path: str | Path | None = None) -> VachiConfig:
    if path is None:
        path = os.environ.get("VACHI_CONFIG") or find_config_file()
    path = Path(path).expanduser().resolve()
    if not path.is_file():
        raise ConfigError(f"Config file not found: {path}")

    load_dotenv(path.parent / ".env")

    try:
        raw = yaml.safe_load(path.read_text()) or {}
    except yaml.YAMLError as exc:
        raise ConfigError(f"{path.name} is not valid YAML: {exc}") from exc

    try:
        config = VachiConfig.model_validate(raw)
    except ValidationError as exc:
        raise ConfigError(f"{path.name} has invalid settings:\n{exc}") from exc

    ids = [p.id for p in config.providers]
    duplicates = {i for i in ids if ids.count(i) > 1}
    if duplicates:
        raise ConfigError(f"Duplicate provider id(s) in {path.name}: {', '.join(sorted(duplicates))}")

    config.path = path
    return config


def substitute_env(value: Any, *, context: str) -> Any:
    """Replace ${VAR} in strings (recursively). Missing variables raise ConfigError."""
    if isinstance(value, str):

        def replace(match: re.Match[str]) -> str:
            name, default = match.group(1), match.group(2)
            env_value = os.environ.get(name)
            if not env_value and default is not None:
                return default
            if not env_value:
                raise ConfigError(
                    f"{context} needs the environment variable {name}, but it isn't set. "
                    f"Add {name}=... to Vachimodel/.env or export it in your shell."
                )
            return env_value

        return _ENV_PATTERN.sub(replace, value)
    if isinstance(value, dict):
        return {k: substitute_env(v, context=context) for k, v in value.items()}
    if isinstance(value, list):
        return [substitute_env(v, context=context) for v in value]
    return value
