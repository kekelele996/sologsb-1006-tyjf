import { writable, get } from 'svelte/store'
import type {
  Announcement, Channel, ChannelCueState, ChannelId, Cue, DeskState, MismatchDecision,
  MismatchDecisionValue, PushStatus, Reminder, Session, Speaker, Term
} from './types'
import { defaultCueState } from './types'

const STORAGE_KEY = 'conference-cue-desk-v2'
const speakers: Speaker[] = [
  { id: 'sp-1', name: 'Dr. Maya Chen', title: '首席气候科学家', language: '英语 → 中文', color: '#0f766e' },
  { id: 'sp-2', name: '刘启明', title: '城市韧性研究员', language: '中文 → 英语', color: '#b45309' },
  { id: 'sp-3', name: 'Prof. Daniel Ortiz', title: '公共卫生政策顾问', language: '西班牙语 → 中文', color: '#6d28d9' },
  { id: 'sp-4', name: '佐藤 美咲', title: '社区能源设计师', language: '日语 → 中文', color: '#be123c' }
]
const sessions: Session[] = [
  { id: 'se-1', order: 1, time: '09:00', title: '开幕式与议程说明', speakerId: 'sp-2', room: '主会场 A', status: 'done' },
  { id: 'se-2', order: 2, time: '09:20', title: '城市热岛与适应性基础设施', speakerId: 'sp-1', room: '主会场 A', status: 'live' },
  { id: 'se-3', order: 3, time: '10:05', title: '社区健康数据的地方行动', speakerId: 'sp-3', room: '主会场 A', status: 'upcoming' },
  { id: 'se-4', order: 4, time: '10:45', title: '分布式能源与社区共治', speakerId: 'sp-4', room: '主会场 A', status: 'upcoming' }
]
const terms: Term[] = [
  { id: 'term-1', source: 'urban heat island', target: '城市热岛', note: '首次出现完整译出，后可简称热岛', speakerId: 'sp-1', priority: 'high' },
  { id: 'term-2', source: 'resilience', target: '韧性', note: '不使用“恢复力”', speakerId: 'sp-1', priority: 'high' },
  { id: 'term-3', source: 'co-benefit', target: '协同效益', note: '环境与健康共同收益', speakerId: 'sp-1', priority: 'normal' },
  { id: 'term-4', source: 'distributed energy resource', target: '分布式能源资源', note: '缩写 DER', speakerId: 'sp-4', priority: 'high' },
  { id: 'term-5', source: 'health equity', target: '健康公平', note: '不译为健康平等', speakerId: 'sp-3', priority: 'high' }
]
function initialCues(): Cue[] {
  const now = Date.now()
  return [
    { id: 'cue-101', speakerId: 'sp-1', text: 'The urban heat island effect is not evenly distributed across a city.', receivedAt: now - 36000, manual: false, offline: false, delaySeconds: 4, duplicateOf: null, tags: ['城市热岛'] },
    { id: 'cue-102', speakerId: 'sp-1', text: 'Neighborhoods with less tree canopy can be several degrees warmer at night.', receivedAt: now - 19000, manual: false, offline: false, delaySeconds: 6, duplicateOf: null, tags: ['树冠覆盖率'] },
    { id: 'cue-103', speakerId: 'sp-1', text: 'Our resilience strategy links cooling corridors with public health investments.', receivedAt: now - 9000, manual: false, offline: false, delaySeconds: 11, duplicateOf: null, tags: ['韧性', '协同效益'] },
    { id: 'cue-104', speakerId: 'sp-1', text: 'That data also reveals health equity gaps between districts.', receivedAt: now - 2500, manual: false, offline: false, delaySeconds: 4, duplicateOf: null, tags: ['健康公平'] }
  ]
}

function makeChannel(id: ChannelId): Channel {
  return {
    id,
    label: id === 'zh' ? '中文口译位' : 'English Interpreter',
    labelEn: id === 'zh' ? '中文' : 'EN',
    short: id === 'zh' ? '中' : 'EN',
    cueStates: {},
    activeCueId: '',
    stage: [],
    confirmCounter: 0
  }
}

