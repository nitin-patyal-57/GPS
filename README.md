# GPS Telemetry & Fleet Tracking Dashboard

A real-time GPS Tracking Dashboard built with **React 19, TypeScript, Vite, Tailwind CSS v4, Leaflet**, and a **Node.js Express / WebSocket backend** connected to **AWS IoT Core** via MQTT over mutual TLS (`mTLS`).

Adapted from the SmartLock system specifically for **GPS Tracking and Vehicle Fleet Telemetry**:
- ✅ **No lock/unlock/tamper dependencies**.
- ✅ Dedicated to GNSS coordinates, real-time speed, heading direction, satellite fix quality, 3-axis accelerometer dynamics, cellular connectivity, power management, and route history.
- ✅ Conforms directly to the hardware telemetry payload for IMEI `861185084122719` and similar trackers.

---

## Architecture Overview

```
[ GPS Tracker Hardware (e.g. GW1NS-4) ]
                   │
                   ▼ (Publish JSON metrics)
[ AWS IoT Core: soundbox_dev/{imei}/metrics ]
                   │
                   ▼ (mTLS 8883 Subscription)
[ Node.js Backend Server (server/src) ]
     ├── SQLite Database (devices & location history)
     ├── WebSocket Server (ws://localhost:3001/ws)
     └── REST API (http://localhost:3001/api/...)
                   │
                   ▼ (Real-time WebSocket & REST)
[ React 19 Frontend Dashboard (http://localhost:3000) ]
     ├── Overview (Fleet metrics & KPI summaries)
     ├── GPS Trackers (List & grid views with search & filters)
     ├── Telemetry Detail (Live map, RF metrics, battery, 3-axis accelerometer)
     ├── Live Fleet Map (Multi-vehicle Google Maps with heading rotation & traffic)
     ├── Route History (Interactive timeline playback, speed charts, distance)
     ├── Driving Analytics (Harsh braking, acceleration, cornering, impact shocks)
     ├── Battery & Power (Discharge curves, charging state, USB & external lines)
     ├── Alerts (Overspeed, low battery, motion shock with acknowledgment)
     └── System Settings (AWS IoT Core diagnostics & live JSON packet inspector)
```

---

## Quick Start

### 1. Start the Backend Server (Port 3001)
In a terminal:
```bash
cd server
npm run dev
```
- Health Check: `http://localhost:3001/api/health`
- WebSocket Server: `ws://localhost:3001/ws`
- Database: `server/data/gps.db` (auto-created with SQLite WAL mode)

### 2. Start the Frontend Dashboard (Port 3000)
In another terminal:
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## GPS Telemetry JSON Payload Structure

The system ingests and processes the following payload structure over MQTT topic `soundbox_dev/{imei}/metrics`:

```json
{
  "device": {
    "imei": "861185084122719",
    "model_id": "GW1NS-4",
    "serial_no": "",
    "app_v": "WMZ_DEV_1.0.2",
    "sdk_v": "WM_SDK_C_261008",
    "hw_v": "Z636_V1",
    "boot_reason": "power-off charging",
    "uptime_sec": 389
  },
  "power": {
    "bat_v": 4222,
    "bat_lvl": 100,
    "charging": "Y",
    "usb": "Y",
    "ext_power": "Y",
    "ext_power_v": "",
    "low_battery": false
  },
  "cellular": {
    "imsi": "404022437552332",
    "operator": "IND airtel",
    "net_t": "LTE",
    "mcc": "404",
    "mnc": "02",
    "cell_id": "128026133",
    "tac": "7911",
    "rssi": 29,
    "rsrp": 52,
    "rsrq": 13,
    "sinr": -4,
    "signal": "EXCELLENT",
    "band": "3",
    "ip4": "172.18.222.207",
    "ip6": "254.128.0.0.0.0.0.0.0.0.0.0.20.235.208.251"
  },
  "gps": {
    "status": "FIXED",
    "latitude": 30.657035,
    "longitude": 76.729596,
    "altitude_m": 301.7,
    "speed_kmph": 0,
    "heading_deg": 183,
    "satellites": 29,
    "hdop": 0.6,
    "accuracy_m": 2.9,
    "fix_type": "3D",
    "last_fix": "2026-11-23T10:32:44Z",
    "location": ""
  },
  "accelerometer": {
    "status": "OK",
    "motion": false,
    "x_g": -0.008,
    "y_g": 0.008,
    "z_g": -1.043,
    "harsh_braking_count": 0,
    "harsh_acceleration_count": 0,
    "sharp_turn_count": 0,
    "impact_count": 0,
    "driving_score": ""
  },
  "rtc": "2026-11-23T05:02:44.945Z"
}
```

---

## Map Providers Supported
- **Google Maps (Streets)**: High-detail road network
- **Google Hybrid**: High-resolution satellite imagery overlaid with road labels
- **Google Satellite**: Pure satellite imagery
- **Google Live Traffic**: Real-time traffic congestion heatmaps
- **Google Terrain**: Topographic elevation map
- **Dark Matter**: Night-mode CARTO basemap
- **OpenStreetMap**: Standard open-source global mapping
