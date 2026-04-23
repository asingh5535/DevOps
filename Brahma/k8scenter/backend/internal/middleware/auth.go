package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	k8sclient "github.com/kubevision/backend/internal/k8s"
)

const ClientSetKey = "k8s_client"

type Claims struct {
	ServerURL     string `json:"server_url"`
	Token         string `json:"token"`
	KubeconfigB64 string `json:"kubeconfig_b64,omitempty"`
	AuthType      string `json:"auth_type"` // "token" | "kubeconfig" | "incluster"
	jwt.RegisteredClaims
}

func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing Authorization header"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid Authorization format, expected: Bearer <token>"})
			return
		}

		tokenStr := parts[1]
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		// Build k8s client from claims
		var client *k8sclient.ClientSet
		switch claims.AuthType {
		case "token":
			client, err = k8sclient.NewClientFromToken(claims.ServerURL, claims.Token, true)
		case "kubeconfig":
			client, err = k8sclient.NewClientFromKubeconfig(claims.KubeconfigB64)
		case "incluster":
			client, err = k8sclient.NewInClusterClient()
		default:
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unknown auth type"})
			return
		}

		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "failed to create k8s client: " + err.Error()})
			return
		}

		c.Set(ClientSetKey, client)
		c.Set("claims", claims)
		c.Next()
	}
}

func GetClient(c *gin.Context) *k8sclient.ClientSet {
	v, _ := c.Get(ClientSetKey)
	client, _ := v.(*k8sclient.ClientSet)
	return client
}
