package k8s

import (
	"encoding/base64"
	"fmt"

	apiextensionsclientset "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	metricsclientset "k8s.io/metrics/pkg/client/clientset/versioned"
)

// ClientSet holds all Kubernetes client types
type ClientSet struct {
	Core       kubernetes.Interface
	Dynamic    dynamic.Interface
	Extensions apiextensionsclientset.Interface
	Metrics    metricsclientset.Interface
	RestConfig *rest.Config
}

// NewClientFromToken creates a client using a bearer token and server URL
func NewClientFromToken(serverURL, token string, insecure bool) (*ClientSet, error) {
	restConfig := &rest.Config{
		Host:        serverURL,
		BearerToken: token,
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: insecure,
		},
	}
	return buildClientSet(restConfig)
}

// NewClientFromKubeconfig creates a client from a base64-encoded kubeconfig
func NewClientFromKubeconfig(kubeconfigB64 string) (*ClientSet, error) {
	data, err := base64.StdEncoding.DecodeString(kubeconfigB64)
	if err != nil {
		return nil, fmt.Errorf("invalid base64 kubeconfig: %w", err)
	}

	config, err := clientcmd.RESTConfigFromKubeConfig(data)
	if err != nil {
		return nil, fmt.Errorf("failed to parse kubeconfig: %w", err)
	}

	return buildClientSet(config)
}

// NewInClusterClient creates a client using in-cluster service account
func NewInClusterClient() (*ClientSet, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("not running in-cluster: %w", err)
	}
	return buildClientSet(config)
}

// NewClientFromKubeconfigFile creates a client from a kubeconfig file path
func NewClientFromKubeconfigFile(path string) (*ClientSet, error) {
	config, err := clientcmd.BuildConfigFromFlags("", path)
	if err != nil {
		return nil, fmt.Errorf("failed to build config from file: %w", err)
	}
	return buildClientSet(config)
}

func buildClientSet(config *rest.Config) (*ClientSet, error) {
	// Increase QPS and Burst for enterprise use
	config.QPS = 100
	config.Burst = 200

	core, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create core client: %w", err)
	}

	dyn, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	ext, err := apiextensionsclientset.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create extensions client: %w", err)
	}

	metrics, err := metricsclientset.NewForConfig(config)
	if err != nil {
		// Metrics server is optional
		metrics = nil
	}

	return &ClientSet{
		Core:       core,
		Dynamic:    dyn,
		Extensions: ext,
		Metrics:    metrics,
		RestConfig: config,
	}, nil
}

// ServerVersion returns the Kubernetes server version
func (c *ClientSet) ServerVersion() (string, error) {
	v, err := c.Core.Discovery().ServerVersion()
	if err != nil {
		return "", err
	}
	return v.GitVersion, nil
}
