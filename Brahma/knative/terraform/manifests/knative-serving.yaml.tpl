apiVersion: operator.knative.dev/v1beta1
kind: KnativeServing
metadata:
  name: knative-serving
  namespace: ${namespace}
spec:
  ingress:
    kourier:
      enabled: true
  config:
    network:
      ingress-class: "kourier.ingress.networking.knative.dev"
    domain:
      # Without a real domain configured here, Knative gives Services
      # *.svc.cluster.local URLs, which are cluster-local by design and
      # get a 404 from the external Kourier gateway on purpose (see the
      # config-domain configmap's own comments). sslip.io is Knative's
      # documented "magic DNS" approach for exactly this local-cluster
      # case: it resolves any *.127.0.0.1.sslip.io name to 127.0.0.1,
      # matching Docker Desktop's localhost-bound Kourier LoadBalancer.
      127.0.0.1.sslip.io: ""
