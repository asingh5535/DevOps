package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/okr-compass/backend/internal/scheduler"
	"github.com/okr-compass/backend/internal/store"
)

type KeyResultHandler struct {
	store     *store.Store
	evaluator *scheduler.Evaluator
}

func NewKeyResultHandler(st *store.Store, evaluator *scheduler.Evaluator) *KeyResultHandler {
	return &KeyResultHandler{store: st, evaluator: evaluator}
}

type keyResultRequest struct {
	Title         string  `json:"title" binding:"required"`
	ClusterID     string  `json:"clusterId" binding:"required"`
	MetricKey     string  `json:"metricKey" binding:"required"`
	Comparator    string  `json:"comparator" binding:"required,oneof=lt lte gt gte"`
	BaselineValue float64 `json:"baselineValue"`
	TargetValue   float64 `json:"targetValue"`
	Unit          string  `json:"unit"`
}

func (h *KeyResultHandler) Create(c *gin.Context) {
	objectiveID := c.Param("id")
	objective, err := h.store.GetObjective(objectiveID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if objective == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "objective not found"})
		return
	}

	var req keyResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	kr := &store.KeyResult{
		ID:            uuid.NewString(),
		ObjectiveID:   objectiveID,
		Title:         req.Title,
		ClusterID:     req.ClusterID,
		MetricKey:     req.MetricKey,
		Comparator:    req.Comparator,
		BaselineValue: req.BaselineValue,
		TargetValue:   req.TargetValue,
		Unit:          req.Unit,
	}
	if err := h.store.CreateKeyResult(kr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Best-effort first reading so the UI doesn't show a blank KR until the next tick.
	_ = h.evaluator.EvaluateOne(c.Request.Context(), kr)

	saved, err := h.store.GetKeyResult(kr.ID)
	if err != nil || saved == nil {
		c.JSON(http.StatusCreated, kr)
		return
	}
	c.JSON(http.StatusCreated, saved)
}

func (h *KeyResultHandler) Delete(c *gin.Context) {
	if err := h.store.DeleteKeyResult(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *KeyResultHandler) Evaluate(c *gin.Context) {
	kr, err := h.store.GetKeyResult(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if kr == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "key result not found"})
		return
	}

	if err := h.evaluator.EvaluateOne(c.Request.Context(), kr); err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
		return
	}

	updated, err := h.store.GetKeyResult(kr.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *KeyResultHandler) History(c *gin.Context) {
	samples, err := h.store.ListMetricSamples(c.Param("id"), 200)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, samples)
}
