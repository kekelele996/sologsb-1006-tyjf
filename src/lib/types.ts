export type Lang = 'zh' | 'en'
export type CueStatus = 'pending' | 'confirmed' | 'followup'
export type TabId = 'live' | 'backstage' | 'terms' | 'offline'

/** 上屏投递状态：idle 未推送 / queued 已排队 / delivered 已送达 / failed 推送失败 / retracted 已撤回 */
export type DeliveryState = 'idle' | 'queued' | 'delivered' | 'failed' | 'retracted'

export interface Speaker {
  id: string
  name: string
  title: string
  language: string
  color: string
}

export interface Session {
  id: string
  order: number
  time: string
  title: string
  speakerId: string
  room: string
  status: 'upcoming' | 'live' | 'done'
}

export interface Term {
  id: string
  source: string
  target: string
  note: string
  speakerId: string
  priority: 'normal' | 'high'
}

export interface Announcement {
  id: string
  level: 'info' | 'warning' | 'urgent'
  text: string
  visibleOnStage: boolean
  createdAt: string
}

/** 单个语种（中文位 / 英文位）对同一段原文的独立处理记录 */
export interface TrackCue {
  confirmedAt: number | null
  withdrawnAt: number | null
  followupText: string
  followupAt: number | null
  delivery: DeliveryState
  /** 每次确认生成一个投递批次号，撤回后重新确认会换新批次，防止旧内容重复上屏 */
  deliveryVersion: number
  deliveredAt: number | null
  attempts: number
  lastError: string
  /** 因顺序核对未决而暂缓推送 */
  held: boolean
}

export interface Cue {
  id: string
  speakerId: string
  text: string
  receivedAt: number
  status: CueStatus
  manual: boolean
  offline: boolean
  delaySeconds: number
  duplicateOf: string | null
  followupText: string
  tags: string[]
  zh: TrackCue
  en: TrackCue
}

export interface Reminder {
  id: string
  termId: string
  cueId: string
  lang: Lang
  target: string
  createdAt: number
  acknowledged: boolean
}

/** 两路对同一段的处理先后对不上时，列入待值班主管裁定清单 */
export interface Discrepancy {
  id: string
  cueIds: [string, string]
  langA: Lang
  langB: Lang
  detectedAt: number
  note: string
  status: 'pending' | 'released' | 'dismissed'
  resolvedAt: number | null
  resolution: string
}

export interface DeskState {
  speakers: Speaker[]
  sessions: Session[]
  terms: Term[]
  announcements: Announcement[]
  cues: Cue[]
  reminders: Reminder[]
  discrepancies: Discrepancy[]
  activeCueId: string
  fontScale: number
  online: boolean
  liveSimulation: boolean
  /** 演示开关：开启后推送全部失败，用于练习重试 */
  pushFailing: boolean
  updatedAt: string
}
