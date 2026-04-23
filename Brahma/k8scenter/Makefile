.PHONY: all build up down dev logs clean setup-kind token help

CLUSTER_NAME := kubevision-dev

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

all: build up ## Build and start everything

build: ## Build Docker images
	docker compose build

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

dev: ## Start in development mode (with hot reload)
	docker compose -f docker-compose.dev.yml up

logs: ## Tail all logs
	docker compose logs -f

logs-backend: ## Tail backend logs
	docker compose logs -f backend

setup-kind: ## Create a local kind Kubernetes cluster
	kind create cluster --config kind-config.yaml
	@echo "Kind cluster '$(CLUSTER_NAME)' created"
	@echo "Get API server: $$(kubectl cluster-info | head -1)"

delete-kind: ## Delete the kind cluster
	kind delete cluster --name $(CLUSTER_NAME)

token: ## Get a service account token for login
	@kubectl create token default -n default 2>/dev/null || \
	kubectl -n default get secret $$(kubectl -n default get sa/default -o jsonpath="{.secrets[0].name}") \
	  -o jsonpath="{.data.token}" | base64 -d
	@echo ""

apply-rbac: ## Apply RBAC manifests for in-cluster deployment
	kubectl apply -f k8s-manifests/rbac.yaml
	@echo "RBAC applied"

deploy: ## Deploy KubeVision to the current cluster
	kubectl apply -f k8s-manifests/rbac.yaml
	kubectl apply -f k8s-manifests/deployment.yaml
	@echo "KubeVision deployed to cluster"

clean: ## Remove Docker images and containers
	docker compose down --rmi all --volumes --remove-orphans

backend-shell: ## Open a shell in the backend container
	docker exec -it kubevision-backend sh

tidy: ## Run go mod tidy
	cd backend && go mod tidy
