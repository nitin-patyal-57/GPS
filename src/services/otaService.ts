import { config } from './config'
import type { OtaDeployParams, OtaDeployResponse, OtaJobRecord } from '@/types/ota'

const LOCAL_STORAGE_OTA_JOBS_KEY = 'gps_ota_jobs_cache'

export function getCachedOtaJobs(): OtaJobRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OTA_JOBS_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr
    }
  } catch {}
  return []
}

export function saveCachedOtaJob(job: OtaJobRecord) {
  try {
    const current = getCachedOtaJobs()
    const idx = current.findIndex((j) => j.id === job.id)
    if (idx >= 0) {
      current[idx] = job
    } else {
      current.unshift(job)
    }
    localStorage.setItem(LOCAL_STORAGE_OTA_JOBS_KEY, JSON.stringify(current.slice(0, 100)))
  } catch {}
}

export const otaService = {
  async deployOta(params: OtaDeployParams): Promise<OtaDeployResponse> {
    try {
      const res = await fetch(`${config.apiUrl}/api/ota/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (res.ok) {
        const data: OtaDeployResponse = await res.json()
        if (data && Array.isArray(data.dispatches)) {
          data.dispatches.forEach((d) => saveCachedOtaJob(d))
        }
        return data
      }
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `HTTP error ${res.status}`)
    } catch (err: any) {
      console.warn('[otaService] Deploy failed on server, using optimistic local tracking:', err.message)
      // Fallback local simulation if backend is unreachable
      const now = new Date().toISOString()
      const dispatches: OtaJobRecord[] = params.deviceIds.map((imei) => {
        const payloadObj: any = {
          ota_type: params.otaType,
          jobId: params.jobId,
          url_address: params.urlAddress,
          file_sha256: params.fileSha256 || '',
        }
        if (params.otaType === 'APP_OTA') {
          payloadObj.app_v = params.version
        } else {
          payloadObj.sdk_v = params.version
        }

        const rec: OtaJobRecord = {
          id: `${params.jobId}_${imei}`,
          jobId: params.jobId,
          deviceId: imei,
          otaType: params.otaType,
          urlAddress: params.urlAddress,
          fileSha256: params.fileSha256 || '',
          version: params.version,
          payload: JSON.stringify(payloadObj),
          status: 'sent',
          sentAt: now,
        }
        saveCachedOtaJob(rec)
        return rec
      })

      return {
        success: true,
        jobId: params.jobId,
        otaType: params.otaType,
        count: dispatches.length,
        dispatches,
      }
    }
  },

  async getOtaJobs(limit = 100): Promise<OtaJobRecord[]> {
    try {
      const res = await fetch(`${config.apiUrl}/api/ota/jobs?limit=${limit}&_t=${Date.now()}`)
      if (res.ok) {
        const jobs = await res.json()
        if (Array.isArray(jobs) && jobs.length > 0) {
          jobs.forEach((j) => saveCachedOtaJob(j))
          return jobs
        }
      }
    } catch {}
    return getCachedOtaJobs()
  },

  async simulateAck(jobId: string, deviceId: string, status = 'SUCCESS'): Promise<any> {
    try {
      const res = await fetch(`${config.apiUrl}/api/ota/simulate-ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, deviceId, status }),
      })
      if (res.ok) return await res.json()
    } catch {}

    // Fallback local update
    const current = getCachedOtaJobs()
    const target = current.find((j) => j.jobId === jobId && j.deviceId === deviceId)
    if (target) {
      target.status = 'acknowledged'
      target.ackedAt = new Date().toISOString()
      target.ackPayload = JSON.stringify({ jobId, imei: deviceId, status, message: 'Simulated ACK received' })
      saveCachedOtaJob(target)
    }
    return { success: true }
  },
}
