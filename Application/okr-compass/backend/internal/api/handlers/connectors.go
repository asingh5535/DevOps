package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/okr-compass/backend/internal/connector"
)

type ConnectorHandler struct{}

func NewConnectorHandler() *ConnectorHandler {
	return &ConnectorHandler{}
}

// ListTypes feeds the "Add Cluster" UI's dynamic form: every registered
// connector type plus the extra fields it needs beyond host/port/username/password.
func (h *ConnectorHandler) ListTypes(c *gin.Context) {
	c.JSON(http.StatusOK, connector.ListTypes())
}

// ListMetrics feeds the Key Result builder's metric picker for a chosen connector type.
func (h *ConnectorHandler) ListMetrics(c *gin.Context) {
	metrics, err := connector.MetricsFor(connector.Type(c.Param("type")))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, metrics)
}
