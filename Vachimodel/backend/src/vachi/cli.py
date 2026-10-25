"""Vachi command-line interface.

vachi chat  [--model provider/model]   interactive streaming chat
vachi ask   "question" [--model ...]    one question, one answer
vachi models [--provider id]           list models from configured providers
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from collections.abc import Coroutine
from typing import Any

from vachi.chat.router import Router
from vachi.core.config import VachiConfig, load_config
from vachi.core.errors import VachiError
from vachi.core.messages import ChatRequest, Message, Usage
from vachi.core.registry import ProviderRegistry

CHAT_HELP = """Commands:
  /model provider/model   switch model (history is kept)
  /clear                  start a new conversation
  /help                   show this help
  /exit                   quit (or press Ctrl-D)
Press Ctrl-C while Vachi is answering to stop the answer."""


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.command:
        build_parser().print_help()
        return 0
    try:
        config = load_config(args.config)
        registry = ProviderRegistry(config)
        return args.handler(args, config, registry)
    except VachiError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="vachi", description="Vachi, a plug-and-play AI assistant.")
    parser.add_argument("--config", help="path to vachi.yaml (default: search current and parent folders)")
    sub = parser.add_subparsers(dest="command")

    def add_generation_args(p: argparse.ArgumentParser) -> None:
        p.add_argument("--model", "-m", help="provider/model, e.g. local/llama3.2 (default: models.default)")
        p.add_argument("--system", help="system prompt (default: system_prompt from vachi.yaml)")
        p.add_argument("--temperature", type=float, help="randomness, 0-2 (ignored by providers that don't support it)")
        p.add_argument("--max-tokens", type=int, help="maximum length of each answer, in tokens")

    chat = sub.add_parser("chat", help="interactive streaming chat")
    add_generation_args(chat)
    chat.set_defaults(handler=cmd_chat)

    ask = sub.add_parser("ask", help="ask one question and print the answer")
    ask.add_argument("question")
    add_generation_args(ask)
    ask.set_defaults(handler=cmd_ask)

    models = sub.add_parser("models", help="list models from configured providers")
    models.add_argument("--provider", "-p", help="only this provider id")
    models.set_defaults(handler=cmd_models)

    serve = sub.add_parser("serve", help="run the web API server")
    serve.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 inside Docker")
    serve.add_argument("--port", type=int, default=8000)
    serve.set_defaults(handler=cmd_serve)
    return parser


class Session:
    """Runs async provider calls on one event loop, so clients can be reused across turns."""

    def __init__(self, registry: ProviderRegistry):
        self.registry = registry
        self.loop = asyncio.new_event_loop()

    def run(self, coro: Coroutine[Any, Any, Any]) -> Any:
        task = self.loop.create_task(coro)
        try:
            return self.loop.run_until_complete(task)
        except KeyboardInterrupt:
            task.cancel()
            self.loop.run_until_complete(asyncio.gather(task, return_exceptions=True))
            raise

    def close(self) -> None:
        self.loop.run_until_complete(self.registry.aclose())
        self.loop.close()


async def stream_answer(
    registry: ProviderRegistry,
    model_ref: str | None,
    history: list[Message],
    args: argparse.Namespace,
    config: VachiConfig,
    parts: list[str],
) -> Usage | None:
    """Print the answer as it streams. Appends text to `parts` so a stopped answer can be kept.

    Goes through the router, so `models.fallback` and retries from vachi.yaml apply."""
    request = ChatRequest(
        model="",
        messages=history,
        system=args.system if args.system is not None else config.system_prompt,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
    )
    usage = None
    async for chunk in Router(config, registry).stream(model_ref, request):
        if chunk.type == "route" and chunk.text:
            print(f"[answered by {chunk.model}: {chunk.text}]", file=sys.stderr, flush=True)
        elif chunk.type == "text":
            parts.append(chunk.text)
            print(chunk.text, end="", flush=True)
        elif chunk.type == "notice":
            print(f"\n[{chunk.text}]", end="", file=sys.stderr, flush=True)
        elif chunk.type == "done":
            usage = chunk.usage
    print()
    return usage


def cmd_ask(args: argparse.Namespace, config: VachiConfig, registry: ProviderRegistry) -> int:
    session = Session(registry)
    try:
        usage = session.run(
            stream_answer(registry, args.model, [Message(role="user", content=args.question)], args, config, [])
        )
        if usage:
            print(f"[{usage.input_tokens} tokens in, {usage.output_tokens} tokens out]", file=sys.stderr)
        return 0
    except KeyboardInterrupt:
        print("\n[stopped]", file=sys.stderr)
        return 130
    finally:
        session.close()


def cmd_chat(args: argparse.Namespace, config: VachiConfig, registry: ProviderRegistry) -> int:
    model_ref = args.model or config.models.default
    registry.parse(model_ref)  # fail fast on a malformed model name or unknown provider
    session = Session(registry)
    history: list[Message] = []
    print(f"Vachi chat with {model_ref}. Type /help for commands.\n")
    try:
        while True:
            try:
                text = input("you> ").strip()
            except EOFError:
                print()
                return 0
            except KeyboardInterrupt:
                print()
                return 0
            if not text:
                continue

            if text.startswith("/"):
                command, _, rest = text.partition(" ")
                if command in ("/exit", "/quit"):
                    return 0
                if command == "/help":
                    print(CHAT_HELP)
                elif command == "/clear":
                    history.clear()
                    print("[new conversation]")
                elif command == "/model":
                    try:
                        registry.parse(rest.strip())
                        model_ref = rest.strip()
                        print(f"[now using {model_ref}]")
                    except VachiError as exc:
                        print(f"Error: {exc}", file=sys.stderr)
                else:
                    print(f"Unknown command {command}. Type /help.")
                continue

            history.append(Message(role="user", content=text))
            parts: list[str] = []
            print("vachi> ", end="", flush=True)
            try:
                session.run(stream_answer(registry, model_ref, history, args, config, parts))
            except KeyboardInterrupt:
                print("\n[stopped]")
            except VachiError as exc:
                print(f"\nError: {exc}", file=sys.stderr)
                history.pop()  # drop the question that failed, so the user can retry
                continue
            history.append(Message(role="assistant", content="".join(parts) or "(no answer)"))
    finally:
        session.close()


def cmd_models(args: argparse.Namespace, config: VachiConfig, registry: ProviderRegistry) -> int:
    provider_ids = [args.provider] if args.provider else registry.provider_ids
    session = Session(registry)
    failed = False
    try:
        for provider_id in provider_ids:
            try:
                provider = registry.get(provider_id)
                models = session.run(provider.list_models())
            except VachiError as exc:
                print(f"{provider_id}: unavailable - {exc}", file=sys.stderr)
                failed = True
                continue
            print(f"{provider_id} ({provider.type_name}): {len(models)} model(s)")
            for m in sorted(models, key=lambda m: m.id):
                ctx = f"  [{m.context_window:,} token context]" if m.context_window else ""
                print(f"  {m.full_id}{ctx}")
    finally:
        session.close()
    return 1 if failed else 0


def cmd_serve(args: argparse.Namespace, config: VachiConfig, registry: ProviderRegistry) -> int:
    import uvicorn

    from vachi.api.app import create_app

    uvicorn.run(create_app(config, registry), host=args.host, port=args.port, proxy_headers=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
