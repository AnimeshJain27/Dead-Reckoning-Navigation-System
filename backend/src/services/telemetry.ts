import type { WebSocket } from "ws";

export interface LiveState {
  device_id: string;
  device_name?: string;
  trip_id: string;
  t_ms: number;
  lat: number;
  lon: number;
  speed_mps: number;
  heading_deg: number;
  mode: string;
  hpl_m: number;
  ell_major_m?: number;
  ell_minor_m?: number;
  ell_angle_deg?: number;
  way_id?: number;
  match_posterior?: number;
  vehicle_mode?: string;
  level?: number;
}

class TelemetryService {
  private latestStates = new Map<string, LiveState>();
  private wsClients = new Set<WebSocket>();

  registerClient(ws: WebSocket) {
    this.wsClients.add(ws);
    // Send immediate snapshot of all active devices
    const snapshot = {
      type: "snapshot",
      timestamp: Date.now(),
      devices: Array.from(this.latestStates.values()),
    };
    ws.send(JSON.stringify(snapshot));

    ws.on("close", () => {
      this.wsClients.delete(ws);
    });
  }

  updateDeviceState(state: LiveState) {
    this.latestStates.set(state.device_id, state);
    this.broadcast({
      type: "state",
      data: state,
    });
  }

  broadcastEvent(event: any) {
    this.broadcast({
      type: "event",
      data: event,
    });
  }

  broadcastHazard(hazard: any) {
    this.broadcast({
      type: "hazard",
      data: hazard,
    });
  }

  getAllLatestStates(): LiveState[] {
    return Array.from(this.latestStates.values());
  }

  private broadcast(payload: any) {
    const msg = JSON.stringify(payload);
    for (const ws of this.wsClients) {
      if (ws.readyState === 1) { // OPEN
        ws.send(msg);
      }
    }
  }
}

export const telemetryService = new TelemetryService();
