# Run from the Vachimodel folder. Needs uv, Node.js 20+, and Docker.
.PHONY: setup test lint fmt chat models serve web up down logs ps

setup:
	cd backend && uv sync
	cd frontend && npm ci
	@test -f vachi.yaml || cp vachi.example.yaml vachi.yaml
	@if [ ! -f .env ]; then \
		sed "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$$(openssl rand -hex 16)/" .env.example > .env; \
		echo "Created .env with a random database password."; \
	fi
	@echo "Done. Add API keys to .env if you use hosted models. Then: make up"

# ---- tests and code quality
test:
	cd backend && uv run pytest -q
	cd frontend && npm test

lint:
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && npm run typecheck && npm run lint

fmt:
	cd backend && uv run ruff check --fix . && uv run ruff format .

# ---- run without Docker (development)
chat:
	cd backend && uv run vachi --config ../vachi.yaml chat $(if $(MODEL),--model $(MODEL),)

models:
	cd backend && uv run vachi --config ../vachi.yaml models

serve:   # API on http://127.0.0.1:8000 (SQLite database in backend/vachi.db)
	cd backend && uv run vachi --config ../vachi.yaml serve

web:     # UI with live reload on http://localhost:5173 (needs `make serve` running)
	cd frontend && npm run dev

# ---- run everything with Docker Compose: http://localhost:8100
up:
	@test -f vachi.yaml -a -f .env || (echo "Run 'make setup' first." && exit 1)
	docker compose up -d --build
	@echo "Vachi is starting at http://localhost:$${VACHI_PORT:-8100} (the first model download can take a few minutes)."

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

ps:
	docker compose ps
