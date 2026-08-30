# These are static hints, not live-computed values: Docker Desktop's
# localhost binding for the Kourier LoadBalancer Service happens outside
# Terraform's visibility, so deploy.sh prints the real, live access banner
# after apply instead of relying on a Terraform output.

output "demo_namespace" {
  description = "Namespace the demo Knative Service was deployed into."
  value       = var.demo_namespace
}

output "demo_service_name" {
  description = "Name of the demo Knative Service."
  value       = var.demo_service_name
}

output "next_steps" {
  description = "Commands to check on and reach the demo Knative Service after apply."
  value = <<-EOT
    Check components (Kourier's gateway/controller run inside the Serving
    namespace under the Operator install, not a separate kourier-system):
      kubectl get pods -n ${var.operator_namespace}
      kubectl get pods -n ${var.knative_serving_namespace}

    Get the demo Service URL:
      kubectl get ksvc ${var.demo_service_name} -n ${var.demo_namespace} -o jsonpath='{.status.url}'

    Reach it directly (URL already resolves to 127.0.0.1 via sslip.io,
    and Docker Desktop auto-binds Kourier's LoadBalancer Service to localhost):
      curl $(kubectl get ksvc ${var.demo_service_name} -n ${var.demo_namespace} -o jsonpath='{.status.url}')
  EOT
}
