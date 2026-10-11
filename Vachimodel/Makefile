# Run from the Vachimodel folder. Requires uv (https://docs.astral.sh/uv/).
.PHONY: setup test lint fmt chat models

setup:
	cd backend && uv sync
	@test -f vachi.yaml || cp vachi.example.yaml vachi.yaml
	@test -f .env || cp .env.example .env
	@echo "Done. Edit .env to add API keys, then run: make chat"

test:
	cd backend && uv run pytest -q

lint:
	cd backend && uv run ruff check . && uv run ruff format --check .

fmt:
	cd backend && uv run ruff check --fix . && uv run ruff format .

chat:
	cd backend && uv run vachi --config ../vachi.yaml chat $(if $(MODEL),--model $(MODEL),)

models:
	cd backend && uv run vachi --config ../vachi.yaml models
