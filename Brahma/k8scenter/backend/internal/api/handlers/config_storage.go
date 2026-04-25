package handlers

import (
	"context"
	"encoding/base64"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kubevision/backend/internal/middleware"
	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ConfigStorageHandler struct{}

func NewConfigStorageHandler() *ConfigStorageHandler { return &ConfigStorageHandler{} }

// ─── ConfigMaps ───────────────────────────────────────────────────────────────

func (h *ConfigStorageHandler) ListConfigMaps(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.CoreV1().ConfigMaps(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ConfigStorageHandler) GetConfigMap(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.CoreV1().ConfigMaps(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *ConfigStorageHandler) CreateConfigMap(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[corev1.ConfigMap](c)
	if err != nil {
		return
	}
	created, err := client.Core.CoreV1().ConfigMaps(body.Namespace).
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *ConfigStorageHandler) UpdateConfigMap(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[corev1.ConfigMap](c)
	if err != nil {
		return
	}
	updated, err := client.Core.CoreV1().ConfigMaps(c.Param("namespace")).
		Update(context.Background(), body, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *ConfigStorageHandler) DeleteConfigMap(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.CoreV1().ConfigMaps(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── Secrets ──────────────────────────────────────────────────────────────────

func (h *ConfigStorageHandler) ListSecrets(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.CoreV1().Secrets(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Mask secret data for security - only show keys, not values
	for i := range list.Items {
		maskedData := make(map[string][]byte)
		for k := range list.Items[i].Data {
			maskedData[k] = []byte("[REDACTED]")
		}
		list.Items[i].Data = maskedData
	}
	c.JSON(http.StatusOK, list)
}

func (h *ConfigStorageHandler) GetSecret(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.CoreV1().Secrets(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	// Show keys only unless explicitly requested
	if c.Query("reveal") != "true" {
		for k := range obj.Data {
			obj.Data[k] = []byte("[REDACTED]")
		}
	}
	c.JSON(http.StatusOK, obj)
}

func (h *ConfigStorageHandler) RevealSecretKey(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.CoreV1().Secrets(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	key := c.Param("key")
	val, ok := obj.Data[key]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "key not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"key":   key,
		"value": base64.StdEncoding.EncodeToString(val),
		"raw":   string(val),
	})
}

func (h *ConfigStorageHandler) CreateSecret(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[corev1.Secret](c)
	if err != nil {
		return
	}
	created, err := client.Core.CoreV1().Secrets(body.Namespace).
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Mask data in response
	for k := range created.Data {
		created.Data[k] = []byte("[REDACTED]")
	}
	c.JSON(http.StatusCreated, created)
}

func (h *ConfigStorageHandler) UpdateSecret(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[corev1.Secret](c)
	if err != nil {
		return
	}
	updated, err := client.Core.CoreV1().Secrets(c.Param("namespace")).
		Update(context.Background(), body, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	for k := range updated.Data {
		updated.Data[k] = []byte("[REDACTED]")
	}
	c.JSON(http.StatusOK, updated)
}

func (h *ConfigStorageHandler) DeleteSecret(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.CoreV1().Secrets(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── PersistentVolumes ────────────────────────────────────────────────────────

func (h *ConfigStorageHandler) ListPVs(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.CoreV1().PersistentVolumes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ConfigStorageHandler) GetPV(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.CoreV1().PersistentVolumes().
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *ConfigStorageHandler) DeletePV(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.CoreV1().PersistentVolumes().
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── PersistentVolumeClaims ───────────────────────────────────────────────────

func (h *ConfigStorageHandler) ListPVCs(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.CoreV1().PersistentVolumeClaims(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ConfigStorageHandler) GetPVC(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.CoreV1().PersistentVolumeClaims(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *ConfigStorageHandler) CreatePVC(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[corev1.PersistentVolumeClaim](c)
	if err != nil {
		return
	}
	created, err := client.Core.CoreV1().PersistentVolumeClaims(body.Namespace).
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *ConfigStorageHandler) DeletePVC(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.CoreV1().PersistentVolumeClaims(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── StorageClasses ───────────────────────────────────────────────────────────

func (h *ConfigStorageHandler) ListStorageClasses(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.StorageV1().StorageClasses().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ConfigStorageHandler) GetStorageClass(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.StorageV1().StorageClasses().
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *ConfigStorageHandler) CreateStorageClass(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[storagev1.StorageClass](c)
	if err != nil {
		return
	}
	created, err := client.Core.StorageV1().StorageClasses().
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *ConfigStorageHandler) DeleteStorageClass(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.StorageV1().StorageClasses().
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
