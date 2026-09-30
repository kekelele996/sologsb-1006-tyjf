import { writable, get } from 'svelte/store'
import type {
  Announcement, Cue, CueStatus, DeskState, Discrepancy, Lang, Reminder,
  Session, Speaker, Term, TrackCue
} from './types'

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

function freshTrack(): TrackCue {
  return {
    confirmedAt: null, withdrawnAt: null, followupText: '', followupAt: null,
    delivery: 'idle', deliveryVersion: 0, deliveredAt: null, attempts: 0, lastError: '', held: false
  }
}
function makeCue(partial: Partial<Cue> & Pick<Cue, 'id' | 'speakerId' | 'text' | 'receivedAt'>): Cue {
  return {
    status: 'pending', manual: false, offline: false, delaySeconds: 0,
    duplicateOf: null, followupText: '', tags: [], zh: freshTrack(), en: freshTrack(), ...partial
  }
}
/** 构造一条已确认且已上屏的语种轨道（用于初始演示数据） */
function deliveredTrack(confirmedAgoMs: number, followupText = ''): TrackCue {
  return {
    confirmedAt: Date.now() - confirmedAgoMs, withdrawnAt: null, followupText,
    followupAt: followupText ? Date.now() - confirmedAgoMs + 4000 : null,
    delivery: 'delivered', deliveryVersion: 1, deliveredAt: Date.now() - confirmedAgoMs + 1200,
    attempts: 1, lastError: '', held: false
  }
}
/** 已确认但推送被顺序核对挂起 / 或推送失败的演示轨道 */
function queuedTrack(confirmedAgoMs: number): TrackCue {
  return { ...freshTrack(), confirmedAt: Date.now() - confirmedAgoMs, delivery: 'queued', deliveryVersion: 1 }
}
function failedTrack(confirmedAgoMs: number, attempts = 2): TrackCue {
  return {
    ...freshTrack(), confirmedAt: Date.now() - confirmedAgoMs, delivery: 'failed',
    deliveryVersion: 1, attempts, lastError: '上屏通道超时（HTTP 504），内容保留在后台等待重试。'
  }
}

function initialCues(): Cue[] {
  const now = Date.now()
  return [
    makeCue({
      id: 'cue-101', speakerId: 'sp-1', text: 'The urban heat island effect is not evenly distributed across a city.',
      receivedAt: now - 42000, delaySeconds: 4, tags: ['城市热岛'], status: 'confirmed',
      zh: deliveredTrack(36000),
      en: deliveredTrack(35000)
    }),
    makeCue({
      id: 'cue-102', speakerId: 'sp-1', text: 'Neighborhoods with less tree canopy can be several degrees warmer at night.',
      receivedAt: now - 24000, delaySeconds: 6, tags: ['树冠覆盖率'], status: 'confirmed',
      followupText: '补译：“夜间温差可达数摄氏度。”',
      zh: deliveredTrack(19000, '补译：“夜间温差可达数摄氏度。”'),
      en: deliveredTrack(18000, 'Addition: up to several degrees cooler.')
    }),
    // 103 与 104：英文位先处理 104 再处理 103，中文位相反 → 两路顺序对不上，挂起等主管放行
    makeCue({
      id: 'cue-103', speakerId: 'sp-1', text: 'Our resilience strategy links cooling corridors with public health investments.',
      receivedAt: now - 14000, delaySeconds: 11, tags: ['韧性', '协同效益'], status: 'confirmed',
      zh: queuedTrack(13000),
      en: queuedTrack(6000)
    }),
    makeCue({
      id: 'cue-104', speakerId: 'sp-1', text: 'That data also reveals health equity gaps between districts.',
      receivedAt: now - 9000, delaySeconds: 9, tags: ['健康公平'], status: 'confirmed',
      // 中文位推送失败，等待重试（重试成功前不上屏）；英文位已上屏
      zh: failedTrack(8000),
      en: deliveredTrack(10000)
    })
  ]
}
function demoState(): DeskState {
  return {
    speakers, sessions, terms, cues: initialCues(), reminders: [
      { id: 'rem-1', termId: 'term-2', cueId: 'cue-103', lang: 'zh', target: '韧性', createdAt: Date.now() - 60000, acknowledged: false }
    ], discrepancies: [], activeCueId: 'cue-104', fontScale: 100,
    announcements: [
      { id: 'ann-1', level: 'info', text: '十点整有消防联动测试，请提醒会场人员保持镇定。', visibleOnStage: false, createdAt: new Date().toISOString() },
      { id: 'ann-2', level: 'urgent', text: '请下一位发言人提前到侧台候场。', visibleOnStage: false, createdAt: new Date().toISOString() }
    ],
    online: true, liveSimulation: true, pushFailing: false, updatedAt: new Date().toISOString()
  }
}
function clone<T>(value: T): T { return structuredClone(value) }

