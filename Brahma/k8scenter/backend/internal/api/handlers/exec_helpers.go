package handlers

import (
	"io"
	"net/url"

	"github.com/gorilla/websocket"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
)

func remoteExec(config *rest.Config, u *url.URL) (remotecommand.Executor, error) {
	return remotecommand.NewSPDYExecutor(config, "POST", u)
}

func remoteExecStreamOptions(stdin io.Reader, stdout io.Writer, stderr io.Writer, tty bool) remotecommand.StreamOptions {
	return remotecommand.StreamOptions{
		Stdin:             stdin,
		Stdout:            stdout,
		Stderr:            stderr,
		Tty:               tty,
		TerminalSizeQueue: nil,
	}
}

// wsReader wraps a WebSocket connection to implement io.Reader for stdin
type wsReader struct {
	conn *websocket.Conn
	buf  []byte
}

func newWSReader(conn *websocket.Conn) *wsReader {
	return &wsReader{conn: conn}
}

func (r *wsReader) Read(p []byte) (int, error) {
	if len(r.buf) > 0 {
		n := copy(p, r.buf)
		r.buf = r.buf[n:]
		return n, nil
	}
	_, msg, err := r.conn.ReadMessage()
	if err != nil {
		return 0, io.EOF
	}
	n := copy(p, msg)
	if n < len(msg) {
		r.buf = msg[n:]
	}
	return n, nil
}
