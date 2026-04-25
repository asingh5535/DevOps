package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kubevision/backend/internal/middleware"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ServiceHandler struct{}

func NewServiceHandler() *ServiceHandler { return &ServiceHandler{} }

// ─── Services ─────────────────────────────────────────────────────────────────

func (h *ServiceHandler) ListServices(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.CoreV1().Services(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ServiceHandler) GetService(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.CoreV1().Services(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *ServiceHandler) CreateService(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[corev1.Service](c)
	if err != nil {
		return
	}
	created, err := client.Core.CoreV1().Services(body.Namespace).
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *ServiceHandler) UpdateService(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[corev1.Service](c)
	if err != nil {
		return
	}
	updated, err := client.Core.CoreV1().Services(c.Param("namespace")).
		Update(context.Background(), body, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *ServiceHandler) DeleteService(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.CoreV1().Services(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

func (h *ServiceHandler) ListEndpoints(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.CoreV1().Endpoints(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// ─── Ingresses ────────────────────────────────────────────────────────────────

func (h *ServiceHandler) ListIngresses(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.NetworkingV1().Ingresses(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ServiceHandler) GetIngress(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.NetworkingV1().Ingresses(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *ServiceHandler) CreateIngress(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[networkingv1.Ingress](c)
	if err != nil {
		return
	}
	created, err := client.Core.NetworkingV1().Ingresses(body.Namespace).
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *ServiceHandler) UpdateIngress(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[networkingv1.Ingress](c)
	if err != nil {
		return
	}
	updated, err := client.Core.NetworkingV1().Ingresses(c.Param("namespace")).
		Update(context.Background(), body, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *ServiceHandler) DeleteIngress(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.NetworkingV1().Ingresses(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── NetworkPolicies ──────────────────────────────────────────────────────────

func (h *ServiceHandler) ListNetworkPolicies(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.NetworkingV1().NetworkPolicies(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ServiceHandler) GetNetworkPolicy(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.NetworkingV1().NetworkPolicies(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *ServiceHandler) DeleteNetworkPolicy(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.NetworkingV1().NetworkPolicies(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── IngressClasses ───────────────────────────────────────────────────────────

func (h *ServiceHandler) ListIngressClasses(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.NetworkingV1().IngressClasses().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}
