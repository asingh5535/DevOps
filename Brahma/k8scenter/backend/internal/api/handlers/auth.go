package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	k8sclient "github.com/kubevision/backend/internal/k8s"
	"github.com/kubevision/backend/internal/middleware"
)

type AuthHandler struct {
	JWTSecret string
}

func NewAuthHandler(secret string) *AuthHandler {
	return &AuthHandler{JWTSecret: secret}
}

type LoginRequest struct {
	AuthType      string `json:"auth_type" binding:"required"` // token | kubeconfig | incluster
	ServerURL     string `json:"server_url"`
	Token         string `json:"token"`
	KubeconfigB64 string `json:"kubeconfig_b64"`
}

type LoginResponse struct {
	AccessToken   string `json:"access_token"`
	ServerVersion string `json:"server_version"`
	ServerURL     string `json:"server_url"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Try to connect and validate credentials
	var client *k8sclient.ClientSet
	var err error

	switch req.AuthType {
	case "token":
		if req.ServerURL == "" || req.Token == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "server_url and token required for token auth"})
			return
		}
		client, err = k8sclient.NewClientFromToken(req.ServerURL, req.Token, true)
	case "kubeconfig":
		if req.KubeconfigB64 == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kubeconfig_b64 required for kubeconfig auth"})
			return
		}
		client, err = k8sclient.NewClientFromKubeconfig(req.KubeconfigB64)
	case "incluster":
		client, err = k8sclient.NewInClusterClient()
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid auth_type, must be: token | kubeconfig | incluster"})
		return
	}

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication failed: " + err.Error()})
		return
	}

	// Validate by fetching server version
	version, err := client.ServerVersion()
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "cannot reach Kubernetes API: " + err.Error()})
		return
	}

	// Build JWT claims
	claims := middleware.Claims{
		ServerURL:     req.ServerURL,
		Token:         req.Token,
		KubeconfigB64: req.KubeconfigB64,
		AuthType:      req.AuthType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "kubevision",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sign token"})
		return
	}

	serverURL := req.ServerURL
	if serverURL == "" && client.RestConfig != nil {
		serverURL = client.RestConfig.Host
	}

	c.JSON(http.StatusOK, LoginResponse{
		AccessToken:   signed,
		ServerVersion: version,
		ServerURL:     serverURL,
	})
}

func (h *AuthHandler) Verify(c *gin.Context) {
	client := middleware.GetClient(c)
	version, err := client.ServerVersion()
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "cluster unreachable: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":         "ok",
		"server_version": version,
	})
}
