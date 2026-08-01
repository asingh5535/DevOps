package handlers

import (
	"net/http"
	"sort"

	"github.com/gin-gonic/gin"

	"github.com/okr-compass/backend/internal/store"
)

type DashboardHandler struct {
	store *store.Store
}

func NewDashboardHandler(st *store.Store) *DashboardHandler {
	return &DashboardHandler{store: st}
}

type teamQuarterGroup struct {
	Team            string  `json:"team"`
	Quarter         string  `json:"quarter"`
	ObjectiveCount  int     `json:"objectiveCount"`
	KeyResultCount  int     `json:"keyResultCount"`
	AverageProgress float64 `json:"averageProgress"`
}

type atRiskKeyResult struct {
	store.KeyResult
	ObjectiveTitle string `json:"objectiveTitle"`
	Team           string `json:"team"`
	Quarter        string `json:"quarter"`
}

const atRiskThreshold = 40.0

func (h *DashboardHandler) Summary(c *gin.Context) {
	objectives, err := h.store.ListObjectives()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	groups := map[string]*teamQuarterGroup{}
	var totalProgress float64
	var totalKeyResults int
	var atRisk []atRiskKeyResult

	for _, o := range objectives {
		keyResults, err := h.store.ListKeyResultsByObjective(o.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		groupKey := o.Team + "|" + o.Quarter
		g, ok := groups[groupKey]
		if !ok {
			g = &teamQuarterGroup{Team: o.Team, Quarter: o.Quarter}
			groups[groupKey] = g
		}
		g.ObjectiveCount++

		for _, kr := range keyResults {
			g.KeyResultCount++
			g.AverageProgress += kr.Progress
			totalProgress += kr.Progress
			totalKeyResults++

			if kr.Progress < atRiskThreshold {
				atRisk = append(atRisk, atRiskKeyResult{
					KeyResult:      kr,
					ObjectiveTitle: o.Title,
					Team:           o.Team,
					Quarter:        o.Quarter,
				})
			}
		}
	}

	groupList := make([]teamQuarterGroup, 0, len(groups))
	for _, g := range groups {
		if g.KeyResultCount > 0 {
			g.AverageProgress /= float64(g.KeyResultCount)
		}
		groupList = append(groupList, *g)
	}
	sort.Slice(groupList, func(i, j int) bool {
		if groupList[i].Quarter != groupList[j].Quarter {
			return groupList[i].Quarter > groupList[j].Quarter
		}
		return groupList[i].Team < groupList[j].Team
	})

	sort.Slice(atRisk, func(i, j int) bool { return atRisk[i].Progress < atRisk[j].Progress })
	if len(atRisk) > 10 {
		atRisk = atRisk[:10]
	}

	overallProgress := 0.0
	if totalKeyResults > 0 {
		overallProgress = totalProgress / float64(totalKeyResults)
	}

	c.JSON(http.StatusOK, gin.H{
		"objectiveCount":   len(objectives),
		"keyResultCount":   totalKeyResults,
		"overallProgress":  overallProgress,
		"teamQuarterGroups": groupList,
		"atRiskKeyResults": atRisk,
	})
}
