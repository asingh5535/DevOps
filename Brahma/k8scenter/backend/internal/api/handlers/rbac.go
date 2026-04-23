package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kubevision/backend/internal/middleware"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type RBACHandler struct{}

func NewRBACHandler() *RBACHandler { return &RBACHandler{} }

// ─── ClusterRoles ─────────────────────────────────────────────────────────────

func (h *RBACHandler) ListClusterRoles(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.RbacV1().ClusterRoles().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *RBACHandler) GetClusterRole(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.RbacV1().ClusterRoles().
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *RBACHandler) CreateClusterRole(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[rbacv1.ClusterRole](c)
	if err != nil {
		return
	}
	created, err := client.Core.RbacV1().ClusterRoles().
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *RBACHandler) UpdateClusterRole(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[rbacv1.ClusterRole](c)
	if err != nil {
		return
	}
	updated, err := client.Core.RbacV1().ClusterRoles().
		Update(context.Background(), body, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *RBACHandler) DeleteClusterRole(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.RbacV1().ClusterRoles().
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── Roles ────────────────────────────────────────────────────────────────────

func (h *RBACHandler) ListRoles(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.RbacV1().Roles(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *RBACHandler) GetRole(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.RbacV1().Roles(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *RBACHandler) CreateRole(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[rbacv1.Role](c)
	if err != nil {
		return
	}
	created, err := client.Core.RbacV1().Roles(body.Namespace).
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *RBACHandler) UpdateRole(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[rbacv1.Role](c)
	if err != nil {
		return
	}
	updated, err := client.Core.RbacV1().Roles(c.Param("namespace")).
		Update(context.Background(), body, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *RBACHandler) DeleteRole(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.RbacV1().Roles(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── ClusterRoleBindings ──────────────────────────────────────────────────────

func (h *RBACHandler) ListClusterRoleBindings(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.RbacV1().ClusterRoleBindings().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *RBACHandler) GetClusterRoleBinding(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.RbacV1().ClusterRoleBindings().
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *RBACHandler) CreateClusterRoleBinding(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[rbacv1.ClusterRoleBinding](c)
	if err != nil {
		return
	}
	created, err := client.Core.RbacV1().ClusterRoleBindings().
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *RBACHandler) DeleteClusterRoleBinding(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.RbacV1().ClusterRoleBindings().
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── RoleBindings ─────────────────────────────────────────────────────────────

func (h *RBACHandler) ListRoleBindings(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.RbacV1().RoleBindings(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *RBACHandler) GetRoleBinding(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.RbacV1().RoleBindings(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *RBACHandler) CreateRoleBinding(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[rbacv1.RoleBinding](c)
	if err != nil {
		return
	}
	created, err := client.Core.RbacV1().RoleBindings(body.Namespace).
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *RBACHandler) DeleteRoleBinding(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.RbacV1().RoleBindings(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── ServiceAccounts ──────────────────────────────────────────────────────────

func (h *RBACHandler) ListServiceAccounts(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Core.CoreV1().ServiceAccounts(ns(c)).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *RBACHandler) GetServiceAccount(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Core.CoreV1().ServiceAccounts(c.Param("namespace")).
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *RBACHandler) CreateServiceAccount(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[corev1.ServiceAccount](c)
	if err != nil {
		return
	}
	created, err := client.Core.CoreV1().ServiceAccounts(body.Namespace).
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *RBACHandler) DeleteServiceAccount(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Core.CoreV1().ServiceAccounts(c.Param("namespace")).
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
