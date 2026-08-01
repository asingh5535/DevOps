package handlers

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func listOptions() metav1.ListOptions {
	return metav1.ListOptions{}
}

func init() {
	// ensure fmt is used in this package
	_ = fmt.Sprintf
}
