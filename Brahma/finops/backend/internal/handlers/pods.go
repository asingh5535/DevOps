package handlers

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"github.com/finops/backend/internal/k8s"
)

type PodInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Phase       string            `json:"phase"`
	Labels      map[string]string `json:"labels"`
	Node        string            `json:"node"`
	CPURequest  string            `json:"cpuRequest"`
	MemRequest  string            `json:"memRequest"`
	CPULimit    string            `json:"cpuLimit"`
	MemLimit    string            `json:"memLimit"`
	Compliant   bool              `json:"compliant"`
}

func GetPods(clients *k8s.Clients) gin.HandlerFunc {
	return func(c *gin.Context) {
		ns := c.Query("namespace")
		podList, err := clients.Core.CoreV1().Pods(ns).List(context.Background(), metav1.ListOptions{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var result []PodInfo
		for _, pod := range podList.Items {
			labels := pod.Labels
			if labels == nil {
				labels = map[string]string{}
			}

			var cpuReq, memReq, cpuLim, memLim int64
			for _, c := range pod.Spec.Containers {
				cpuReq += c.Resources.Requests.Cpu().MilliValue()
				memReq += c.Resources.Requests.Memory().Value() / (1024 * 1024)
				cpuLim += c.Resources.Limits.Cpu().MilliValue()
				memLim += c.Resources.Limits.Memory().Value() / (1024 * 1024)
			}

			compliant := labels["team"] != "" && labels["cost-center"] != "" &&
				labels["app"] != "" && labels["env"] != ""

			result = append(result, PodInfo{
				Name:       pod.Name,
				Namespace:  pod.Namespace,
				Phase:      string(pod.Status.Phase),
				Labels:     labels,
				Node:       pod.Spec.NodeName,
				CPURequest: formatMilliCPU(cpuReq),
				MemRequest: formatMi(memReq),
				CPULimit:   formatMilliCPU(cpuLim),
				MemLimit:   formatMi(memLim),
				Compliant:  compliant,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"pods":  result,
			"total": len(result),
		})
	}
}

func formatMilliCPU(m int64) string {
	if m == 0 {
		return "0m"
	}
	if m >= 1000 {
		return fmt.Sprintf("%.2f", float64(m)/1000.0)
	}
	return fmt.Sprintf("%dm", m)
}

func formatMi(mi int64) string {
	if mi == 0 {
		return "0Mi"
	}
	if mi >= 1024 {
		return fmt.Sprintf("%.1fGi", float64(mi)/1024.0)
	}
	return fmt.Sprintf("%dMi", mi)
}
