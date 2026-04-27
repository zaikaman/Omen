import http.client
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


PUBLIC_PORT = int(os.environ.get("AXL_PUBLIC_PROXY_PORT", "8080"))
BRIDGE_HOST = os.environ.get("AXL_BRIDGE_PROXY_HOST", "127.0.0.1")
BRIDGE_PORT = int(os.environ.get("AXL_API_PORT", "9002"))
TIMEOUT_SECONDS = float(os.environ.get("AXL_PUBLIC_PROXY_TIMEOUT_SECONDS", "10"))


class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._handle()

    def do_POST(self):
        self._handle()

    def _handle(self):
        if self.path == "/health":
            self._send_json(200, {"ok": True})
            return

        body_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(body_length) if body_length > 0 else None
        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in {"host", "connection", "content-length"}
        }

        try:
            conn = http.client.HTTPConnection(
                BRIDGE_HOST,
                BRIDGE_PORT,
                timeout=TIMEOUT_SECONDS,
            )
            conn.request(self.command, self.path, body=body, headers=headers)
            response = conn.getresponse()
            payload = response.read()

            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in {"connection", "transfer-encoding"}:
                    self.send_header(key, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as error:
            self._send_json(
                504,
                {
                    "success": False,
                    "error": str(error),
                },
            )
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _send_json(self, status, payload):
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format, *args):
        print(f"[axl-public-proxy] {self.address_string()} {format % args}")


server = ThreadingHTTPServer(("0.0.0.0", PUBLIC_PORT), ProxyHandler)
print(f"[axl-public-proxy] listening on 0.0.0.0:{PUBLIC_PORT}", flush=True)
print(f"[axl-public-proxy] forwarding to {BRIDGE_HOST}:{BRIDGE_PORT}", flush=True)
server.serve_forever()
