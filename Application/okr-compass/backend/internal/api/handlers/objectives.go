package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/okr-compass/backend/internal/store"
)

type ObjectiveHandler struct {
	store *store.Store
}

func NewObjectiveHandler(st *store.Store) *ObjectiveHandler {
	return &ObjectiveHandler{store: st}
}

type objectiveRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	Owner       string `json:"owner"`
	Team        string `json:"team"`
	Quarter     string `json:"quarter"`
}

func (h *ObjectiveHandler) Create(c *gin.Context) {
	var req objectiveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	objective := &store.Objective{
		ID:          uuid.NewString(),
		Title:       req.Title,
		Description: req.Description,
		Owner:       req.Owner,
		Team:        req.Team,
		Quarter:     req.Quarter,
	}
	if err := h.store.CreateObjective(objective); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, objective)
}

func (h *ObjectiveHandler) List(c *gin.Context) {
	objectives, err := h.store.ListObjectives()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	for i := range objectives {
		keyResults, err := h.store.ListKeyResultsByObjective(objectives[i].ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		objectives[i].KeyResults = keyResults
	}
	c.JSON(http.StatusOK, objectives)
}

func (h *ObjectiveHandler) Get(c *gin.Context) {
	objective, err := h.store.GetObjective(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if objective == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "objective not found"})
		return
	}
	keyResults, err := h.store.ListKeyResultsByObjective(objective.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	objective.KeyResults = keyResults
	c.JSON(http.StatusOK, objective)
}

func (h *ObjectiveHandler) Update(c *gin.Context) {
	existing, err := h.store.GetObjective(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "objective not found"})
		return
	}

	var req objectiveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	existing.Title = req.Title
	existing.Description = req.Description
	existing.Owner = req.Owner
	existing.Team = req.Team
	existing.Quarter = req.Quarter

	if err := h.store.UpdateObjective(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, existing)
}

func (h *ObjectiveHandler) Delete(c *gin.Context) {
	if err := h.store.DeleteObjective(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
