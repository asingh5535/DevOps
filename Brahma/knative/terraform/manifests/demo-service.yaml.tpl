apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ${service_name}
  namespace: ${namespace}
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/min-scale: "${min_scale}"
        autoscaling.knative.dev/max-scale: "${max_scale}"
        autoscaling.knative.dev/target: "${autoscaling_target}"
    spec:
      containers:
        - image: ${image}
          env:
            - name: TARGET
              value: "${target}"