/** 演示数据：两路各自记账，且英文位有一段推送失败可重试。 */
function seedChannels(cues: Cue[]): Record<ChannelId, Channel> {
  const zh = makeChannel('zh')
  const en = makeChannel('en')
  const seed = (ch: Channel, entries: Array<[string, number, PushStatus, string?]>) => {
    entries.forEach(([cueId, order, pushStatus, followup]) => {
      ch.cueStates[cueId] = {
        status: 'confirmed',
        followupText: followup || '',
        confirmOrder: order,
        confirmedAt: Date.now() - (4 - order) * 5000,
        pushStatus,
        pushedAt: pushStatus === 'sent' ? Date.now() : null,
        pushAttempts: pushStatus === 'failed' ? 1 : pushStatus === 'sent' ? 1 : 0,
        pushError: pushStatus === 'failed' ? '推送中途失败：字幕网关未确认收到' : ''
      }
      if (pushStatus === 'sent') ch.stage.push(cueId)
    })
    ch.confirmCounter = entries.length
  }
  seed(zh, [['cue-101', 1, 'sent'], ['cue-102', 2, 'sent', '补译：“夜间温差可达数摄氏度。”'], ['cue-103', 3, 'sent']])
  seed(en, [['cue-101', 1, 'sent'], ['cue-103', 2, 'sent'], ['cue-102', 3, 'failed']])
  zh.activeCueId = 'cue-104'
  en.activeCueId = 'cue-104'
  return { zh, en }
}

function demoState(): DeskState {
  const cues = initialCues()
  return {
    speakers, sessions, terms, cues,
    channels: seedChannels(cues),
    channelOrder: ['zh', 'en'],
    mismatchDecisions: {},
    activeChannel: 'zh',
    reminders: [],
    fontScale: 100,
    announcements: [
      { id: 'ann-1', level: 'info', text: '十点整有消防联动测试，请提醒会场人员保持镇定。', visibleOnStage: false, createdAt: new Date().toISOString() },
      { id: 'ann-2', level: 'urgent', text: '请下一位发言人提前到侧台候场。', visibleOnStage: false, createdAt: new Date().toISOString() }
    ],
    online: true, liveSimulation: true, updatedAt: new Date().toISOString()
  }
}

function clone<T>(value: T): T { return structuredClone(value) }

/** 归一化：补齐两路结构与每段状态，兼容旧版本地数据。 */
function normalize(raw: Partial<DeskState>): DeskState {
  const base = demoState()
  const merged: DeskState = {
    ...base,
    ...raw,
    speakers: raw.speakers ?? base.speakers,
    sessions: raw.sessions ?? base.sessions,
    terms: raw.terms ?? base.terms,
    announcements: raw.announcements ?? base.announcements,
    cues: raw.cues ?? base.cues,
    channels: raw.channels ?? base.channels,
    channelOrder: raw.channelOrder ?? base.channelOrder,
    mismatchDecisions: raw.mismatchDecisions ?? {},
    reminders: (raw.reminders ?? []).map(r => ({ ...r, channelId: (r as Reminder).channelId ?? 'zh' })),
    activeChannel: raw.activeChannel ?? 'zh'
  }
  for (const id of merged.channelOrder) {
    const ch = merged.channels[id] ?? makeChannel(id)
    merged.channels[id] = ch
    ch.cueStates = ch.cueStates || {}
    ch.stage = ch.stage || []
    ch.confirmCounter = ch.confirmCounter || 0
    ch.activeCueId = ch.activeCueId || merged.cues.at(-1)?.id || ''
    for (const cue of merged.cues) {
      if (!ch.cueStates[cue.id]) ch.cueStates[cue.id] = defaultCueState()
    }
  }
  if (!merged.channelOrder.length) merged.channelOrder = ['zh', 'en']
  return merged
}

function loadState(): DeskState {
  if (typeof localStorage === 'undefined') return demoState()
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return normalize(JSON.parse(saved))
    // 兼容旧版本 key
    const legacy = localStorage.getItem('conference-cue-desk-v1')
    if (legacy) return normalize(JSON.parse(legacy))
    return demoState()
  } catch { return demoState() }
}

const history: DeskState[] = []
const future: DeskState[] = []
export const desk = writable<DeskState>(loadState())

