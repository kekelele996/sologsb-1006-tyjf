export type CueStatus = 'pending' | 'confirmed' | 'followup'
export type TabId = 'live' | 'backstage' | 'terms' | 'offline'
export type ChannelId = 'zh' | 'en'
export type PushStatus = 'idle' | 'sending' | 'sent' | 'failed'
export type MismatchDecisionValue = 'zh' | 'en' | 'acknowledged'

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

export interface Cue {
  id: string
  speakerId: string
  text: string
  receivedAt: number
  manual: boolean
  offline: boolean
  delaySeconds: number
  duplicateOf: string | null
  tags: string[]
}

/** 单个语种位对某一段的独立处理状态：确认、补译、推送都各自记账。 */
export interface ChannelCueState {
  status: CueStatus
  followupText: string
  confirmOrder: number | null
  confirmedAt: number | null
  pushStatus: PushStatus
  pushedAt: number | null
  pushAttempts: number
  pushError: string
}

export interface Channel {
  id: ChannelId
  label: string
  labelEn: string
  short: string
  cueStates: Record<string, ChannelCueState>
  activeCueId: string
  /** 已成功推送到本语种上屏的段落（按上屏顺序），撤回不影响另一路。 */
  stage: string[]
  confirmCounter: number
}

export interface Reminder {
  id: string
  channelId: ChannelId
  termId: string
  cueId: string
  target: string
  createdAt: number
  acknowledged: boolean
}

export interface MismatchDecision {
  key: string
  decidedAt: number
  decision: MismatchDecisionValue
}

export interface DeskState {
  speakers: Speaker[]
  sessions: Session[]
  terms: Term[]
  announcements: Announcement[]
  cues: Cue[]
  reminders: Reminder[]
  channels: Record<ChannelId, Channel>
  channelOrder: ChannelId[]
  mismatchDecisions: Record<string, MismatchDecision>
  activeChannel: ChannelId
  fontScale: number
  online: boolean
  liveSimulation: boolean
  updatedAt: string
}

export function defaultCueState(): ChannelCueState {
  return {
    status: 'pending',
    followupText: '',
    confirmOrder: null,
    confirmedAt: null,
    pushStatus: 'idle',
    pushedAt: null,
    pushAttempts: 0,
    pushError: ''
  }
}
