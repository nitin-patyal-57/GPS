import { Router } from 'express'
import crypto from 'crypto'
import { getDb, OtaJobRecord } from '../services/database'
import { publishOtaPayload } from '../services/mqttService'
import { broadcast } from '../services/websocket'

const router = Router()

/**
 * POST /api/ota/deploy
 * Batch dispatches OTA payloads for selected device IMEIs over MQTT
 */
router.post('/ota/deploy', async (req, res) => {
  try {
    const { deviceIds, otaType = 'APP_OTA', jobId, urlAddress, fileSha256, version } = req.body

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ error: 'At least one deviceId must be selected' })
    }

    if (!urlAddress || !urlAddress.trim()) {
      return res.status(400).json({ error: 'Firmware URL address (url_address) is required' })
    }

    if (!version || !version.trim()) {
      return res.status(400).json({ error: 'Target version is required' })
    }

    const cleanJobId = (jobId && String(jobId).trim()) || `J_${Date.now().toString(36).toUpperCase()}`
    const cleanType: 'APP_OTA' | 'DF_OTA' = otaType === 'DF_OTA' ? 'DF_OTA' : 'APP_OTA'
    const cleanUrl = String(urlAddress).trim()
    const cleanSha256 = fileSha256 ? String(fileSha256).trim() : ''
    const cleanVersion = String(version).trim()

    const db = getDb()
    const now = new Date().toISOString()
    const dispatches: OtaJobRecord[] = []

    for (const rawImei of deviceIds) {
      const imei = String(rawImei).trim()
      if (!imei) continue

      // Template matching user spec:
      // {"ota_type":"APP_OTA","jobId":"J1","url_address":"https://…/customer_app.bin","file_sha256":"<64 hex>","app_v":"<new app_v>"}
      // {"ota_type":"DF_OTA","jobId":"J2","url_address":"https://…/system_patch.bin","sdk_v":"<new sdk_v>"}
      const payloadObj: any = {
        ota_type: cleanType,
        jobId: cleanJobId,
        url_address: cleanUrl,
      }

      if (cleanType === 'APP_OTA') {
        payloadObj.file_sha256 = cleanSha256
        payloadObj.app_v = cleanVersion
      } else {
        payloadObj.sdk_v = cleanVersion
      }

      // Publish to MQTT
      await publishOtaPayload(imei, payloadObj)

      const record: OtaJobRecord = {
        id: `${cleanJobId}_${imei}`,
        jobId: cleanJobId,
        deviceId: imei,
        otaType: cleanType,
        urlAddress: cleanUrl,
        fileSha256: cleanType === 'APP_OTA' ? cleanSha256 : '',
        version: cleanVersion,
        payload: JSON.stringify(payloadObj),
        status: 'sent',
        sentAt: now,
      }

      if (typeof db.saveOtaJob === 'function') {
        db.saveOtaJob(record)
      }
      dispatches.push(record)

      // Broadcast WebSocket notification that job dispatch started
      broadcast('ota_dispatch', {
        jobId: cleanJobId,
        deviceId: imei,
        record,
      })
    }

    console.log(`[OTA Deploy] Successfully dispatched ${dispatches.length} payloads for Job ${cleanJobId}`)
    res.json({
      success: true,
      jobId: cleanJobId,
      otaType: cleanType,
      count: dispatches.length,
      dispatches,
    })
  } catch (err: any) {
    console.error('[OTA Deploy] Error:', err)
    res.status(500).json({ error: err.message || 'Failed to dispatch OTA payloads' })
  }
})

/**
 * POST /api/ota/compute-hash
 * Downloads binary from given URL and computes its real SHA-256 hash
 */
router.post('/ota/compute-hash', async (req, res) => {
  try {
    const { url } = req.body
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Valid URL is required' })
    }

    const cleanUrl = url.trim()
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'URL must start with http:// or https://' })
    }

    console.log(`[OTA Compute Hash] Fetching binary from: ${cleanUrl}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GPS-Telemetry-OTA/1.0',
      },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return res.status(400).json({
        error: `Could not download from URL: HTTP ${response.status} ${response.statusText}`,
      })
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const sizeBytes = buffer.length

    if (sizeBytes === 0) {
      return res.status(400).json({ error: 'Downloaded file is empty (0 bytes)' })
    }

    const hash = crypto.createHash('sha256').update(buffer).digest('hex')
    console.log(`[OTA Compute Hash] Computed SHA-256 for ${cleanUrl}: ${hash} (${sizeBytes} bytes)`)

    res.json({
      success: true,
      sha256: hash,
      sizeBytes,
      sizeKb: (sizeBytes / 1024).toFixed(1),
    })
  } catch (err: any) {
    console.error('[OTA Compute Hash] Error:', err.message)
    res.status(500).json({
      error: err.name === 'AbortError' ? 'Download timed out (exceeded 20s)' : (err.message || 'Failed to compute SHA-256 from URL'),
    })
  }
})

/**
 * GET /api/ota/jobs
 * Returns list of recent OTA jobs and their ACK statuses
 */
router.get('/ota/jobs', (req, res) => {
  try {
    const db = getDb()
    const limit = parseInt(req.query.limit as string) || 100
    const jobs = typeof db.getOtaJobs === 'function' ? db.getOtaJobs(limit) : []
    res.json(jobs)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch OTA jobs' })
  }
})

/**
 * POST /api/ota/simulate-ack
 * Test endpoint to simulate device ACK for testing/demoing
 */
router.post('/ota/simulate-ack', (req, res) => {
  try {
    const { jobId, deviceId, status = 'SUCCESS', message = 'Firmware downloaded and verified' } = req.body
    if (!jobId || !deviceId) {
      return res.status(400).json({ error: 'jobId and deviceId are required' })
    }

    const db = getDb()
    const now = new Date().toISOString()
    const ackPayload = {
      jobId,
      imei: deviceId,
      status,
      message,
      timestamp: now,
    }

    if (typeof db.updateOtaJobAck === 'function') {
      db.updateOtaJobAck(jobId, deviceId, ackPayload)
    }

    broadcast('ota_ack', {
      topic: `soundbox_dev/${deviceId}/ack`,
      deviceId,
      jobId,
      payload: ackPayload,
      raw: JSON.stringify(ackPayload),
      timestamp: now,
    })

    res.json({ success: true, simulated: ackPayload })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to simulate ACK' })
  }
})

export default router