function loadState(): DeskState {
  const base = demoState()
  if (typeof localStorage === 'undefined') return reconcile(base)
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return reconcile(base)
    const parsed = JSON.parse(saved) as Partial<DeskState>
    // 补齐旧版本缺失的语种轨道与核对字段
    const cues = (parsed.cues || []).map(cue => ({ ...makeCue(cue as Cue), zh: { ...freshTrack(), ...cue.zh }, en: { ...freshTrack(), ...cue.en } }))
    const merged: DeskState = {
      ...base, ...parsed, cues,
      reminders: (parsed.reminders || []).map(item => ({ ...item, lang: (item.lang ?? 'zh') as Lang })),
      discrepancies: parsed.discrepancies || [],
      online: navigator.onLine, pushFailing: Boolean(parsed.pushFailing)
    }
    return reconcile(merged)
  } catch { return reconcile(base) }
}

const history: DeskState[] = []
const future: DeskState[] = []
export const desk = writable<DeskState>(loadState())

function persist(state: DeskState) {
  state.updatedAt = new Date().toISOString()
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
function commit(recipe: (state: DeskState) => void, options: { snapshot?: boolean } = {}) {
  const snapshot = options.snapshot ?? true
  const current = clone(get(desk))
  const next = clone(current)
  recipe(next)
  reconcile(next) // 任何改动后都重算两路顺序核对单与暂缓标记
  if (snapshot) {
    history.push(current)
    if (history.length > 60) history.shift()
    future.length = 0
  }
  persist(next)
  desk.set(next)
}
export function undoDesk() {
  const previous = history.pop()
  if (!previous) return
  future.push(clone(get(desk)))
  desk.set(reconcile(previous)); persist(previous)
}
export function redoDesk() {
  const next = future.pop()
  if (!next) return
  history.push(clone(get(desk)))
  const reconciled = reconcile(next)
  desk.set(reconciled); persist(reconciled)
}
export const canUndo = () => history.length > 0
export const canRedo = () => future.length > 0

/* ---------------------------------- 基础维护 ---------------------------------- */

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
export function setPushFailing(enabled: boolean) { commit(state => { state.pushFailing = enabled }) }
export function setActiveCue(id: string) { commit(state => { state.activeCueId = id }) }
export function moveCue(direction: 1 | -1) {
  const state = get(desk)
  const index = state.cues.findIndex(item => item.id === state.activeCueId)
  const next = state.cues[index + direction]
  if (next) setActiveCue(next.id)
}
export function setFontScale(scale: number) { commit(state => { state.fontScale = Math.min(150, Math.max(85, scale)) }) }

/* ---------------------------------- 原文队列 ---------------------------------- */

export function ingestCue(text: string, options: { manual?: boolean; speakerId?: string; receivedAt?: number } = {}) {
  const trimmed = text.trim()
  if (!trimmed) return
  commit(state => {
    const existing = state.cues.filter(item => item.text !== trimmed)
    const duplicate = findDuplicate(trimmed, existing)
    const speakerId = options.speakerId || state.sessions.find(item => item.status === 'live')?.speakerId || state.speakers[0]?.id || ''
    const receivedAt = options.receivedAt || Date.now()
    const cue = makeCue({
      id: `cue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, speakerId, text: trimmed, receivedAt,
      manual: Boolean(options.manual), offline: !state.online,
      delaySeconds: Math.max(0, Math.round((Date.now() - receivedAt) / 1000)),
      duplicateOf: duplicate?.id || null, tags: detectTerms(trimmed, state.terms)
    })
    state.cues.push(cue); state.activeCueId = cue.id
  })
}
export function updateCue(id: string, patch: Partial<Cue>) { commit(state => { const cue = state.cues.find(item => item.id === id); if (cue) Object.assign(cue, patch) }) }
export function setCueStatus(id: string, status: CueStatus) { commit(state => { const cue = state.cues.find(item => item.id === id); if (cue) cue.status = status }) }
export function deleteCue(id: string) {
  commit(state => {
    state.cues = state.cues.filter(item => item.id !== id)
    state.reminders = state.reminders.filter(item => item.cueId !== id)
    // 相关核对单由 commit 末尾的 reconcile 自动作废
    if (state.activeCueId === id) state.activeCueId = state.cues.at(-1)?.id || ''
  })
}
export function clearDuplicate(id: string) { commit(state => { const cue = state.cues.find(item => item.id === id); if (cue) cue.duplicateOf = null }) }

/* ----------------------------- 语种轨道：确认 / 撤回 / 补译 ----------------------------- */

export function confirmTrack(cueId: string, lang: Lang) {
  commit(state => {
    const cue = state.cues.find(item => item.id === cueId)
    if (!cue) return
    const track = cue[lang]
    if (track.confirmedAt) return
    track.confirmedAt = Date.now()
    track.withdrawnAt = null
    track.deliveryVersion += 1
    track.attempts = 0
    track.lastError = ''
    track.delivery = 'queued'
    track.deliveredAt = null
    refreshCueStatus(cue)
  })
  schedulePush()
}

export function withdrawTrack(cueId: string, lang: Lang) {
  commit(state => {
    const cue = state.cues.find(item => item.id === cueId)
    if (!cue) return
    const track = cue[lang]
    if (!track.confirmedAt) return
    track.confirmedAt = null
    track.withdrawnAt = Date.now()
    track.deliveryVersion += 1
    track.held = false
    // 已上屏的版本标记为撤回：舞台按 retracted 过滤，旧内容消失且不会因重试重复上屏
    track.delivery = track.deliveredAt || track.delivery === 'delivered' ? 'retracted' : 'idle'
    track.deliveredAt = null
    track.lastError = ''
    refreshCueStatus(cue)
  })
}

export function saveTrackFollowup(cueId: string, lang: Lang, text: string) {
  const trimmed = text.trim()
  if (!trimmed) return
  commit(state => {
    const cue = state.cues.find(item => item.id === cueId)
    if (!cue) return
    cue[lang].followupText = trimmed
    cue[lang].followupAt = Date.now()
    refreshCueStatus(cue)
  })
}

/* --------------------------------- 术语提醒（按语种） --------------------------------- */

export function sendReminder(termId: string, cueId: string, lang: Lang) {
  commit(state => {
    const exists = state.reminders.some(item => item.termId === termId && item.cueId === cueId && item.lang === lang)
    if (exists) return
    state.reminders.unshift({
      id: `rem-${Date.now()}-${lang}`, termId, cueId, lang,
      target: state.terms.find(item => item.id === termId)?.target || '',
      createdAt: Date.now(), acknowledged: false
    })
  })
}
export function acknowledgeReminder(id: string) { commit(state => { const item = state.reminders.find(row => row.id === id); if (item) item.acknowledged = true }) }

/* ----------------------------- 顺序核对：两路处理先后比对 ----------------------------- */

const LANG_LABEL: Record<Lang, string> = { zh: '中文位', en: '英文位' }
export const langLabel = (lang: Lang) => LANG_LABEL[lang]

/** 比较两路已确认段落的先后；出现交叉反转就生成待裁定核对单 */
function reconcile(state: DeskState): DeskState {
  const orderOf = (lang: Lang) =>
    state.cues
      .filter(cue => cue[lang].confirmedAt !== null)
      .sort((a, b) => (a[lang].confirmedAt as number) - (b[lang].confirmedAt as number))
      .map(cue => cue.id)
  const zhOrder = orderOf('zh')
  const enOrder = orderOf('en')
  const rankIn = (order: string[]) => new Map(order.map((id, index) => [id, index]))
  const zhRank = rankIn(zhOrder), enRank = rankIn(enOrder)
  const common = zhOrder.filter(id => enRank.has(id))

  for (let i = 0; i < common.length; i++) {
    for (let j = i + 1; j < common.length; j++) {
      const a = common[i], b = common[j]
      const inverted = (zhRank.get(a) as number) < (zhRank.get(b) as number)
        && (enRank.get(a) as number) > (enRank.get(b) as number)
      if (!inverted) continue
      const pair = [a, b].sort()
      const cueA = state.cues.find(c => c.id === a)
      const cueB = state.cues.find(c => c.id === b)
      const existing = state.discrepancies.find(d => d.cueIds[0] === pair[0] && d.cueIds[1] === pair[1])
      if (existing) {
        if (existing.status === 'pending') continue
        // 已裁定：若两路确认时间都早于裁定时刻，说明顺序未再变化，不重复挂单
        const ruledAfter = (existing.resolvedAt ?? 0)
        const latestConfirm = Math.max(
          cueA?.zh.confirmedAt ?? 0, cueB?.zh.confirmedAt ?? 0,
          cueA?.en.confirmedAt ?? 0, cueB?.en.confirmedAt ?? 0
        )
        if (ruledAfter >= latestConfirm) continue
      }
      {
        state.discrepancies.unshift({
          id: `dsc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          cueIds: pair as [string, string], langA: 'zh', langB: 'en',
          detectedAt: Date.now(),
          note: `中文位先处理「${cueA?.text.slice(0, 18)}…」再处理「${cueB?.text.slice(0, 18)}…」，英文位顺序相反，请值班主管核对同一段的处理先后。`,
          status: 'pending', resolvedAt: null, resolution: ''
        })
      }
    }
  }
  // 已不存在交叉的未决核对单（撤回或删除后）自动失效
  state.discrepancies.forEach(d => {
    if (d.status !== 'pending') return
    const [a, b] = d.cueIds
    const cueA = state.cues.find(c => c.id === a), cueB = state.cues.find(c => c.id === b)
    if (!cueA || !cueB) {
      d.status = 'dismissed'; d.resolvedAt = Date.now(); d.resolution = '相关段落已不存在。'; return
    }
    const ra = cueA.zh.confirmedAt, rb = cueB.zh.confirmedAt
    const ea = cueA.en.confirmedAt, eb = cueB.en.confirmedAt
    // 任一路撤回了其中一段，该反转不再成立
    if (ra === null || rb === null || ea === null || eb === null) {
      d.status = 'dismissed'; d.resolvedAt = Date.now(); d.resolution = '相关确认已被撤回，核对单自动关闭。'; return
    }
    // 时间戳相同（同一次操作内两路一起确认）视为同序
    const sameOrder = (ra < rb && ea < eb) || (ra > rb && ea > eb) || ra === rb || ea === eb
    if (sameOrder) {
      d.status = 'dismissed'; d.resolvedAt = Date.now(); d.resolution = '两路顺序已恢复一致，核对单关闭。'
    }
  })
  // 刷新暂缓标记：已确认但卷入未决核对单、且尚未上屏的段落先压住不推送
  state.cues.forEach(cue => {
    (['zh', 'en'] as Lang[]).forEach(lang => {
      const track = cue[lang]
      const involved = state.discrepancies.some(d => d.status === 'pending' && d.cueIds.includes(cue.id))
      const settled = track.delivery === 'delivered' || track.delivery === 'retracted'
      track.held = track.confirmedAt !== null && involved && !settled
    })
  })
  return state
}

