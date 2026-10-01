"""High-Performance Real-Time Telemetry & HTTP Server
SIH 2026 | PS SIH26113 | Team: BERSERK TECHIES | Team ID: TEAM-147
"""

import os
import json
import time
import datetime
import mimetypes
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("model/gltf+json", ".gltf")
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Optional

from backend.config import DEFAULT_SIM
from backend.simulation.loop import SimulationEngine

# Locate frontend directory relative to backend/
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))


class MoveAssistRequestHandler(BaseHTTPRequestHandler):
    """Handles static web asset delivery, REST control endpoints,

    and high-speed Server-Sent Events (SSE) telemetry streaming.
    """

    engine: SimulationEngine = None  # Injected before server start

    def log_message(self, format, *args):
        # Suppress routine 200 HTTP streaming logs to keep console clean
        pass

    def _send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 1. Real-time Telemetry Stream via SSE (~60 Hz)
        if path == "/api/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            try:
                # Stream frames at ~60 Hz (every 16 ms)
                while True:
                    telemetry = self.engine.latest_telemetry
                    if telemetry:
                        payload = f"data: {json.dumps(telemetry)}\n\n".encode("utf-8")
                        self.wfile.write(payload)
                        self.wfile.flush()
                    time.sleep(0.016)
            except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, OSError):
                # Client disconnected normally
                return
            except Exception:
                return
            return

        # 2. REST Snapshot Endpoint
        if path == "/api/state":
            self._send_json(self.engine.latest_telemetry or self.engine.step())
            return

        # 3. Report Status Endpoint
        if path == "/api/report/status":
            self._send_json(self.engine.recorder.get_status())
            return

        # 4. Excel Report Download (.xlsx)
        if path == "/api/report/download":
            try:
                excel_bytes = self.engine.generate_excel_report()
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"MoveAssist_Clinical_Report_{timestamp}.xlsx"

                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(excel_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(excel_bytes)
            except Exception as e:
                self.send_error(500, f"Error generating Excel report: {str(e)}")
            return

        # 5. CSV Report Download
        if path == "/api/report/csv":
            try:
                csv_text = self.engine.generate_csv_report()
                csv_bytes = csv_text.encode("utf-8")
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"MoveAssist_Clinical_Report_{timestamp}.csv"

                self.send_response(200)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(csv_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(csv_bytes)
            except Exception as e:
                self.send_error(500, f"Error generating CSV report: {str(e)}")
            return

        # 3. Static File Serving from frontend/
        if path == "/" or path == "":
            rel_path = "index.html"
        else:
            rel_path = path.lstrip("/")

        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        assets_dir = os.path.abspath(os.path.join(repo_root, "assets"))
        file_path = os.path.abspath(os.path.join(FRONTEND_DIR, rel_path))

        # Check root assets directory if not found in FRONTEND_DIR
        if (not os.path.exists(file_path) or os.path.isdir(file_path)) and (rel_path.startswith("assets") or rel_path.startswith("assets/")):
            alt_path = os.path.abspath(os.path.join(repo_root, rel_path))
            if alt_path.startswith(assets_dir) and os.path.exists(alt_path) and not os.path.isdir(alt_path):
                file_path = alt_path

        # Security check: prevent directory traversal outside FRONTEND_DIR or assets_dir
        allowed_roots = (FRONTEND_DIR, assets_dir)
        if not any(file_path.startswith(r) for r in allowed_roots) or not os.path.exists(file_path) or os.path.isdir(file_path):
            self.send_error(404, "File Not Found")
            return

        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type is None:
            mime_type = "application/octet-stream"

        try:
            with open(file_path, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {str(e)}")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Read JSON body
        content_len = int(self.headers.get("Content-Length", 0))
        post_data = {}
        if content_len > 0:
            try:
                post_data = json.loads(self.rfile.read(content_len).decode("utf-8"))
            except Exception:
                post_data = {}

        # Route endpoints
        if path == "/api/demo/start":
            self.engine.start_demo()
            self._send_json({"status": "success", "message": "Clinical demonstration started"})
        elif path == "/api/demo/stop":
            self.engine.stop_demo()
            self._send_json({"status": "success", "message": "Clinical demonstration stopped"})
        elif path == "/api/safety/estop":
            self.engine.trigger_estop()
            self._send_json({"status": "success", "message": "Emergency Stop engaged"})
        elif path == "/api/safety/soft_stop":
            duration = float(post_data.get("duration_s", 90.0))
            reason = post_data.get("reason", "MANUAL_CONTROLLED_SOFT_STOP")
            if self.engine.safety.soft_stop_active:
                self.engine.update_soft_stop_duration(duration_s=duration, reason=reason)
                self._send_json({"status": "success", "message": f"Controlled soft stop timer updated to {duration}s"})
            else:
                self.engine.trigger_controlled_soft_stop(duration_s=duration, reason=reason)
                self._send_json({"status": "success", "message": f"Controlled soft stop initiated over {duration}s"})
        elif path == "/api/safety/reset":
            self.engine.reset_soft_stop()
            success = self.engine.reset_estop()
            self._send_json({"status": "success" if success else "failed", "e_stop_latched": not success})
        elif path == "/api/fault/inject":
            sensor_type = post_data.get("sensor", "ALL")
            self.engine.inject_sensor_fault(sensor_type)
            self._send_json({"status": "success", "message": f"Fault injected: {sensor_type}"})
        elif path == "/api/fault/clear":
            self.engine.clear_sensor_faults()
            self._send_json({"status": "success", "message": "All sensor faults cleared"})
        elif path == "/api/control":
            strength = post_data.get("strength")
            fatigue = post_data.get("fatigue")
            self.engine.set_user_parameters(strength=strength, fatigue=fatigue)
            self._send_json({"status": "success", "message": "User parameters updated"})
        elif path == "/api/anthropometrics":
            h = float(post_data.get("height_m", 1.75))
            m = float(post_data.get("mass_kg", 72.0))
            self.engine.update_anthropometrics(h, m)
            self._send_json({"status": "success", "anthropometry": self.engine.anthro.get_summary()})
        elif path == "/api/calibrate":
            self.engine.start_calibration()
            self._send_json({"status": "success", "message": "Calibration routine initiated"})
        elif path == "/api/kinematics/mode":
            mode = str(post_data.get("mode", "WALK"))
            jog_angle = float(post_data.get("jog_angle_deg", 0.0))
            self.engine.set_kinematic_mode(mode=mode, jog_angle_deg=jog_angle)
            self._send_json({
                "status": "success",
                "mode": self.engine.kinematic_mode,
                "jog_angle_deg": self.engine.manual_jog_angle_deg
            })
        elif path == "/api/simulation/start":
            self.engine.start_background_loop()
            self._send_json({"status": "success", "running": True})
        elif path == "/api/simulation/stop":
            self.engine.stop_background_loop()
            self._send_json({"status": "success", "running": False})
        elif path == "/api/simulation/toggle":
            if self.engine._is_running:
                self.engine.stop_background_loop()
                running = False
            else:
                self.engine.start_background_loop()
                running = True
            self._send_json({"status": "success", "running": running})
        else:
            self.send_error(404, "Endpoint Not Found")


def create_server(host: str = DEFAULT_SIM.server_host,
                  port: int = DEFAULT_SIM.server_port,
                  engine: Optional[SimulationEngine] = None) -> ThreadingHTTPServer:
    """Instantiates and configures the MoveAssist server."""
    if engine is None:
        engine = SimulationEngine()

    MoveAssistRequestHandler.engine = engine
    server = ThreadingHTTPServer((host, port), MoveAssistRequestHandler)
    return server
