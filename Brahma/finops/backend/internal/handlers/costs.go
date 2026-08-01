package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/finops/backend/internal/cost"
	"github.com/finops/backend/internal/k8s"
)

func GetCostSummary(clients *k8s.Clients) gin.HandlerFunc {
	return func(c *gin.Context) {
		summary, err := cost.CalculateSummary(c.Request.Context(), clients.Core)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, summary)
	}
}

func GetQuotas(clients *k8s.Clients) gin.HandlerFunc {
	return func(c *gin.Context) {
		ns := c.Query("namespace")
		quotaList, err := clients.Core.CoreV1().ResourceQuotas(ns).List(c.Request.Context(), listOptions())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		type QuotaStatus struct {
			Name      string            `json:"name"`
			Namespace string            `json:"namespace"`
			Hard      map[string]string `json:"hard"`
			Used      map[string]string `json:"used"`
		}

		var quotas []QuotaStatus
		for _, q := range quotaList.Items {
			hard := map[string]string{}
			used := map[string]string{}
			for k, v := range q.Status.Hard {
				hard[string(k)] = v.String()
			}
			for k, v := range q.Status.Used {
				used[string(k)] = v.String()
			}
			quotas = append(quotas, QuotaStatus{
				Name:      q.Name,
				Namespace: q.Namespace,
				Hard:      hard,
				Used:      used,
			})
		}

		c.JSON(http.StatusOK, gin.H{"quotas": quotas, "total": len(quotas)})
	}
}
