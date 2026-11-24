export interface DeviceInfo {
  imei: string
  modelId: string
  serialNumber: string
  appVersion: string
  sdkVersion: string
  hardwareVersion: string
  bootReason: string
  uptimeSec: number
}

export interface PowerInfo {
  batteryVoltage: number    // in Volts (e.g. 4.22)
  batteryMv: number         // in mV (e.g. 4222)
  batteryPercentage: number // 0-100
  isCharging: boolean
  isUsbConnected: boolean
  isExternalPower: boolean
  extPowerVoltage?: string
  isLowBattery: boolean
}

export interface CellularInfo {
  operator: string          // "IND airtel"
  networkType: string       // "LTE"
  rssi: number              // 29
  rsrp: number              // 52
  rsrq: number              // 13
  sinr: number              // -4
  signal: string            // "EXCELLENT" | "GOOD" | "FAIR" | "POOR"
  signalQuality: number     // 1 to 5 stars
  band: string              // "3"
  cellId: string            // "128026133"
  tac: string               // "7911"
  mcc: string               // "404"
  mnc: string               // "02"
  imsi: string              // "404022437552332"
  ip4: string               // "172.18.222.207"
  ip6: string
}

export interface GpsInfo {
  status: 'FIXED' | 'SEARCHING' | 'NO_FIX' | string
  isFixed: boolean
  latitude: number
  longitude: number
  altitudeM: number
  speedKmph: number
  headingDeg: number
  satellites: number
  hdop: number
  accuracyM: number
  fixType: '3D' | '2D' | 'NONE' | string
  lastFix: string
  location: string
}

export interface AccelerometerInfo {
  status: string            // "OK"
  motion: boolean           // true/false
  xG: number                // -0.008
  yG: number                // 0.008
  zG: number                // -1.043
  harshBrakingCount: number
  harshAccelerationCount: number
  sharpTurnCount: number
  impactCount: number
  drivingScore: number      // 0 - 100
}

export interface GpsDevice {
  deviceId: string          // IMEI
  deviceName: string        // e.g. "GW1NS-4 (861185084122719)"
  status: 'online' | 'offline' | 'warning'
  motionState: 'moving' | 'stationary' | 'idle'
  lastSeen: string
  device: DeviceInfo
  power: PowerInfo
  cellular: CellularInfo
  gps: GpsInfo
  accelerometer: AccelerometerInfo
  rtc: string
}

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface GpsAlert {
  id: string
  deviceId: string
  type: 'overspeed' | 'harsh_braking' | 'harsh_acceleration' | 'sharp_turn' | 'impact' | 'low_battery' | 'signal_loss' | 'offline'
  message: string
  severity: AlertSeverity
  timestamp: string
  acknowledged: boolean
  value?: string | number
}

export interface LocationHistoryEntry {
  id: string
  deviceId: string
  latitude: number
  longitude: number
  altitude: number
  speed: number
  heading: number
  accuracy: number
  satellites?: number
  timestamp: string
  isFixed: boolean
}
