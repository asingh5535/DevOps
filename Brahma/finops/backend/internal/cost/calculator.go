package cost

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// Cloud pricing constants (per hour)
const (
	CPUCostPerCoreHour = 0.048   // $/vCPU-hour
	MemCostPerGBHour   = 0.006   // $/GB-hour
	HoursPerMonth      = 730.0
)

type ResourceCost struct {
	CPURequestCores float64 `json:"cpuRequestCores"`
	MemRequestGB    float64 `json:"memRequestGB"`
	CPULimitCores   float64 `json:"cpuLimitCores"`
	MemLimitGB      float64 `json:"memLimitGB"`
	HourlyCost      float64 `json:"hourlyCost"`
	MonthlyCost     float64 `json:"monthlyCost"`
}

type NamespaceCost struct {
	Namespace   string            `json:"namespace"`
	Labels      map[string]string `json:"labels"`
	Cost        ResourceCost      `json:"cost"`
	PodCount    int               `json:"podCount"`
}

type TeamCost struct {
	Team        string  `json:"team"`
	MonthlyCost float64 `json:"monthlyCost"`
	HourlyCost  float64 `json:"hourlyCost"`
	PodCount    int     `json:"podCount"`
}

type CostCenterCost struct {
	CostCenter  string  `json:"costCenter"`
	MonthlyCost float64 `json:"monthlyCost"`
	HourlyCost  float64 `json:"hourlyCost"`
}

type Summary struct {
	TotalMonthlyCost   float64          `json:"totalMonthlyCost"`
	TotalHourlyCost    float64          `json:"totalHourlyCost"`
	ByNamespace        []NamespaceCost  `json:"byNamespace"`
	ByTeam             []TeamCost       `json:"byTeam"`
	ByCostCenter       []CostCenterCost `json:"byCostCenter"`
	TotalPods          int              `json:"totalPods"`
	CompliantPods      int              `json:"compliantPods"`
	CompliancePercent  float64          `json:"compliancePercent"`
}

func resourceCostFromPod(pod corev1.Pod) ResourceCost {
	var cpuReq, memReq, cpuLim, memLim float64
	for _, c := range pod.Spec.Containers {
		cpuReq += float64(c.Resources.Requests.Cpu().MilliValue()) / 1000.0
		memReq += float64(c.Resources.Requests.Memory().Value()) / (1024 * 1024 * 1024)
		cpuLim += float64(c.Resources.Limits.Cpu().MilliValue()) / 1000.0
		memLim += float64(c.Resources.Limits.Memory().Value()) / (1024 * 1024 * 1024)
	}
	hourly := cpuReq*CPUCostPerCoreHour + memReq*MemCostPerGBHour
	return ResourceCost{
		CPURequestCores: round(cpuReq, 4),
		MemRequestGB:    round(memReq, 4),
		CPULimitCores:   round(cpuLim, 4),
		MemLimitGB:      round(memLim, 4),
		HourlyCost:      round(hourly, 6),
		MonthlyCost:     round(hourly*HoursPerMonth, 4),
	}
}

func CalculateSummary(ctx context.Context, client *kubernetes.Clientset) (*Summary, error) {
	pods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing pods: %w", err)
	}

	nsCosts := map[string]*NamespaceCost{}
	teamCosts := map[string]*TeamCost{}
	ccCosts := map[string]*CostCenterCost{}

	var totalHourly float64
	compliantPods := 0

	for _, pod := range pods.Items {
		if pod.Status.Phase != corev1.PodRunning {
			continue
		}
		rc := resourceCostFromPod(pod)
		ns := pod.Namespace
		labels := pod.Labels

		if _, ok := nsCosts[ns]; !ok {
			nsLabels := map[string]string{}
			if nsObj, err := client.CoreV1().Namespaces().Get(ctx, ns, metav1.GetOptions{}); err == nil {
				nsLabels = nsObj.Labels
			}
			nsCosts[ns] = &NamespaceCost{Namespace: ns, Labels: nsLabels}
		}
		nsCosts[ns].Cost.HourlyCost += rc.HourlyCost
		nsCosts[ns].Cost.MonthlyCost += rc.MonthlyCost
		nsCosts[ns].Cost.CPURequestCores += rc.CPURequestCores
		nsCosts[ns].Cost.MemRequestGB += rc.MemRequestGB
		nsCosts[ns].PodCount++

		team := labels["team"]
		if team == "" {
			team = "untagged"
		}
		if _, ok := teamCosts[team]; !ok {
			teamCosts[team] = &TeamCost{Team: team}
		}
		teamCosts[team].HourlyCost += rc.HourlyCost
		teamCosts[team].MonthlyCost += rc.MonthlyCost
		teamCosts[team].PodCount++

		cc := labels["cost-center"]
		if cc == "" {
			cc = "untagged"
		}
		if _, ok := ccCosts[cc]; !ok {
			ccCosts[cc] = &CostCenterCost{CostCenter: cc}
		}
		ccCosts[cc].HourlyCost += rc.HourlyCost
		ccCosts[cc].MonthlyCost += rc.MonthlyCost

		totalHourly += rc.HourlyCost

		hasRequiredLabels := labels["team"] != "" && labels["cost-center"] != "" &&
			labels["app"] != "" && labels["env"] != ""
		if hasRequiredLabels {
			compliantPods++
		}
	}

	summary := &Summary{
		TotalHourlyCost:  round(totalHourly, 6),
		TotalMonthlyCost: round(totalHourly*HoursPerMonth, 4),
		TotalPods:        len(pods.Items),
		CompliantPods:    compliantPods,
	}
	if summary.TotalPods > 0 {
		summary.CompliancePercent = round(float64(compliantPods)/float64(summary.TotalPods)*100, 2)
	}

	for _, v := range nsCosts {
		v.Cost.HourlyCost = round(v.Cost.HourlyCost, 6)
		v.Cost.MonthlyCost = round(v.Cost.MonthlyCost, 4)
		summary.ByNamespace = append(summary.ByNamespace, *v)
	}
	for _, v := range teamCosts {
		v.HourlyCost = round(v.HourlyCost, 6)
		v.MonthlyCost = round(v.MonthlyCost, 4)
		summary.ByTeam = append(summary.ByTeam, *v)
	}
	for _, v := range ccCosts {
		v.HourlyCost = round(v.HourlyCost, 6)
		v.MonthlyCost = round(v.MonthlyCost, 4)
		summary.ByCostCenter = append(summary.ByCostCenter, *v)
	}

	return summary, nil
}

func round(v float64, decimals int) float64 {
	pow := 1.0
	for i := 0; i < decimals; i++ {
		pow *= 10
	}
	return float64(int(v*pow+0.5)) / pow
}
