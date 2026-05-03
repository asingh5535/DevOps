package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"github.com/finops/backend/internal/k8s"
)

type NamespaceInfo struct {
	Name        string            `json:"name"`
	Labels      map[string]string `json:"labels"`
	Phase       string            `json:"phase"`
	HasTeam     bool              `json:"hasTeam"`
	HasCostCenter bool            `json:"hasCostCenter"`
	HasEnv      bool              `json:"hasEnv"`
	Compliant   bool              `json:"compliant"`
}

func GetNamespaces(clients *k8s.Clients) gin.HandlerFunc {
	return func(c *gin.Context) {
		nsList, err := clients.Core.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var result []NamespaceInfo
		for _, ns := range nsList.Items {
			labels := ns.Labels
			if labels == nil {
				labels = map[string]string{}
			}
			info := NamespaceInfo{
				Name:          ns.Name,
				Labels:        labels,
				Phase:         string(ns.Status.Phase),
				HasTeam:       labels["team"] != "",
				HasCostCenter: labels["cost-center"] != "",
				HasEnv:        labels["env"] != "",
			}
			info.Compliant = info.HasTeam && info.HasCostCenter && info.HasEnv
			result = append(result, info)
		}

		c.JSON(http.StatusOK, gin.H{
			"namespaces": result,
			"total":      len(result),
		})
	}
}
