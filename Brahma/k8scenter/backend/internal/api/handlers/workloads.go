package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kubevision/backend/internal/middleware"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/yaml"
)

type WorkloadHandler struct{}

func NewWorkloadHandler() *WorkloadHandler { return &WorkloadHandler{} }

func ns(c *gin.Context) string {
	if n := c.Query("namespace"); n != "" {
		return n
	}
	return ""
}

// ─── Deployments ─────────────────────────────────────────────────────────────

func (h *WorkloadHandler) ListDeployments(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.AppsV1().Deployments(ns(c)).List(context.Background(), metav1.ListOptions{
		LabelSelector: c.Query("labelSelector"),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *WorkloadHandler) GetDeployment(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.AppsV1().Deployments(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *WorkloadHandler) CreateDeployment(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[appsv1.Deployment](c)
	if err != nil {
		return
	}
	created, err := client.Core.AppsV1().Deployments(body.Namespace).
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *WorkloadHandler) UpdateDeployment(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[appsv1.Deployment](c)
	if err != nil {
		return
	}
	updated, err := client.Core.AppsV1().Deployments(c.Param("namespace")).
		Update(context.Background(), body, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *WorkloadHandler) ApplyDeploymentYAML(c *gin.Context) {
	client := middleware.GetClient(c)
	data, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	jsonData, err := yaml.YAMLToJSON(data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid YAML: " + err.Error()})
		return
	}
	result, err := client.Core.AppsV1().Deployments(c.Param("namespace")).
		Patch(context.Background(), c.Param("name"), types.ApplyPatchType, jsonData,
			metav1.PatchOptions{FieldManager: "kubevision"})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *WorkloadHandler) DeleteDeployment(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.AppsV1().Deployments(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *WorkloadHandler) ScaleDeployment(c *gin.Context) {
	client := middleware.GetClient(c)
	var body struct {
		Replicas int32 `json:"replicas"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	patch := map[string]interface{}{
		"spec": map[string]interface{}{
			"replicas": body.Replicas,
		},
	}
	patchBytes, _ := json.Marshal(patch)
	result, err := client.Core.AppsV1().Deployments(c.Param("namespace")).
		Patch(context.Background(), c.Param("name"), types.MergePatchType, patchBytes, metav1.PatchOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *WorkloadHandler) RestartDeployment(c *gin.Context) {
	client := middleware.GetClient(c)
	patch := []byte(`{"spec":{"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"` + metav1.Now().UTC().Format("2006-01-02T15:04:05Z") + `"}}}}}`)
	result, err := client.Core.AppsV1().Deployments(c.Param("namespace")).
		Patch(context.Background(), c.Param("name"), types.MergePatchType, patch, metav1.PatchOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ─── StatefulSets ─────────────────────────────────────────────────────────────

func (h *WorkloadHandler) ListStatefulSets(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.AppsV1().StatefulSets(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *WorkloadHandler) GetStatefulSet(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.AppsV1().StatefulSets(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *WorkloadHandler) DeleteStatefulSet(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.AppsV1().StatefulSets(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *WorkloadHandler) UpdateStatefulSet(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[appsv1.StatefulSet](c)
	if err != nil {
		return
	}
	updated, err := client.Core.AppsV1().StatefulSets(c.Param("namespace")).
		Update(context.Background(), body, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// ─── DaemonSets ────────────────────────────────────────────────────────────────

func (h *WorkloadHandler) ListDaemonSets(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.AppsV1().DaemonSets(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *WorkloadHandler) GetDaemonSet(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.AppsV1().DaemonSets(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *WorkloadHandler) DeleteDaemonSet(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.AppsV1().DaemonSets(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── ReplicaSets ───────────────────────────────────────────────────────────────

func (h *WorkloadHandler) ListReplicaSets(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.AppsV1().ReplicaSets(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// ─── Pods ──────────────────────────────────────────────────────────────────────

func (h *WorkloadHandler) ListPods(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.CoreV1().Pods(ns(c)).List(context.Background(), metav1.ListOptions{
		LabelSelector: c.Query("labelSelector"),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *WorkloadHandler) GetPod(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.CoreV1().Pods(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *WorkloadHandler) DeletePod(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.CoreV1().Pods(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *WorkloadHandler) ListPodContainers(c *gin.Context) {
	client := middleware.GetClient(c)
	pod, err := client.Core.CoreV1().Pods(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	containers := make([]string, 0, len(pod.Spec.Containers)+len(pod.Spec.InitContainers))
	for _, ct := range pod.Spec.InitContainers {
		containers = append(containers, ct.Name)
	}
	for _, ct := range pod.Spec.Containers {
		containers = append(containers, ct.Name)
	}
	c.JSON(http.StatusOK, gin.H{"containers": containers})
}

// ─── Jobs ──────────────────────────────────────────────────────────────────────

func (h *WorkloadHandler) ListJobs(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.BatchV1().Jobs(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *WorkloadHandler) GetJob(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.BatchV1().Jobs(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *WorkloadHandler) DeleteJob(c *gin.Context) {
	client := middleware.GetClient(c)
	propagation := metav1.DeletePropagationBackground
	err := client.Core.BatchV1().Jobs(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{
			PropagationPolicy: &propagation,
		})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *WorkloadHandler) CreateJob(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[batchv1.Job](c)
	if err != nil {
		return
	}
	created, err := client.Core.BatchV1().Jobs(body.Namespace).
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

// ─── CronJobs ─────────────────────────────────────────────────────────────────

func (h *WorkloadHandler) ListCronJobs(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.BatchV1().CronJobs(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *WorkloadHandler) GetCronJob(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.BatchV1().CronJobs(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *WorkloadHandler) DeleteCronJob(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.BatchV1().CronJobs(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *WorkloadHandler) UpdateCronJob(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[batchv1.CronJob](c)
	if err != nil {
		return
	}
	updated, err := client.Core.BatchV1().CronJobs(c.Param("namespace")).
		Update(context.Background(), body, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// ─── Apply YAML (generic for workloads) ───────────────────────────────────────

func (h *WorkloadHandler) ApplyYAML(c *gin.Context) {
	client := middleware.GetClient(c)
	rawBody, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse to discover kind
	var meta struct {
		Kind       string `json:"kind"`
		APIVersion string `json:"apiVersion"`
		Metadata   struct {
			Namespace string `json:"namespace"`
			Name      string `json:"name"`
		} `json:"metadata"`
	}

	jsonData, err := yaml.YAMLToJSON(rawBody)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid YAML: " + err.Error()})
		return
	}

	if err := json.Unmarshal(jsonData, &meta); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot parse resource: " + err.Error()})
		return
	}

	namespace := meta.Metadata.Namespace
	name := meta.Metadata.Name

	var result interface{}

	switch meta.Kind {
	case "Deployment":
		result, err = client.Core.AppsV1().Deployments(namespace).
			Patch(context.Background(), name, types.ApplyPatchType, jsonData,
				metav1.PatchOptions{FieldManager: "kubevision", Force: boolPtr(true)})
	case "StatefulSet":
		result, err = client.Core.AppsV1().StatefulSets(namespace).
			Patch(context.Background(), name, types.ApplyPatchType, jsonData,
				metav1.PatchOptions{FieldManager: "kubevision", Force: boolPtr(true)})
	case "DaemonSet":
		result, err = client.Core.AppsV1().DaemonSets(namespace).
			Patch(context.Background(), name, types.ApplyPatchType, jsonData,
				metav1.PatchOptions{FieldManager: "kubevision", Force: boolPtr(true)})
	case "Job":
		result, err = client.Core.BatchV1().Jobs(namespace).
			Patch(context.Background(), name, types.ApplyPatchType, jsonData,
				metav1.PatchOptions{FieldManager: "kubevision", Force: boolPtr(true)})
	case "CronJob":
		result, err = client.Core.BatchV1().CronJobs(namespace).
			Patch(context.Background(), name, types.ApplyPatchType, jsonData,
				metav1.PatchOptions{FieldManager: "kubevision", Force: boolPtr(true)})
	case "Pod":
		var pod corev1.Pod
		if jerr := json.Unmarshal(jsonData, &pod); jerr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": jerr.Error()})
			return
		}
		result, err = client.Core.CoreV1().Pods(namespace).Create(context.Background(), &pod, metav1.CreateOptions{})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported kind: " + meta.Kind})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

func parseBody[T any](c *gin.Context) (*T, error) {
	raw, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return nil, err
	}
	jsonData, err := yaml.YAMLToJSON(raw)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid YAML/JSON: " + err.Error()})
		return nil, err
	}
	var obj T
	if err := json.Unmarshal(jsonData, &obj); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot parse body: " + err.Error()})
		return nil, err
	}
	return &obj, nil
}

func boolPtr(b bool) *bool { return &b }
