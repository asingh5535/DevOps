package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/okr-compass/backend/internal/connector"
	"github.com/okr-compass/backend/internal/crypto"
	"github.com/okr-compass/backend/internal/store"
)

type ClusterHandler struct {
	store *store.Store
	box   *crypto.Box
}

func NewClusterHandler(st *store.Store, box *crypto.Box) *ClusterHandler {
	return &ClusterHandler{store: st, box: box}
}

type createClusterRequest struct {
	Name     string            `json:"name" binding:"required"`
	Type     string            `json:"type" binding:"required"`
	Host     string            `json:"host"`
	Port     int               `json:"port"`
	Username string            `json:"username"`
	Password string            `json:"password"`
	Extra    map[string]string `json:"extra"`
}

func (h *ClusterHandler) Create(c *gin.Context) {
	var req createClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	encrypted, err := h.box.Encrypt(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt credentials"})
		return
	}

	cluster := &store.Cluster{
		ID:                   uuid.NewString(),
		Name:                 req.Name,
		Type:                 req.Type,
		Host:                 req.Host,
		Port:                 req.Port,
		Username:             req.Username,
		EncryptedCredentials: encrypted,
		Extra:                req.Extra,
	}
	if err := h.store.CreateCluster(cluster); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, cluster)
}

func (h *ClusterHandler) List(c *gin.Context) {
	clusters, err := h.store.ListClusters()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, clusters)
}

func (h *ClusterHandler) Delete(c *gin.Context) {
	if err := h.store.DeleteCluster(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *ClusterHandler) TestConnection(c *gin.Context) {
	cluster, err := h.store.GetCluster(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if cluster == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not found"})
		return
	}

	password, err := h.box.Decrypt(cluster.EncryptedCredentials)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decrypt credentials"})
		return
	}

	conn, err := connector.Build(connector.ClusterConfig{
		Name:     cluster.Name,
		Type:     connector.Type(cluster.Type),
		Host:     cluster.Host,
		Port:     cluster.Port,
		Username: cluster.Username,
		Password: password,
		Extra:    cluster.Extra,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := conn.TestConnection(ctx); err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
