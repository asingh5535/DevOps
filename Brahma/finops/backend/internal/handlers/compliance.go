package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"github.com/finops/backend/internal/k8s"
)

var requiredLabels = []string{"app", "team", "env", "cost-center"}

type DeploymentCompliance struct {
	Name          string            `json:"name"`
	Namespace     string            `json:"namespace"`
	Labels        map[string]string `json:"labels"`
	MissingLabels []string          `json:"missingLabels"`
	Compliant     bool              `json:"compliant"`
}

type ComplianceReport struct {
	Deployments      []DeploymentCompliance `json:"deployments"`
	TotalDeployments int                    `json:"totalDeployments"`
	Compliant        int                    `json:"compliant"`
	NonCompliant     int                    `json:"nonCompliant"`
	CompliancePct    float64                `json:"compliancePct"`
	RequiredLabels   []string               `json:"requiredLabels"`
}

func GetCompliance(clients *k8s.Clients) gin.HandlerFunc {
	return func(c *gin.Context) {
		depList, err := clients.Core.AppsV1().Deployments("").List(context.Background(), metav1.ListOptions{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		report := ComplianceReport{RequiredLabels: requiredLabels}

		for _, dep := range depList.Items {
			labels := dep.Labels
			if labels == nil {
				labels = map[string]string{}
			}

			var missing []string
			for _, req := range requiredLabels {
				if labels[req] == "" {
					missing = append(missing, req)
				}
			}

			dc := DeploymentCompliance{
				Name:          dep.Name,
				Namespace:     dep.Namespace,
				Labels:        labels,
				MissingLabels: missing,
				Compliant:     len(missing) == 0,
			}
			report.Deployments = append(report.Deployments, dc)
			report.TotalDeployments++
			if dc.Compliant {
				report.Compliant++
			} else {
				report.NonCompliant++
			}
		}

		if report.TotalDeployments > 0 {
			report.CompliancePct = roundPct(float64(report.Compliant) / float64(report.TotalDeployments) * 100)
		}

		c.JSON(http.StatusOK, report)
	}
}

func roundPct(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