function persist(state: DeskState) {
  state.updatedAt = new Date().toISOString()
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
function commit(recipe: (state: DeskState) => void) {
  const current = clone(get(desk))
  const next = clone(current)
  recipe(next)
  history.push(current)
  if (history.length > 60) history.shift()
  future.length = 0
  persist(next)
  desk.set(next)
}
export function undoDesk() {
  const previous = history.pop()
  if (!previous) return
  future.push(clone(get(desk)))
  desk.set(previous); persist(previous)
}
export function redoDesk() {
  const next = future.pop()
  if (!next) return
  history.push(clone(get(desk)))
  desk.set(next); persist(next)
}
export const canUndo = () => history.length > 0
export const canRedo = () => future.length > 0

function channelOf(state: DeskState, channelId: ChannelId): Channel {
  return state.channels[channelId]
}
function cueStateOf(state: DeskState, channelId: ChannelId, cueId: string): ChannelCueState {
  const ch = channelOf(state, channelId)
  if (!ch.cueStates[cueId]) ch.cueStates[cueId] = defaultCueState()
  return ch.cueStates[cueId]
}

/* ---------- 后台配置 ---------- */
export function addSpeaker() {
  commit(state => state.speakers.push({ id: `sp-${Date.now()}`, name: '新发言人', title: '待填写机构与职务', language: '待设置语言方向', color: '#475569' }))
}
export function updateSpeaker(id: string, patch: Partial<Speaker>) { commit(state => { const item = state.speakers.find(row => row.id === id); if (item) Object.assign(item, patch) }) }
export function addSession() {
  commit(state => state.sessions.push({ id: `se-${Date.now()}`, order: Math.max(0, ...state.sessions.map(item => item.order)) + 1, time: '11:30', title: '新演讲', speakerId: state.speakers[0]?.id || '', room: '主会场 A', status: 'upcoming' }))
}
export function updateSession(id: string, patch: Partial<Session>) { commit(state => { const item = state.sessions.find(row => row.id === id); if (item) Object.assign(item, patch) }) }
export function addTerm() { commit(state => state.terms.push({ id: `term-${Date.now()}`, source: 'new term', target: '新术语', note: '', speakerId: state.speakers[0]?.id || '', priority: 'normal' })) }
export function updateTerm(id: string, patch: Partial<Term>) { commit(state => { const item = state.terms.find(row => row.id === id); if (item) Object.assign(item, patch) }) }
export function addAnnouncement(text: string, level: Announcement['level']) {
  if (!text.trim()) return
  commit(state => state.announcements.unshift({ id: `ann-${Date.now()}`, level, text: text.trim(), visibleOnStage: false, createdAt: new Date().toISOString() }))
}
export function publishAnnouncement(id: string, visible: boolean) { commit(state => { const item = state.announcements.find(row => row.id === id); if (item) item.visibleOnStage = visible }) }

export function setOnline(online: boolean) {
  commit(state => {
    state.online = online
    if (online) {
      state.cues.forEach(cue => {
        if (cue.offline) {
          cue.offline = false
          const duplicate = findDuplicate(cue.text, state.cues.filter(item => item.id !== cue.id && !item.offline))
          cue.duplicateOf = duplicate?.id || null
        }
      })
    }
  })
}
export function setLiveSimulation(enabled: boolean) { commit(state => { state.liveSimulation = enabled }) }
export function setActiveChannel(channelId: ChannelId) { commit(state => { state.activeChannel = channelId }) }
export function setFontScale(scale: number) { commit(state => { state.fontScale = Math.min(150, Math.max(85, scale)) }) }

/* ---------- 来源队列（两路共享同一段原文，处理各自记账） ---------- */
export function ingestCue(text: string, options: { manual?: boolean; speakerId?: string; receivedAt?: number } = {}) {
  const trimmed = text.trim()
  if (!trimmed) return
  commit(state => {
    const existing = state.cues.filter(item => item.text !== trimmed)
    const duplicate = findDuplicate(trimmed, existing)
    const speakerId = options.speakerId || state.sessions.find(item => item.status === 'live')?.speakerId || state.speakers[0]?.id || ''
    const receivedAt = options.receivedAt || Date.now()
    const cue: Cue = {
      id: `cue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, speakerId, text: trimmed, receivedAt,
      manual: Boolean(options.manual), offline: !state.online, delaySeconds: Math.max(0, Math.round((Date.now() - receivedAt) / 1000)),
      duplicateOf: duplicate?.id || null, tags: detectTerms(trimmed, state.terms)
    }
    state.cues.push(cue)
    for (const ch of Object.values(state.channels)) {
      ch.cueStates[cue.id] = defaultCueState()
      if (!ch.activeCueId) ch.activeCueId = cue.id
    }
  })
}
export function updateCue(id: string, patch: Partial<Cue>) { commit(state => { const cue = state.cues.find(item => item.id === id); if (cue) Object.assign(cue, patch) }) }
export function deleteCue(id: string) {
  commit(state => {
    state.cues = state.cues.filter(item => item.id !== id)
    for (const ch of Object.values(state.channels)) {
      delete ch.cueStates[id]
      ch.stage = ch.stage.filter(cueId => cueId !== id)
      if (ch.activeCueId === id) ch.activeCueId = state.cues.at(-1)?.id || ''
    }
  })
}
export function clearDuplicate(id: string) { commit(state => { const cue = state.cues.find(item => item.id === id); if (cue) cue.duplicateOf = null }) }

/* ---------- 两路各自的确认 / 撤回 / 补译 ---------- */
export function setActiveCue(channelId: ChannelId, id: string) { commit(state => { channelOf(state, channelId).activeCueId = id }) }
export function moveCue(channelId: ChannelId, direction: 1 | -1) {
  const state = get(desk)
  const ch = channelOf(state, channelId)
  const index = state.cues.findIndex(item => item.id === ch.activeCueId)
  const next = state.cues[index + direction]
  if (next) setActiveCue(channelId, next.id)
}

export function confirmCue(channelId: ChannelId, cueId: string) {
  commit(state => {
    const ch = channelOf(state, channelId)
    const cs = cueStateOf(state, channelId, cueId)
    if (cs.status === 'confirmed') return
    cs.status = 'confirmed'
    cs.confirmOrder = ++ch.confirmCounter
    cs.confirmedAt = Date.now()
  })
  pushCue(channelId, cueId)
}

/** 撤回只影响当前语种位：状态回到待传、撤下本路上屏，另一路不动。 */
export function retractCue(channelId: ChannelId, cueId: string) {
  commit(state => {
    const ch = channelOf(state, channelId)
    const cs = cueStateOf(state, channelId, cueId)
    cs.status = 'pending'
    cs.followupText = ''
    cs.confirmOrder = null
    cs.confirmedAt = null
    cs.pushStatus = 'idle'
    cs.pushedAt = null
    cs.pushAttempts = 0
    cs.pushError = ''
    ch.stage = ch.stage.filter(id => id !== cueId)
  })
}

export function saveFollowup(channelId: ChannelId, cueId: string, text: string) {
  const trimmed = text.trim()
  if (!trimmed) return
  commit(state => {
    const ch = channelOf(state, channelId)
    const cs = cueStateOf(state, channelId, cueId)
    cs.followupText = trimmed
    cs.status = 'followup'
    if (cs.confirmOrder == null) {
      cs.confirmOrder = ++ch.confirmCounter
      cs.confirmedAt = Date.now()
    }
  })
}

/* ---------- 推送：失败可重试，已送出的不重复上屏 ---------- */
export function pushCue(channelId: ChannelId, cueId: string) {
  const state = get(desk)
  const cs = state.channels[channelId]?.cueStates[cueId]
  if (!cs) return
  if (cs.pushStatus === 'sent' || cs.pushStatus === 'sending') return // 幂等：已上屏 / 推送中不重复
  const attempt = cs.pushAttempts + 1
  commit(s => {
    const target = cueStateOf(s, channelId, cueId)
    target.pushStatus = 'sending'
    target.pushError = ''
  })
  window.setTimeout(() => {
    const failed = Math.random() < 0.4
    commit(s => {
      const target = cueStateOf(s, channelId, cueId)
      target.pushAttempts = attempt
      if (failed) {
        target.pushStatus = 'failed'
        target.pushError = '推送中途失败：字幕网关未确认收到，可重试'
      } else {
        target.pushStatus = 'sent'
        target.pushedAt = Date.now()
        target.pushError = ''
        const ch = channelOf(s, channelId)
        if (!ch.stage.includes(cueId)) ch.stage.push(cueId) // 只上屏一次
      }
    })
  }, 650)
}

export function pushAllConfirmed(channelId: ChannelId) {
  const state = get(desk)
  const ch = state.channels[channelId]
  state.cues.forEach(cue => {
    const cs = ch.cueStates[cue.id]
    if (cs && (cs.status === 'confirmed' || cs.status === 'followup') && cs.pushStatus !== 'sent' && cs.pushStatus !== 'sending') {
      pushCue(channelId, cue.id)
    }
  })
}

/* ---------- 术语提醒：按语种位各自发送、各自确认 ---------- */
export function sendReminder(channelId: ChannelId, termId: string, cueId: string) {
  commit(state => {
    const exists = state.reminders.some(item => item.channelId === channelId && item.termId === termId && item.cueId === cueId)
    if (exists) return
    state.reminders.unshift({
      id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      channelId, termId, cueId,
      target: state.terms.find(item => item.id === termId)?.target || '',
      createdAt: Date.now(), acknowledged: false
    })
  })
}
export function acknowledgeReminder(channelId: ChannelId, id: string) {
  commit(state => {
    const item = state.reminders.find(row => row.id === id && row.channelId === channelId)
    if (item) item.acknowledged = true
  })
}

/* ---------- 处理先后核对：同一段两路顺序对不上就列出来 ---------- */
export interface Mismatch {
  key: string
  type: 'inversion' | 'missing'
  message: string
  cueA?: string
  cueB?: string
  cueId?: string
}

function processedOrder(ch: Channel, cueId: string): number | null {
  const cs = ch.cueStates[cueId]
  return cs && cs.status !== 'pending' ? cs.confirmOrder : null
}

export function computeMismatches(state: DeskState): Mismatch[] {
  const zh = state.channels.zh
  const en = state.channels.en
  const list: Mismatch[] = []
  const ids = state.cues.map(cue => cue.id)
  const textOf = (id: string) => state.cues.find(cue => cue.id === id)?.text.slice(0, 26) || id

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j]
      const za = processedOrder(zh, a), zb = processedOrder(zh, b)
      const ea = processedOrder(en, a), eb = processedOrder(en, b)
      if (za != null && zb != null && ea != null && eb != null) {
        const zhFirst = za < zb
        const enFirst = ea < eb
        if (zhFirst !== enFirst) {
          const zhOrder = zhFirst ? [a, b] : [b, a]
          const enOrder = enFirst ? [a, b] : [b, a]
          list.push({
            key: `inv:${a}:${b}`, type: 'inversion', cueA: a, cueB: b,
            message: `中文位先「${textOf(zhOrder[0])}」后「${textOf(zhOrder[1])}」；English 位先「${textOf(enOrder[0])}」后「${textOf(enOrder[1])}」`
          })
        }
      }
    }
  }

  const zhCount = ids.filter(id => processedOrder(zh, id) != null).length
  const enCount = ids.filter(id => processedOrder(en, id) != null).length
  if (zhCount > 0 && enCount > 0) {
    for (const id of ids) {
      const z = processedOrder(zh, id)
      const e = processedOrder(en, id)
      if ((z == null) !== (e == null)) {
        list.push({
          key: `miss:${id}`, type: 'missing', cueId: id,
          message: z == null ? `中文位尚未处理「${textOf(id)}」，English 位已处理` : `English 位尚未处理「${textOf(id)}」，中文位已处理`
        })
      }
    }
  }
  return list
}

export function decideMismatch(key: string, decision: MismatchDecisionValue) {
  commit(state => {
    state.mismatchDecisions[key] = { key, decidedAt: Date.now(), decision }
  })
}

/* ---------- 选择器 ---------- */
export function channelCueState(state: DeskState, channelId: ChannelId, cueId: string): ChannelCueState {
  return state.channels[channelId]?.cueStates[cueId] || defaultCueState()
}
export function stageCues(state: DeskState, channelId: ChannelId): Cue[] {
  const ch = state.channels[channelId]
  return ch.stage.map(id => state.cues.find(cue => cue.id === id)).filter((cue): cue is Cue => Boolean(cue))
}
export function activeCueOf(state: DeskState, channelId: ChannelId): Cue | undefined {
  const ch = state.channels[channelId]
  return state.cues.find(cue => cue.id === ch.activeCueId) || state.cues.at(-1)
}
export function channelReminders(state: DeskState, channelId: ChannelId): Reminder[] {
  return state.reminders.filter(item => item.channelId === channelId)
}
export function isProcessed(cs: ChannelCueState): boolean { return cs.status !== 'pending' }

/* ---------- 纯工具 ---------- */
export function getDelay(cue: Cue, now = Date.now()): number { return Math.max(cue.delaySeconds, Math.round((now - cue.receivedAt) / 1000)) }
export function speakerName(state: DeskState, id: string): string { return state.speakers.find(item => item.id === id)?.name || '未指定' }
export function termTarget(state: DeskState, id: string): string { return state.terms.find(item => item.id === id)?.target || '' }
function detectTerms(text: string, terms: Term[]): string[] {
  const lower = text.toLowerCase()
  return terms.filter(term => lower.includes(term.source.toLowerCase()) || lower.includes(term.target)).map(term => term.target)
}
function findDuplicate(text: string, cues: Cue[]): Cue | undefined {
  return cues.find(cue => similarity(text, cue.text) >= 0.72)
}
function similarity(a: string, b: string): number {
  const grams = (value: string) => {
    const clean = value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    return new Set(Array.from({ length: Math.max(0, clean.length - 1) }, (_, index) => clean.slice(index, index + 2)))
  }
  const left = grams(a), right = grams(b)
  if (!left.size || !right.size) return a.trim() === b.trim() ? 1 : 0
  let intersection = 0
  left.forEach(item => { if (right.has(item)) intersection++ })
  return intersection / (left.size + right.size - intersection)
}
