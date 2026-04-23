package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kubevision/backend/internal/middleware"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ClusterHandler struct{}

func NewClusterHandler() *ClusterHandler { return &ClusterHandler{} }

func (h *ClusterHandler) Overview(c *gin.Context) {
	client := middleware.GetClient(c)
	ctx := context.Background()

	version, _ := client.ServerVersion()

	nodes, err := client.Core.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	namespaces, _ := client.Core.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	pods, _ := client.Core.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	deployments, _ := client.Core.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	services, _ := client.Core.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	pvcs, _ := client.Core.CoreV1().PersistentVolumeClaims("").List(ctx, metav1.ListOptions{})

	// Node stats
	nodeStats := summarizeNodes(nodes)
	podStats := summarizePods(pods)

	c.JSON(http.StatusOK, gin.H{
		"server_version":  version,
		"nodes":           nodeStats,
		"namespaces":      len(namespaces.Items),
		"pods":            podStats,
		"deployments":     len(deployments.Items),
		"services":        len(services.Items),
		"pvcs":            len(pvcs.Items),
	})
}

func summarizeNodes(nodes *corev1.NodeList) gin.H {
	total := len(nodes.Items)
	ready := 0
	for _, n := range nodes.Items {
		for _, cond := range n.Status.Conditions {
			if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
				ready++
			}
		}
	}
	return gin.H{"total": total, "ready": ready, "not_ready": total - ready}
}

func summarizePods(pods *corev1.PodList) gin.H {
	total := len(pods.Items)
	running, pending, failed, succeeded := 0, 0, 0, 0
	for _, p := range pods.Items {
		switch p.Status.Phase {
		case corev1.PodRunning:
			running++
		case corev1.PodPending:
			pending++
		case corev1.PodFailed:
			failed++
		case corev1.PodSucceeded:
			succeeded++
		}
	}
	return gin.H{
		"total":     total,
		"running":   running,
		"pending":   pending,
		"failed":    failed,
		"succeeded": succeeded,
	}
}

func (h *ClusterHandler) ListNamespaces(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ClusterHandler) GetNamespace(c *gin.Context) {
	client := middleware.GetClient(c)
	name := c.Param("name")
	ns, err := client.Core.CoreV1().Namespaces().Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ns)
}

func (h *ClusterHandler) ListNodes(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ClusterHandler) GetNode(c *gin.Context) {
	client := middleware.GetClient(c)
	name := c.Param("name")
	node, err := client.Core.CoreV1().Nodes().Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, node)
}
