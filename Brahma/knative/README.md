# Knative Serving — Local Docker Desktop Demo

Installs **Knative Serving** (not Eventing) onto your local Docker Desktop
Kubernetes cluster using **Terraform + Helm**, with **Kourier** as the
networking/ingress layer, plus a demo Service to make autoscaling and
scale-to-zero concrete.

## Architecture

```
Brahma/knative/
├── terraform/
│   ├── providers.tf              # helm + kubectl (alekc/kubectl) providers
│   ├── variables.tf              # kube_context, operator_chart_version, demo_* vars
│   ├── main.tf                   # helm_release (Operator) + kubectl_manifest (CRs)
│   ├── manifests/*.yaml.tpl      # KnativeServing CR, demo Service CR, Namespace
│   └── outputs.tf
├── helm/
│   └── knative-operator-values.yaml
├── scripts/
│   ├── bootstrap-tools.sh        # checks docker/helm/terraform, prints fixes
│   └── watch-scaling.sh          # watch pods scale to zero and back up
├── deploy.sh
└── teardown.sh
```

Request flow once deployed:

```
Client (curl/browser)
   │
   ▼
Kourier Gateway (Envoy) — Service type LoadBalancer, port 80/443
   Docker Desktop auto-binds this to http://localhost — no port-forward
   or NodePort needed.
   │
   ▼
Activator  ──(if 0 pods)──►  Queue-Proxy + Revision Pod (cold start)
   │
   ▼
Queue-Proxy + Revision Pod (warm)  ◄── scaled 0..N by the Knative
   │                                    Pod Autoscaler (KPA) based on
   ▼                                    concurrent requests
Your container (helloworld-go)
```

What's installed by **Helm** vs. orchestrated by **Terraform**:

| Layer | Installed by | Resource |
|---|---|---|
| Knative Operator (controller + CRDs) | Helm chart `knative-operator/knative-operator` | `helm_release.knative_operator` |
| Knative Serving core + Kourier | Operator, reconciling a CR | `kubectl_manifest.knative_serving` (`KnativeServing` CR) |
| Demo Service | Operator/Serving, reconciling a CR | `kubectl_manifest.demo_service` (`Service` CR) |

`kubectl_manifest` (from the `alekc/kubectl` provider) is used instead of
`hashicorp/kubernetes`'s `kubernetes_manifest` because the Operator's CRDs
and our CR instances of them are introduced in the *same* `terraform
apply` — `kubernetes_manifest` does plan-time schema validation and fails
in that case; `kubectl_manifest` applies at apply-time with no such
restriction.

## Prerequisites

| Tool | Notes |
|---|---|
| Docker Desktop | Kubernetes enabled (Settings → Kubernetes → Enable Kubernetes), context named `docker-desktop` |
| kubectl | Bundled with Docker Desktop |
| Helm | Not bundled — `winget install Helm.Helm` |
| Terraform | Not bundled — `winget install Hashicorp.Terraform` |
| Cluster resources | ~6 CPU / 6 GB RAM / 30 GB disk recommended for Serving core; Kourier itself adds ~0.4 CPU / 0.4 GB requests on top |

Run `bash scripts/bootstrap-tools.sh` to check all of the above before deploying.

## Quick Start

```bash
# 1. Verify tools and Docker are ready
bash scripts/bootstrap-tools.sh

# 2. (optional) Re-check the chart version before deploying — variables.tf
#    defaults to v1.23.0, verified working on this cluster; re-resolve
#    before bumping it rather than guessing a newer number:
helm repo add knative-operator https://knative.github.io/operator
helm repo update
helm search repo knative-operator/knative-operator --versions

# 3. Deploy (-y confirms the cluster-wide apply)
bash deploy.sh -y
# — equivalent to:
#   terraform -chdir=terraform init
#   terraform -chdir=terraform apply -auto-approve

# 4. Verify (Kourier's gateway/controller run inside knative-serving under
#    the Operator install — there is no separate kourier-system namespace)
kubectl get pods -n knative-operator
kubectl get pods -n knative-serving
kubectl get ksvc -n knative-demo

# 5. Hit it — the demo ships with a real, resolvable domain (see "Kourier"
#    below for why), so no Host header or port-forward needed:
curl $(kubectl get ksvc helloworld-go -n knative-demo -o jsonpath='{.status.url}')
```

## Knative Concepts

Each concept below is tied to an object this project actually creates —
inspect them live with the commands shown.

- **Service** (`serving.knative.dev/v1 Service`) — the single object you
  manage day-to-day. Ours: `terraform/manifests/demo-service.yaml.tpl`,
  applied as `kubectl_manifest.demo_service`.
  `kubectl get service.serving.knative.dev -n knative-demo`

