package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kubevision/backend/internal/middleware"
)

type CRDHandler struct{}

func NewCRDHandler() *CRDHandler { return &CRDHandler{} }

func (h *CRDHandler) ListCRDs(c *gin.Context) {
	client := middleware.GetClient(c)
	list, err := client.Extensions.ApiextensionsV1().CustomResourceDefinitions().
		List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *CRDHandler) GetCRD(c *gin.Context) {
	client := middleware.GetClient(c)
	obj, err := client.Extensions.ApiextensionsV1().CustomResourceDefinitions().
		Get(context.Background(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, obj)
}

func (h *CRDHandler) CreateCRD(c *gin.Context) {
	client := middleware.GetClient(c)
	body, err := parseBody[apiextensionsv1.CustomResourceDefinition](c)
	if err != nil {
		return
	}
	created, err := client.Extensions.ApiextensionsV1().CustomResourceDefinitions().
		Create(context.Background(), body, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *CRDHandler) DeleteCRD(c *gin.Context) {
	client := middleware.GetClient(c)
	err := client.Extensions.ApiextensionsV1().CustomResourceDefinitions().
		Delete(context.Background(), c.Param("name"), metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ListCustomResources lists instances of a given CRD
func (h *CRDHandler) ListCustomResources(c *gin.Context) {
	client := middleware.GetClient(c)
	group := c.Param("group")
	version := c.Param("version")
	resource := c.Param("resource")
	namespace := c.Query("namespace")

	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	var list interface{}
	var err error

	if namespace != "" {
		list, err = client.Dynamic.Resource(gvr).Namespace(namespace).
			List(context.Background(), metav1.ListOptions{})
	} else {
		list, err = client.Dynamic.Resource(gvr).
			List(context.Background(), metav1.ListOptions{})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *CRDHandler) GetCustomResource(c *gin.Context) {
	client := middleware.GetClient(c)
	gvr := schema.GroupVersionResource{
		Group:    c.Param("group"),
		Version:  c.Param("version"),
		Resource: c.Param("resource"),
	}
	namespace := c.Param("namespace")
	name := c.Param("name")

	var result interface{}
	var err error

	if namespace != "" && namespace != "_" {
		result, err = client.Dynamic.Resource(gvr).Namespace(namespace).
			Get(context.Background(), name, metav1.GetOptions{})
	} else {
		result, err = client.Dynamic.Resource(gvr).
			Get(context.Background(), name, metav1.GetOptions{})
	}

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *CRDHandler) DeleteCustomResource(c *gin.Context) {
	client := middleware.GetClient(c)
	gvr := schema.GroupVersionResource{
		Group:    c.Param("group"),
		Version:  c.Param("version"),
		Resource: c.Param("resource"),
	}
	namespace := c.Param("namespace")
	name := c.Param("name")

	var err error
	if namespace != "" && namespace != "_" {
		err = client.Dynamic.Resource(gvr).Namespace(namespace).
			Delete(context.Background(), name, metav1.DeleteOptions{})
	} else {
		err = client.Dynamic.Resource(gvr).
			Delete(context.Background(), name, metav1.DeleteOptions{})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
