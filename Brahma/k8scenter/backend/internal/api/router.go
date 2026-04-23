package api

import (
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/kubevision/backend/internal/api/handlers"
	"github.com/kubevision/backend/internal/config"
	"github.com/kubevision/backend/internal/middleware"
)

func NewRouter(cfg *config.Config) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           86400,
	}))

	// Health
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "kubevision-api"})
	})

	// Handlers
	authH := handlers.NewAuthHandler(cfg.JWTSecret)
	clusterH := handlers.NewClusterHandler()
	workloadH := handlers.NewWorkloadHandler()
	serviceH := handlers.NewServiceHandler()
	configH := handlers.NewConfigStorageHandler()
	rbacH := handlers.NewRBACHandler()
	crdH := handlers.NewCRDHandler()
	eventH := handlers.NewEventHandler()
	logH := handlers.NewLogHandler()
	execH := handlers.NewExecHandler()

	// ── Public routes ──────────────────────────────────────────────────────────
	pub := r.Group("/api")
	{
		pub.POST("/auth/login", authH.Login)
	}

	// ── Protected routes ───────────────────────────────────────────────────────
	api := r.Group("/api", middleware.Auth(cfg.JWTSecret))
	{
		// Auth verify
		api.GET("/auth/verify", authH.Verify)

		// ── Cluster ──────────────────────────────────────────────────────────
		api.GET("/cluster/overview", clusterH.Overview)

		// Namespaces
		api.GET("/namespaces", clusterH.ListNamespaces)
		api.GET("/namespaces/:name", clusterH.GetNamespace)

		// Nodes
		api.GET("/nodes", clusterH.ListNodes)
		api.GET("/nodes/:name", clusterH.GetNode)

		// ── Workloads ─────────────────────────────────────────────────────────

		// Deployments
		api.GET("/deployments", workloadH.ListDeployments)
		api.GET("/deployments/:namespace/:name", workloadH.GetDeployment)
		api.POST("/deployments", workloadH.CreateDeployment)
		api.PUT("/deployments/:namespace/:name", workloadH.UpdateDeployment)
		api.DELETE("/deployments/:namespace/:name", workloadH.DeleteDeployment)
		api.POST("/deployments/:namespace/:name/scale", workloadH.ScaleDeployment)
		api.POST("/deployments/:namespace/:name/restart", workloadH.RestartDeployment)

		// StatefulSets
		api.GET("/statefulsets", workloadH.ListStatefulSets)
		api.GET("/statefulsets/:namespace/:name", workloadH.GetStatefulSet)
		api.PUT("/statefulsets/:namespace/:name", workloadH.UpdateStatefulSet)
		api.DELETE("/statefulsets/:namespace/:name", workloadH.DeleteStatefulSet)

		// DaemonSets
		api.GET("/daemonsets", workloadH.ListDaemonSets)
		api.GET("/daemonsets/:namespace/:name", workloadH.GetDaemonSet)
		api.DELETE("/daemonsets/:namespace/:name", workloadH.DeleteDaemonSet)

		// ReplicaSets
		api.GET("/replicasets", workloadH.ListReplicaSets)

		// Pods
		api.GET("/pods", workloadH.ListPods)
		api.GET("/pods/:namespace/:name", workloadH.GetPod)
		api.DELETE("/pods/:namespace/:name", workloadH.DeletePod)
		api.GET("/pods/:namespace/:name/containers", workloadH.ListPodContainers)

		// Jobs
		api.GET("/jobs", workloadH.ListJobs)
		api.GET("/jobs/:namespace/:name", workloadH.GetJob)
		api.POST("/jobs", workloadH.CreateJob)
		api.DELETE("/jobs/:namespace/:name", workloadH.DeleteJob)

		// CronJobs
		api.GET("/cronjobs", workloadH.ListCronJobs)
		api.GET("/cronjobs/:namespace/:name", workloadH.GetCronJob)
		api.PUT("/cronjobs/:namespace/:name", workloadH.UpdateCronJob)
		api.DELETE("/cronjobs/:namespace/:name", workloadH.DeleteCronJob)

		// Generic YAML apply
		api.POST("/apply", workloadH.ApplyYAML)

		// ── Services & Networking ─────────────────────────────────────────────

		api.GET("/services", serviceH.ListServices)
		api.GET("/services/:namespace/:name", serviceH.GetService)
		api.POST("/services", serviceH.CreateService)
		api.PUT("/services/:namespace/:name", serviceH.UpdateService)
		api.DELETE("/services/:namespace/:name", serviceH.DeleteService)

		api.GET("/endpoints", serviceH.ListEndpoints)

		api.GET("/ingresses", serviceH.ListIngresses)
		api.GET("/ingresses/:namespace/:name", serviceH.GetIngress)
		api.POST("/ingresses", serviceH.CreateIngress)
		api.PUT("/ingresses/:namespace/:name", serviceH.UpdateIngress)
		api.DELETE("/ingresses/:namespace/:name", serviceH.DeleteIngress)

		api.GET("/networkpolicies", serviceH.ListNetworkPolicies)
		api.GET("/networkpolicies/:namespace/:name", serviceH.GetNetworkPolicy)
		api.DELETE("/networkpolicies/:namespace/:name", serviceH.DeleteNetworkPolicy)

		api.GET("/ingressclasses", serviceH.ListIngressClasses)

		// ── Config & Storage ──────────────────────────────────────────────────

		api.GET("/configmaps", configH.ListConfigMaps)
		api.GET("/configmaps/:namespace/:name", configH.GetConfigMap)
		api.POST("/configmaps", configH.CreateConfigMap)
		api.PUT("/configmaps/:namespace/:name", configH.UpdateConfigMap)
		api.DELETE("/configmaps/:namespace/:name", configH.DeleteConfigMap)

		api.GET("/secrets", configH.ListSecrets)
		api.GET("/secrets/:namespace/:name", configH.GetSecret)
		api.GET("/secrets/:namespace/:name/keys/:key", configH.RevealSecretKey)
		api.POST("/secrets", configH.CreateSecret)
		api.PUT("/secrets/:namespace/:name", configH.UpdateSecret)
		api.DELETE("/secrets/:namespace/:name", configH.DeleteSecret)

		api.GET("/persistentvolumes", configH.ListPVs)
		api.GET("/persistentvolumes/:name", configH.GetPV)
		api.DELETE("/persistentvolumes/:name", configH.DeletePV)

		api.GET("/persistentvolumeclaims", configH.ListPVCs)
		api.GET("/persistentvolumeclaims/:namespace/:name", configH.GetPVC)
		api.POST("/persistentvolumeclaims", configH.CreatePVC)
		api.DELETE("/persistentvolumeclaims/:namespace/:name", configH.DeletePVC)

		api.GET("/storageclasses", configH.ListStorageClasses)
		api.GET("/storageclasses/:name", configH.GetStorageClass)
		api.POST("/storageclasses", configH.CreateStorageClass)
		api.DELETE("/storageclasses/:name", configH.DeleteStorageClass)

		// ── RBAC ─────────────────────────────────────────────────────────────

		api.GET("/clusterroles", rbacH.ListClusterRoles)
		api.GET("/clusterroles/:name", rbacH.GetClusterRole)
		api.POST("/clusterroles", rbacH.CreateClusterRole)
		api.PUT("/clusterroles/:name", rbacH.UpdateClusterRole)
		api.DELETE("/clusterroles/:name", rbacH.DeleteClusterRole)

		api.GET("/roles", rbacH.ListRoles)
		api.GET("/roles/:namespace/:name", rbacH.GetRole)
		api.POST("/roles", rbacH.CreateRole)
		api.PUT("/roles/:namespace/:name", rbacH.UpdateRole)
		api.DELETE("/roles/:namespace/:name", rbacH.DeleteRole)

		api.GET("/clusterrolebindings", rbacH.ListClusterRoleBindings)
		api.GET("/clusterrolebindings/:name", rbacH.GetClusterRoleBinding)
		api.POST("/clusterrolebindings", rbacH.CreateClusterRoleBinding)
		api.DELETE("/clusterrolebindings/:name", rbacH.DeleteClusterRoleBinding)

		api.GET("/rolebindings", rbacH.ListRoleBindings)
		api.GET("/rolebindings/:namespace/:name", rbacH.GetRoleBinding)
		api.POST("/rolebindings", rbacH.CreateRoleBinding)
		api.DELETE("/rolebindings/:namespace/:name", rbacH.DeleteRoleBinding)

		api.GET("/serviceaccounts", rbacH.ListServiceAccounts)
		api.GET("/serviceaccounts/:namespace/:name", rbacH.GetServiceAccount)
		api.POST("/serviceaccounts", rbacH.CreateServiceAccount)
		api.DELETE("/serviceaccounts/:namespace/:name", rbacH.DeleteServiceAccount)

		// ── CRDs ─────────────────────────────────────────────────────────────

		api.GET("/crds", crdH.ListCRDs)
		api.GET("/crds/:name", crdH.GetCRD)
		api.POST("/crds", crdH.CreateCRD)
		api.DELETE("/crds/:name", crdH.DeleteCRD)

		// Custom resource instances
		api.GET("/cr/:group/:version/:resource", crdH.ListCustomResources)
		api.GET("/cr/:group/:version/:resource/:namespace/:name", crdH.GetCustomResource)
		api.DELETE("/cr/:group/:version/:resource/:namespace/:name", crdH.DeleteCustomResource)

		// ── Events ───────────────────────────────────────────────────────────

		api.GET("/events", eventH.ListEvents)
		api.GET("/events/:namespace", eventH.ListEventsForResource)

		// ── Logs (REST + WebSocket) ───────────────────────────────────────────

		api.GET("/pods/:namespace/:name/logs", logH.GetLogs)
		api.GET("/pods/:namespace/:name/logs/stream", logH.StreamLogs)

		// ── Exec ─────────────────────────────────────────────────────────────

		api.GET("/pods/:namespace/:name/exec", execH.ExecPod)
	}

	return r
}
