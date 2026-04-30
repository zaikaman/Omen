package api

import (
	"net/http"
	"time"

	"github.com/yggdrasil-network/yggdrasil-go/src/core"
	"gvisor.dev/gvisor/pkg/tcpip/stack"
)

// NewHandler creates the HTTP handler with all API routes configured.
// This is extracted from main to enable testing of HTTP routing.
func NewHandler(yggCore *core.Core, tcpPort int, netStack *stack.Stack, peerTimeouts ...time.Duration) http.Handler {
	mcpPeerTimeout := 300 * time.Second
	a2aPeerTimeout := 300 * time.Second
	if len(peerTimeouts) > 0 {
		mcpPeerTimeout = peerTimeouts[0]
	}
	if len(peerTimeouts) > 1 {
		a2aPeerTimeout = peerTimeouts[1]
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/topology", HandleTopology(yggCore))
	mux.HandleFunc("/send", HandleSend(tcpPort, netStack))
	mux.HandleFunc("/recv", HandleRecv)
	mux.HandleFunc("/mcp/", HandleMCP(tcpPort, netStack, mcpPeerTimeout))
	mux.HandleFunc("/a2a/", HandleA2A(tcpPort, netStack, a2aPeerTimeout))
	return mux
}
