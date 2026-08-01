// Package kubernetes implements the connector.Connector interface against a
// Kubernetes cluster via client-go, supporting either a full kubeconfig
// (pasted YAML) or a bare API-server URL + bearer token — the same two
// connection modes k8scenter (Brahma/k8scenter) already uses.
package kubernetes

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/okr-compass/backend/internal/connector"
)

const (
	metricPodRestarts    = "kubernetes.pod_restart_total"
	metricCrashLoopPods  = "kubernetes.crashloop_pod_count"
	metricRolloutSuccess = "kubernetes.deployment_rollout_success_pct"
	metricNodeReady      = "kubernetes.node_ready_pct"
)

var metrics = []connector.MetricSpec{
	{Key: metricPodRestarts, Name: "Pod restart total", Description: "Sum of container restart counts across pods", Unit: "restarts"},
	{Key: metricCrashLoopPods, Name: "CrashLoopBackOff pods", Description: "Pods with at least one container in CrashLoopBackOff", Unit: "pods"},
	{Key: metricRolloutSuccess, Name: "Deployment rollout success rate", Description: "Deployments fully available vs. total", Unit: "%"},
	{Key: metricNodeReady, Name: "Node ready rate", Description: "Nodes reporting Ready vs. total nodes", Unit: "%"},
}

func init() {
	connector.Register(
		connector.TypeInfo{
			Type:  connector.TypeKubernetes,
			Label: "Kubernetes",
			Fields: []connector.Field{
				{Key: "authType", Label: "Auth type: kubeconfig | token", Required: true, Placeholder: "kubeconfig"},
				{Key: "kubeconfig", Label: "Kubeconfig YAML (authType=kubeconfig)", Required: false, Secret: true},
				{Key: "namespace", Label: "Namespace (blank = all namespaces)", Required: false},
				{Key: "insecureSkipTLSVerify", Label: "Skip TLS verify (authType=token)", Required: false},
			},
		},
		metrics,
		newClient,
	)
}

type Client struct {
	clientset *kubernetes.Clientset
	namespace string
}

func newClient(cfg connector.ClusterConfig) (connector.Connector, error) {
	var restConfig *rest.Config
	var err error

	switch cfg.Extra["authType"] {
	case "token":
		serverURL := cfg.Host
		if cfg.Port != 0 {
			serverURL = fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
		}
		restConfig = &rest.Config{
			Host:        serverURL,
			BearerToken: cfg.Password,
			TLSClientConfig: rest.TLSClientConfig{
				Insecure: cfg.Extra["insecureSkipTLSVerify"] == "true",
			},
		}
	default: // "kubeconfig"
		kubeconfigYAML := cfg.Extra["kubeconfig"]
		if kubeconfigYAML == "" {
			kubeconfigYAML = cfg.Password
		}
		restConfig, err = clientcmd.RESTConfigFromKubeConfig([]byte(kubeconfigYAML))
		if err != nil {
			return nil, fmt.Errorf("parse kubeconfig: %w", err)
		}
	}

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}
	return &Client{clientset: clientset, namespace: cfg.Extra["namespace"]}, nil
}

func (c *Client) Type() connector.Type { return connector.TypeKubernetes }

func (c *Client) TestConnection(ctx context.Context) error {
	_, err := c.clientset.Discovery().ServerVersion()
	return err
}

func (c *Client) ListMetrics(ctx context.Context) ([]connector.MetricSpec, error) {
	return metrics, nil
}

func (c *Client) RunMetric(ctx context.Context, metricKey string) (connector.MetricValue, error) {
	switch metricKey {
	case metricPodRestarts:
		pods, err := c.clientset.CoreV1().Pods(c.namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return connector.MetricValue{}, err
		}
		var total int32
		for _, pod := range pods.Items {
			for _, cs := range pod.Status.ContainerStatuses {
				total += cs.RestartCount
			}
		}
		return connector.MetricValue{Value: float64(total), Unit: "restarts"}, nil

	case metricCrashLoopPods:
		pods, err := c.clientset.CoreV1().Pods(c.namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return connector.MetricValue{}, err
		}
		count := 0
		for _, pod := range pods.Items {
			if podHasCrashLoop(&pod) {
				count++
			}
		}
		return connector.MetricValue{Value: float64(count), Unit: "pods"}, nil

	case metricRolloutSuccess:
		deployments, err := c.clientset.AppsV1().Deployments(c.namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return connector.MetricValue{}, err
		}
		if len(deployments.Items) == 0 {
			return connector.MetricValue{Value: 100, Unit: "%"}, nil
		}
		healthy := 0
		for _, d := range deployments.Items {
			if d.Status.Replicas > 0 && d.Status.UpdatedReplicas == d.Status.Replicas && d.Status.AvailableReplicas == d.Status.Replicas {
				healthy++
			}
		}
		return connector.MetricValue{Value: float64(healthy) / float64(len(deployments.Items)) * 100, Unit: "%"}, nil

	case metricNodeReady:
		nodes, err := c.clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
		if err != nil {
			return connector.MetricValue{}, err
		}
		if len(nodes.Items) == 0 {
			return connector.MetricValue{Value: 0, Unit: "%"}, nil
		}
		ready := 0
		for _, n := range nodes.Items {
			for _, cond := range n.Status.Conditions {
				if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
					ready++
					break
				}
			}
		}
		return connector.MetricValue{Value: float64(ready) / float64(len(nodes.Items)) * 100, Unit: "%"}, nil

	default:
		return connector.MetricValue{}, fmt.Errorf("unknown metric key: %s", metricKey)
	}
}

func podHasCrashLoop(pod *corev1.Pod) bool {
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.State.Waiting != nil && cs.State.Waiting.Reason == "CrashLoopBackOff" {
			return true
		}
	}
	return false
}

func (c *Client) Close() error { return nil }
