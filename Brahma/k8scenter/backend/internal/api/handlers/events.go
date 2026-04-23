package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kubevision/backend/internal/middleware"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type EventHandler struct{}

func NewEventHandler() *EventHandler { return &EventHandler{} }

func (h *EventHandler) ListEvents(c *gin.Context) {
	client := middleware.GetClient(c)
	namespace := ns(c)

	opts := metav1.ListOptions{}
	if field := c.Query("fieldSelector"); field != "" {
		opts.FieldSelector = field
	}

	list, err := client.Core.CoreV1().Events(namespace).List(context.Background(), opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *EventHandler) ListEventsForResource(c *gin.Context) {
	client := middleware.GetClient(c)
	namespace := c.Param("namespace")
	kind := c.Query("kind")
	name := c.Query("name")

	fieldSelector := "involvedObject.namespace=" + namespace
	if kind != "" {
		fieldSelector += ",involvedObject.kind=" + kind
	}
	if name != "" {
		fieldSelector += ",involvedObject.name=" + name
	}

	list, err := client.Core.CoreV1().Events(namespace).List(context.Background(), metav1.ListOptions{
		FieldSelector: fieldSelector,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}
