# 1. Knative Operator, installed via its official Helm chart.
#    The Operator's CRDs (KnativeServing, KnativeEventing, ...) come bundled
#    with this release.
resource "helm_release" "knative_operator" {
  name             = "knative-operator"
  repository       = "https://knative.github.io/operator"
  chart            = "knative-operator"
  version          = var.operator_chart_version
  namespace        = var.operator_namespace
  create_namespace = true

  values = [file("${path.module}/../helm/knative-operator-values.yaml")]
}

# 2. Namespace for Knative Serving components, created explicitly rather
#    than assumed from Operator reconciliation behavior.
resource "kubectl_manifest" "knative_serving_namespace" {
  yaml_body = templatefile("${path.module}/manifests/namespace.yaml.tpl", {
    namespace_name = var.knative_serving_namespace
  })

  depends_on = [helm_release.knative_operator]
}

# 3. KnativeServing custom resource. The Operator watches this and installs
#    Serving core + Kourier ingress in response. Applied via kubectl_manifest
#    (not kubernetes_manifest) because the CRD and this CR are introduced in
#    the same apply, which kubernetes_manifest cannot handle at plan time.
resource "kubectl_manifest" "knative_serving" {
  yaml_body = templatefile("${path.module}/manifests/knative-serving.yaml.tpl", {
    namespace = var.knative_serving_namespace
  })

  depends_on = [kubectl_manifest.knative_serving_namespace]
}

# 3b. Wait for the Operator to actually reconcile the KnativeServing CR and
#     install the serving.knative.dev CRDs before applying a CR of that
#     kind. Creating the KnativeServing object above only posts the
#     request — the Operator's reconciliation (which installs Serving core
#     + Kourier) happens asynchronously, so a plain depends_on ordering is
#     not enough: applying the demo Service too early fails with
#     "resource [serving.knative.dev/v1/Service] isn't valid for cluster".
resource "null_resource" "wait_for_serving_ready" {
  depends_on = [kubectl_manifest.knative_serving]

  provisioner "local-exec" {
    command = "kubectl wait --for=condition=Ready knativeserving/knative-serving -n ${var.knative_serving_namespace} --timeout=300s"
  }
}

# 4. Namespace for the demo Knative Service.
resource "kubectl_manifest" "demo_namespace" {
  yaml_body = templatefile("${path.module}/manifests/namespace.yaml.tpl", {
    namespace_name = var.demo_namespace
  })

  depends_on = [helm_release.knative_operator]
}

# 5. Demo Knative Service: a single deployable unit that Knative expands
#    into Configuration + Revision + Route under the hood.
resource "kubectl_manifest" "demo_service" {
  yaml_body = templatefile("${path.module}/manifests/demo-service.yaml.tpl", {
    service_name        = var.demo_service_name
    namespace            = var.demo_namespace
    image                = var.demo_image
    target               = var.demo_target
    min_scale            = var.demo_min_scale
    max_scale            = var.demo_max_scale
    autoscaling_target   = var.demo_autoscaling_target
  })

  depends_on = [null_resource.wait_for_serving_ready, kubectl_manifest.demo_namespace]
}