- **Configuration** — the "current desired state" a Service manages under
  the hood; every spec change creates a new Revision from it.
  `kubectl get configuration -n knative-demo`

- **Revision** — an immutable snapshot of code + config, created each time
  the Configuration changes. Revisions are what actually get scaled.
  `kubectl get revisions -n knative-demo`

- **Route** — maps traffic (by percentage) to one or more Revisions. With
  a single Service and no manual splitting, it points 100% at the latest
  Revision. Bump `demo_image` or `demo_target` in `variables.tf`, re-apply,
  then inspect:
  `kubectl get route helloworld-go -n knative-demo -o yaml`
  to see `status.traffic[].percent` / `.revisionName` — this is how
  canary/blue-green traffic splitting works in Knative.

- **Autoscaling (KPA) + scale-to-zero** — controlled by the
  `autoscaling.knative.dev/*` annotations set in
  `demo-service.yaml.tpl` (`min-scale: "0"`, `max-scale`, `target`
  concurrency). Watch it happen:
  ```bash
  bash scripts/watch-scaling.sh knative-demo
  ```
  Idle for ~60s → pod count drops to 0. Generate load (command printed by
  the script) → the Activator catches the incoming request, cold-starts a
  pod, and traffic flows once it's ready.

- **Kourier** — the ingress data plane (Envoy) fronting every Knative
  Service on the cluster. Installed automatically because
  `KnativeServing.spec.ingress.kourier.enabled: true` is set in
  `knative-serving.yaml.tpl` — no separate Helm chart or manifest for it.
  Under the Operator install its gateway/controller pods run inside the
  `knative-serving` namespace itself (not a separate `kourier-system`
  namespace, unlike the plain-YAML install path some docs show — verified
  live against this cluster). Exposed via its `kourier` Service,
  `type: LoadBalancer`, which Docker Desktop auto-binds to `localhost:80`.
  This is a deliberate deviation from `finops` (port-forward-only) and
  `k8scenter` (NodePort) in this repo: Kourier's default Service type
  already resolves to `localhost` on Docker Desktop with zero extra steps.

  One catch discovered while standing this up: Knative's *default* domain
  config gives Services `*.svc.cluster.local` URLs, and
  `.svc.cluster.local` routes are **cluster-local by design** — Kourier's
  external gateway correctly 404s them (see the `config-domain` configmap's
  own comments in `knative-serving` namespace). To make the demo reachable
  from the host at all, `knative-serving.yaml.tpl` sets
  `spec.config.domain["127.0.0.1.sslip.io"] = ""` — [sslip.io](https://sslip.io)
  is Knative's documented "magic DNS" trick: any `*.127.0.0.1.sslip.io`
  name publicly resolves to `127.0.0.1`, which lines up exactly with
  Docker Desktop's localhost-bound LoadBalancer. Without this, `curl`
  against the ksvc URL would hang/404 even though the LB itself is
  reachable.

## Access Points

| What | How |
|---|---|
| Demo Service URL | `kubectl get ksvc helloworld-go -n knative-demo -o jsonpath='{.status.url}'` (resolves to `http://helloworld-go.knative-demo.127.0.0.1.sslip.io`) |
| Reach it | `curl $(kubectl get ksvc helloworld-go -n knative-demo -o jsonpath='{.status.url}')` — no Host header or port-forward needed, sslip.io resolves it to `127.0.0.1` directly |

## Teardown

```bash
bash teardown.sh
```

Runs `terraform destroy` (removes the demo Service, `KnativeServing` CR,
and Operator release in dependency order), then cleans up namespaces
directly in case of state drift.

## Execution Rules

1. Always check `kubectl config current-context` before `terraform apply`
   — this installs cluster-wide CRDs and should only ever target your
   local `docker-desktop` context.
2. Never run `terraform apply -auto-approve` on a context you haven't
   verified — `deploy.sh` requires an explicit `-y` for this reason.
3. Re-resolve `operator_chart_version` with `helm search repo ... --versions`
   before bumping it — don't guess a version number.
4. This project is Serving-only by design; don't co-install Eventing CRs
   here — that's a separate concern (Broker/Trigger/Channel) with its own
   resource footprint.
5. After every deploy, check `kubectl get events -n knative-serving` for
   reconciliation errors (Kourier's components live in this namespace
   too, not a separate `kourier-system`) before assuming success.
6. Applying `KnativeServing` doesn't mean Serving is installed yet — the
   Operator reconciles it asynchronously. `main.tf`'s
   `null_resource.wait_for_serving_ready` (`kubectl wait --for=condition=Ready
   knativeserving/knative-serving`) exists specifically to block on this
   before applying any CR of a kind Serving itself provides (e.g. the
   demo `Service`) — don't remove it without replacing the wait some
   other way.
