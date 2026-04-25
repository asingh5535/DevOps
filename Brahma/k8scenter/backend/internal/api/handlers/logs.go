package handlers

import (
	"bufio"
	"context"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/kubevision/backend/internal/middleware"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type LogHandler struct {
	upgrader websocket.Upgrader
}

func NewLogHandler() *LogHandler {
	return &LogHandler{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
			ReadBufferSize:  1024,
			WriteBufferSize: 4096,
		},
	}
}

func (h *LogHandler) StreamLogs(c *gin.Context) {
	client := middleware.GetClient(c)
	namespace := c.Param("namespace")
	podName := c.Param("name")
	container := c.Query("container")
	tailStr := c.Query("tail")
	previous := c.Query("previous") == "true"
	timestamps := c.Query("timestamps") == "true"

	var tailLines *int64
	if tailStr != "" {
		n, err := strconv.ParseInt(tailStr, 10, 64)
		if err == nil {
			tailLines = &n
		}
	} else {
		defaultTail := int64(500)
		tailLines = &defaultTail
	}

	opts := &corev1.PodLogOptions{
		Container:  container,
		Follow:     true,
		TailLines:  tailLines,
		Previous:   previous,
		Timestamps: timestamps,
	}

	req := client.Core.CoreV1().Pods(namespace).GetLogs(podName, opts)
	stream, err := req.Stream(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot open log stream: " + err.Error()})
		return
	}
	defer stream.Close()

	// Upgrade to WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// Read client close signal
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	scanner := bufio.NewScanner(stream)
	scanner.Buffer(make([]byte, 1024*64), 1024*64)

	for scanner.Scan() {
		select {
		case <-done:
			return
		default:
		}
		line := scanner.Text()
		if err := conn.WriteMessage(websocket.TextMessage, []byte(line)); err != nil {
			return
		}
	}
}

// GetLogs returns the last N lines of logs (non-streaming)
func (h *LogHandler) GetLogs(c *gin.Context) {
	client := middleware.GetClient(c)
	namespace := c.Param("namespace")
	podName := c.Param("name")
	container := c.Query("container")
	tailStr := c.DefaultQuery("tail", "200")
	previous := c.Query("previous") == "true"

	tail, _ := strconv.ParseInt(tailStr, 10, 64)

	opts := &corev1.PodLogOptions{
		Container: container,
		TailLines: &tail,
		Previous:  previous,
	}

	req := client.Core.CoreV1().Pods(namespace).GetLogs(podName, opts)
	data, err := req.DoRaw(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.String(http.StatusOK, string(data))
}

// ─── Exec (WebSocket terminal) ────────────────────────────────────────────────

type ExecHandler struct {
	upgrader websocket.Upgrader
}

func NewExecHandler() *ExecHandler {
	return &ExecHandler{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

func (h *ExecHandler) ExecPod(c *gin.Context) {
	client := middleware.GetClient(c)
	namespace := c.Param("namespace")
	podName := c.Param("name")
	container := c.DefaultQuery("container", "")
	command := c.DefaultQuery("command", "/bin/sh")

	// Upgrade to WebSocket
	wsConn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer wsConn.Close()

	// Verify pod exists
	_, err = client.Core.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err != nil {
		wsConn.WriteMessage(websocket.TextMessage, []byte("Error: pod not found: "+err.Error()))
		return
	}

	execReq := client.Core.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec").
		Param("container", container).
		Param("stdin", "true").
		Param("stdout", "true").
		Param("stderr", "true").
		Param("tty", "true").
		Param("command", command)

	cfg := client.RestConfig

	exec, err := remoteExec(cfg, execReq.URL())
	if err != nil {
		wsConn.WriteMessage(websocket.TextMessage, []byte("Error creating executor: "+err.Error()))
		return
	}

	pr, pw := io.Pipe()
	errPr, errPw := io.Pipe()

	stdin := newWSReader(wsConn)

	go func() {
		defer pw.Close()
		defer errPw.Close()
		_ = exec.Stream(remoteExecStreamOptions(stdin, pw, errPw, true))
	}()

	// Forward stdout
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := pr.Read(buf)
			if n > 0 {
				wsConn.WriteMessage(websocket.BinaryMessage, buf[:n])
			}
			if err != nil {
				return
			}
		}
	}()

	// Forward stderr
	buf := make([]byte, 4096)
	for {
		n, err := errPr.Read(buf)
		if n > 0 {
			wsConn.WriteMessage(websocket.BinaryMessage, buf[:n])
		}
		if err != nil {
			return
		}
	}
}