export function resolveDiscrepancy(id: string, resolution: 'released' | 'dismissed') {
  commit(state => {
    const item = state.discrepancies.find(row => row.id === id)
    if (!item || item.status !== 'pending') return
    item.status = resolution
    item.resolvedAt = Date.now()
    item.resolution = resolution === 'released' ? '值班主管已核对，按当前顺序放行推送。' : '值班主管判定无需处理，核对单关闭。'
    reconcile(state)
  })
  schedulePush()
}

/* --------------------------------- 推送 / 重试（按语种） --------------------------------- */

const PUSH_DELAY_MS = 900
let pushTimer: ReturnType<typeof setTimeout> | null = null

/** 触发一次异步推送调度；入队不重复，送达后不会再推 */
export function schedulePush() {
  if (pushTimer) return
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pumpOnce()
  }, PUSH_DELAY_MS)
}

/** 还有排队项时续排一轮（覆盖“挂起期间拍下空快照、放行后无人重排”的情况） */
function hasQueuedJobs(): boolean {
  const state = get(desk)
  return state.cues.some(cue =>
    (['zh', 'en'] as Lang[]).some(lang => {
      const t = cue[lang]
      return t.confirmedAt !== null && t.delivery === 'queued' && !t.held
    })
  )
}

async function pumpOnce() {
  // 每次启动时快照待推送项；按 (cueId, lang, version) 去重，已送达的不再进入
  const jobs: Array<{ cueId: string; lang: Lang; version: number; attempts: number }> = []
  const state = get(desk)
  for (const cue of state.cues) {
    for (const lang of ['zh', 'en'] as Lang[]) {
      const track = cue[lang]
      // 自动泵只送排队项；failed 必须由口译位显式重试，避免反复自动重推
      if (track.confirmedAt && track.delivery === 'queued' && !track.held) {
        jobs.push({ cueId: cue.id, lang, version: track.deliveryVersion, attempts: track.attempts })
      }
    }
  }
  if (!jobs.length) return
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 600))
  for (const job of jobs) {
    await new Promise(resolve => setTimeout(resolve, 250))
    const current = get(desk)
    const cue = current.cues.find(item => item.id === job.cueId)
    const track = cue?.[job.lang]
    if (!cue || !track || track.deliveryVersion !== job.version) continue // 已撤回 / 重新确认：放弃旧批次
    if (track.delivery === 'delivered') continue                           // 已上屏，绝不重复推送
    if (track.held || !track.confirmedAt) continue
    const failing = current.pushFailing || Math.random() < 0.08
    commit(state => {
      const target = state.cues.find(item => item.id === job.cueId)?.[job.lang]
      if (!target || target.deliveryVersion !== job.version || target.delivery === 'delivered') return
      target.attempts = job.attempts + 1
      if (failing) {
        target.delivery = 'failed'
        target.lastError = '上屏通道超时（HTTP 504），内容保留在后台等待重试。'
      } else {
        target.delivery = 'delivered'
        target.deliveredAt = Date.now()
        target.lastError = ''
        target.held = false
      }
    }, { snapshot: false })
  }
  // 运行期间可能有新确认排队（或放行后解除挂起）：若仍有待送项则续排一轮
  if (hasQueuedJobs()) schedulePush()
}

/** 手动重试某一路某一段的失败推送 */
export function retryPush(cueId: string, lang: Lang) {
  let canRetry = false
  commit(state => {
    const track = state.cues.find(item => item.id === cueId)?.[lang]
    if (track && track.delivery === 'failed') {
      track.delivery = 'queued'
      track.lastError = ''
      canRetry = true
    }
  }, { snapshot: false })
  if (canRetry) schedulePush()
}

/** 一键重试某一路全部失败项 */
export function retryAll(lang: Lang) {
  let any = false
  commit(state => {
    state.cues.forEach(cue => {
      if (cue[lang].delivery === 'failed') { cue[lang].delivery = 'queued'; cue[lang].lastError = ''; any = true }
    })
  }, { snapshot: false })
  if (any) schedulePush()
}

/* ---------------------------------- 派生工具 ---------------------------------- */

function refreshCueStatus(cue: Cue) {
  const tracks = [cue.zh, cue.en]
  if (tracks.some(t => t.followupText)) cue.status = 'followup'
  else if (tracks.some(t => t.confirmedAt !== null)) cue.status = 'confirmed'
  else cue.status = 'pending'
}

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
