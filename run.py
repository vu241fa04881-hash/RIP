"""MoveAssist Launcher: Single-Command Startup
SIH 2026 | PS SIH26113 | Team: BERSERK TECHIES | Team ID: TEAM-147
"""

import sys
import time
import webbrowser
from threading import Thread

from backend.config import DEFAULT_SIM, SCIENTIFIC_DISCLAIMER
from backend.simulation.loop import SimulationEngine
from backend.server import create_server


def main():
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print("=" * 72)
    print("MOVEASSIST -- AI-ASSISTED LOWER-LIMB REHABILITATION EXOSKELETON")
    print("   SIH 2026 | PS SIH26113 | Team: BERSERK TECHIES | Team ID: TEAM-147")
    print("   Status: Virtual Engineering Prototype & Proof-of-Concept")
    print("=" * 72)
    print(f"\n[DISCLAIMER] {SCIENTIFIC_DISCLAIMER}\n")

    port = DEFAULT_SIM.server_port
    host = DEFAULT_SIM.server_host
    display_host = "127.0.0.1" if host == "0.0.0.0" else host
    url = f"http://{display_host}:{port}"

    # 1. Initialize Simulation Engine
    print("[1/3] Initializing 100 Hz Closed-Loop Simulation Engine...")
    engine = SimulationEngine(dt=DEFAULT_SIM.dt)
    engine.start_background_loop()

    # 2. Start HTTP & SSE Telemetry Server
    print(f"[2/3] Starting Telemetry Streaming Server on {host}:{port}...")
    server = create_server(host=host, port=port, engine=engine)
    server_thread = Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    # 3. Launch Web Cockpit in Browser
    print(f"[3/3] Opening Web Cockpit in your default browser at {url}...")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"      (Could not auto-open browser: {e}. Please open {url} manually)")

    print("\n" + "-" * 72)
    print(f"[READY] MoveAssist Cockpit is LIVE at: {url}")
    print("   Press Ctrl+C in this terminal at any time to safely shut down.")
    print("-" * 72 + "\n")

    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Stopping simulation engine and server...")
        engine.stop_background_loop()
        server.shutdown()
        server.server_close()
        print("[SHUTDOWN] MoveAssist cleanly terminated. Goodbye!")
        sys.exit(0)


if __name__ == "__main__":
    main()
