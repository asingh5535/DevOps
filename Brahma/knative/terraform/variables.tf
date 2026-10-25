variable "kube_context" {
  description = "kubectl context to target. Must be your local Docker Desktop cluster."
  type        = string
  default     = "docker-desktop"
}

variable "operator_chart_version" {
  description = <<-EOT
    Version of the knative-operator/knative-operator Helm chart to install.
    Default (v1.23.0) was resolved and applied against a live cluster
    (Docker Desktop Kubernetes v1.34.3) via:
      helm repo add knative-operator https://knative.github.io/operator
      helm repo update
      helm search repo knative-operator/knative-operator --versions
    Before bumping this, re-run that same lookup rather than guessing a
    newer number, and override with -var="operator_chart_version=<new>".
  EOT
  type        = string
  default     = "v1.23.0"
}

variable "operator_namespace" {
  description = "Namespace the Knative Operator itself runs in."
  type        = string
  default     = "knative-operator"
}

variable "knative_serving_namespace" {
  description = "Namespace the Operator installs Knative Serving components into."
  type        = string
  default     = "knative-serving"
}

variable "demo_namespace" {
  description = "Namespace for the demo Knative Service."
  type        = string
  default     = "knative-demo"
}

variable "demo_service_name" {
  description = "Name of the demo Knative Service."
  type        = string
  default     = "helloworld-go"
}

variable "demo_image" {
  description = "Container image for the demo Knative Service."
  type        = string
  default     = "gcr.io/knative-samples/helloworld-go"
}

variable "demo_target" {
  description = "Value for the demo image's TARGET env var (what it prints in its greeting)."
  type        = string
  default     = "Knative on Docker Desktop"
}

variable "demo_min_scale" {
  description = "Minimum number of demo Service replicas. 0 enables scale-to-zero."
  type        = number
  default     = 0
}

variable "demo_max_scale" {
  description = "Maximum number of demo Service replicas."
  type        = number
  default     = 3
}

variable "demo_autoscaling_target" {
  description = "Target concurrent requests per pod before the autoscaler adds another replica (KPA concurrency target)."
  type        = number
  default     = 10
}
