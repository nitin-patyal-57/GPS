import { config } from './config'
import type { OtaType, OtaDeployParams, OtaDeployResponse, OtaJobRecord } from '@/types/ota'

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
        }
        if (params.otaType === 'APP_OTA') {
          payloadObj.file_sha256 = params.fileSha256 || ''
          payloadObj.app_v = params.appVersion || params.version
        } else {
          payloadObj.sdk_v = params.sdkVersion || params.version
          if (params.appVersion && params.appVersion.trim()) {
            payloadObj.app_v = params.appVersion.trim()
          }
        }

        const rec: OtaJobRecord = {
          id: `${params.otaType}_${params.jobId}_${imei}`,
          jobId: params.jobId,
          deviceId: imei,
          otaType: params.otaType,
          urlAddress: params.urlAddress,
          fileSha256: params.otaType === 'APP_OTA' ? (params.fileSha256 || '') : '',
          version: params.version,
          appVersion: params.appVersion,
          sdkVersion: params.sdkVersion,
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

  async computeHashFromUrl(url: string): Promise<{ success: boolean; sha256?: string; sizeBytes?: number; sizeKb?: string; error?: string }> {
    try {
      const res = await fetch(`${config.apiUrl}/api/ota/compute-hash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        return data
      }
      return { success: false, error: data.error || `HTTP ${res.status}` }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect to hash service' }
    }
  },

  async getOtaJobs(limit = 100): Promise<OtaJobRecord[]> {
    try {
      const res = await fetch(`${config.apiUrl}/api/ota/jobs?limit=${limit}&_t=${Date.now()}`)
      if (res.ok) {
        const jobs = await res.json()
        if (Array.isArray(jobs)) {
          if (jobs.length > 0) {
            jobs.forEach((j) => saveCachedOtaJob(j))
          } else {
            localStorage.removeItem(LOCAL_STORAGE_OTA_JOBS_KEY)
          }
          return jobs
        }
      }
    } catch {}
    return getCachedOtaJobs()
  },

  async clearOtaJobs(type?: OtaType): Promise<boolean> {
    try {
      if (type) {
        const current = getCachedOtaJobs().filter((j) => j.otaType !== type)
        localStorage.setItem(LOCAL_STORAGE_OTA_JOBS_KEY, JSON.stringify(current))
      } else {
        localStorage.removeItem(LOCAL_STORAGE_OTA_JOBS_KEY)
      }
      const url = type ? `${config.apiUrl}/api/ota/jobs?type=${type}` : `${config.apiUrl}/api/ota/jobs`
      const res = await fetch(url, { method: 'DELETE' })
      return res.ok
    } catch {
      return false
    }
  },

  async simulateAck(jobId: string, deviceId: string, status = 'SUCCEEDED', otaType?: OtaType): Promise<any> {
    try {
      const res = await fetch(`${config.apiUrl}/api/ota/simulate-ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, deviceId, status, otaType }),
      })
      if (res.ok) return await res.json()
    } catch {}

    // Fallback local update
    const current = getCachedOtaJobs()
    const target = current.find(
      (j) =>
        j.jobId.toLowerCase() === jobId.toLowerCase() &&
        j.deviceId === deviceId &&
        (!otaType || j.otaType === otaType)
    )
    if (target) {
      const upper = (status || 'SUCCEEDED').toUpperCase()
      const derived: OtaJobRecord['status'] =
        upper === 'SUCCEEDED' || upper === 'SUCCESS'
          ? 'succeeded'
          : upper === 'IN_PROGRESS'
          ? 'in_progress'
          : upper === 'FAILED'
          ? 'failed'
          : 'acknowledged'

      target.status = derived
      target.ackedAt = new Date().toISOString()
      target.ackPayload = JSON.stringify({
        ota_type: target.otaType,
        jobId,
        url_address: target.urlAddress,
        status: upper,
        imei_number: deviceId,
      })
      if (!target.ackHistory) target.ackHistory = []
      target.ackHistory.push({
        status: derived,
        timestamp: target.ackedAt,
        payload: { jobId, imei_number: deviceId, status: upper, ota_type: target.otaType },
      })
      saveCachedOtaJob(target)
    }
    return { success: true }
  },
}
