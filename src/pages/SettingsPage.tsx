import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useGpsDevices } from '@/hooks/useGpsDevices'
import { realtimeGpsService } from '@/services/websocket'
import Card from '@/components/ui/Card'
import { Radio, Wifi, Database, CheckCircle2, Server, Copy, Check } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  const { devices } = useGpsDevices()
  const wsStatus = realtimeGpsService.getStatus()
  const [copied, setCopied] = useState(false)

  const sampleJson = devices[0]
    ? JSON.stringify(
        {
          device: {
            imei: devices[0].device.imei,
            model_id: devices[0].device.modelId,
            serial_no: devices[0].device.serialNumber,
            app_v: devices[0].device.appVersion,
            sdk_v: devices[0].device.sdkVersion,
            hw_v: devices[0].device.hardwareVersion,
            boot_reason: devices[0].device.bootReason,
            uptime_sec: devices[0].device.uptimeSec,
          },
          power: {
            bat_v: devices[0].power.batteryMv,
            bat_lvl: devices[0].power.batteryPercentage,
            charging: devices[0].power.isCharging ? 'Y' : 'N',
            usb: devices[0].power.isUsbConnected ? 'Y' : 'N',
            ext_power: devices[0].power.isExternalPower ? 'Y' : 'N',
            ext_power_v: '',
            low_battery: devices[0].power.isLowBattery,
          },
          cellular: {
            imsi: devices[0].cellular.imsi,
            operator: devices[0].cellular.operator,
            net_t: devices[0].cellular.networkType,
            mcc: devices[0].cellular.mcc,
            mnc: devices[0].cellular.mnc,
            cell_id: devices[0].cellular.cellId,
            tac: devices[0].cellular.tac,
            rssi: devices[0].cellular.rssi,
            rsrp: devices[0].cellular.rsrp,
            rsrq: devices[0].cellular.rsrq,
            sinr: devices[0].cellular.sinr,
            signal: devices[0].cellular.signal,
            band: devices[0].cellular.band,
            ip4: devices[0].cellular.ip4,
            ip6: devices[0].cellular.ip6,
          },
          gps: {
            status: devices[0].gps.status,
            latitude: devices[0].gps.latitude,
            longitude: devices[0].gps.longitude,
            altitude_m: devices[0].gps.altitudeM,
            speed_kmph: devices[0].gps.speedKmph,
            heading_deg: devices[0].gps.headingDeg,
            satellites: devices[0].gps.satellites,
            hdop: devices[0].gps.hdop,
            accuracy_m: devices[0].gps.accuracyM,
            fix_type: devices[0].gps.fixType,
            last_fix: devices[0].gps.lastFix,
            location: devices[0].gps.location,
          },
          accelerometer: {
            status: devices[0].accelerometer.status,
            motion: devices[0].accelerometer.motion,
            x_g: devices[0].accelerometer.xG,
            y_g: devices[0].accelerometer.yG,
            z_g: devices[0].accelerometer.zG,
            harsh_braking_count: devices[0].accelerometer.harshBrakingCount,
            harsh_acceleration_count: devices[0].accelerometer.harshAccelerationCount,
            sharp_turn_count: devices[0].accelerometer.sharpTurnCount,
            impact_count: devices[0].accelerometer.impactCount,
            driving_score: devices[0].accelerometer.drivingScore,
          },
          rtc: devices[0].rtc,
        },
        null,
        2
      )
    : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(sampleJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          System & MQTT Broker Diagnostics
        </h1>
        <p className="text-xs text-slate-500">
          Broker endpoints, TLS connection parameters, and raw JSON telemetry inspection
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Connection Parameters */}
        <Card padding="md">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
            <Radio className="h-4 w-4 text-emerald-500" />
            AWS IoT Core MQTT Broker Connection
          </h2>

          <div className="space-y-3 font-mono text-xs">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">AWS Endpoint</span>
              <span className="text-slate-800 dark:text-slate-200">
                mqtts://avj249ldc7joq-ats.iot.ap-south-1.amazonaws.com:8883
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Subscribed Ingestion Topic</span>
              <span className="text-emerald-500 font-bold">soundbox_dev/+/metrics</span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Command Topic</span>
              <span className="text-blue-400">soundbox_dev/{'{imei}'}/command</span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Authentication Mode</span>
              <span className="text-slate-800 dark:text-slate-200">
                Mutual TLS (Amazon Root CA 1 + X.509 Client Cert + RSA Key)
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">WebSocket Pipeline</span>
              <span className="text-slate-800 dark:text-slate-200">{wsStatus.wsUrl}</span>
            </div>
          </div>
        </Card>

        {/* Raw Live Telemetry JSON Inspector */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-500" />
              Live Telemetry Packet Inspector
            </h2>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-slate-950 p-3 text-[11px] font-mono text-emerald-400 max-h-[380px] overflow-y-auto border border-slate-800">
            <pre>{sampleJson}</pre>
          </div>
        </Card>
      </div>
    </div>
  )
}
