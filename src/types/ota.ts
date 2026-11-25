export type OtaType = 'APP_OTA' | 'DF_OTA'

export interface OtaDeployParams {
  deviceIds: string[]
  otaType: OtaType
  jobId: string
  urlAddress: string
  fileSha256?: string
  version: string
}

export interface OtaAckLogEntry {
  status: string
  timestamp: string
  payload: any
}

export interface OtaJobRecord {
  id: string
  jobId: string
  deviceId: string
  otaType: OtaType
  urlAddress: string
  fileSha256: string
  version: string
  payload: string
  status: 'pending' | 'sent' | 'acknowledged' | 'in_progress' | 'succeeded' | 'failed'
  sentAt: string
  ackedAt?: string
  ackPayload?: string
  ackHistory?: OtaAckLogEntry[]
}

export interface OtaDeployResponse {
  success: boolean
  jobId: string
  otaType: OtaType
  count: number
  dispatches: OtaJobRecord[]
  error?: string
}

export interface OtaAckEvent {
  topic: string
  deviceId?: string
  jobId?: string
  payload: any
  raw: string
  timestamp: string
}
