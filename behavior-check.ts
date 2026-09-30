import assert from 'node:assert'
import { get } from 'svelte/store'
import {
  desk, ingestCue, confirmTrack, withdrawTrack, saveTrackFollowup, sendReminder,
  resolveDiscrepancy, retryPush, setPushFailing, schedulePush
} from './src/lib/store'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const state = () => get(desk)
const cue = (id: string) => state().cues.find(c => c.id === id)!
const pending = () => state().discrepancies.filter(d => d.status === 'pending')
const zhOnScreen = () => state().cues.filter(c => c.zh.delivery === 'delivered').map(c => c.id)
const enOnScreen = () => state().cues.filter(c => c.en.delivery === 'delivered').map(c => c.id)

// 测试确定性：关闭随机推送失败（故障由 setPushFailing 显式模拟）
Math.random = () => 1
setPushFailing(false)

// 1. 初始数据：103/104 两路顺序相反 → 生成一条待主管核对单，相关未上屏轨道被挂起
assert.equal(pending().length, 1, '启动即列出 1 条顺序对不上的核对单')
const dscId = pending()[0].id
assert.deepEqual(pending()[0].cueIds, ['cue-103', 'cue-104'])
assert.equal(cue('cue-103').zh.held, true, '103 中文位暂缓上屏')
assert.equal(cue('cue-103').en.held, true, '103 英文位暂缓上屏')
assert.equal(cue('cue-104').zh.delivery, 'failed', '104 中文位是推送失败、等待重试')
assert.equal(cue('cue-104').en.delivery, 'delivered', '104 英文位已上屏，保持不动')
console.log('✓ 顺序对不上 → 列入待主管清单并暂缓未送达的推送')

// 2. 上屏按语种分开：中文栏只有 101/102，英文栏 101/102/104，互不混显
assert.deepEqual(zhOnScreen(), ['cue-101', 'cue-102'])
assert.deepEqual(enOnScreen(), ['cue-101', 'cue-102', 'cue-104'])
console.log('✓ 上屏按语种分开，失败/挂起项不出现在任一栏')

// 3+4. 撤回一路不影响另一路；重新确认走新批次且不重复上屏（用队尾新段，避免改变既有顺序）
ingestCue('Fresh segment for withdrawal isolation test.')
const n0 = state().cues.at(-1)!.id
confirmTrack(n0, 'zh'); confirmTrack(n0, 'en')
await sleep(3500)
assert.deepEqual([cue(n0).zh.delivery, cue(n0).en.delivery], ['delivered', 'delivered'])
withdrawTrack(n0, 'zh')
assert.equal(cue(n0).zh.confirmedAt, null)
assert.equal(cue(n0).zh.delivery, 'retracted')
assert.equal(cue(n0).en.delivery, 'delivered', '英文位内容保持原样上屏')
assert.equal(cue(n0).en.confirmedAt !== null, true)
assert.ok(!zhOnScreen().includes(n0) && enOnScreen().includes(n0))
console.log('✓ 中文位撤回不影响英文位（确认/上屏均独立）')

confirmTrack(n0, 'zh')
assert.ok(cue(n0).zh.deliveryVersion >= 2, '重新确认换了新投递批次号')
const zhVersion = cue(n0).zh.deliveryVersion
await sleep(3500)
assert.equal(cue(n0).zh.delivery, 'delivered', '重新确认的新版本送达上屏')
assert.equal(zhOnScreen().filter(id => id === n0).length, 1, '中文栏该段只出现一次，无重复')
console.log('✓ 撤回后重新确认走新批次，上屏不重复')

// 5. 补译、术语提醒按语种各记各的
saveTrackFollowup('cue-104', 'zh', '中文位补译 A')
saveTrackFollowup('cue-104', 'en', 'EN booth note B')
assert.equal(cue('cue-104').zh.followupText, '中文位补译 A')
assert.equal(cue('cue-104').en.followupText, 'EN booth note B')
sendReminder('term-1', 'cue-104', 'zh')
sendReminder('term-1', 'cue-104', 'en')
assert.equal(state().reminders.filter(r => r.cueId === 'cue-104' && r.lang === 'zh').length, 1)
assert.equal(state().reminders.filter(r => r.cueId === 'cue-104' && r.lang === 'en').length, 1)
console.log('✓ 补译与术语提醒两路各自独立')

// 6. 主管放行后，挂起段落恢复推送并送达；已送达的不重复推送
resolveDiscrepancy(dscId, 'released')
assert.equal(pending().length, 0)
assert.equal(cue('cue-103').zh.held, false)
await sleep(3500)
assert.equal(cue('cue-103').zh.delivery, 'delivered')
assert.equal(cue('cue-103').en.delivery, 'delivered')
assert.deepEqual(enOnScreen(), ['cue-101', 'cue-102', 'cue-103', 'cue-104', n0])
assert.equal(cue('cue-104').en.attempts, 1, '已送达项不会因放行而重推')
console.log('✓ 主管放行后恢复推送，已送达内容不重复上屏')

// 7. 推送失败 → 重试成功；之后再次调度也不会重复
assert.equal(cue('cue-104').zh.delivery, 'failed')
retryPush('cue-104', 'zh')
assert.equal(cue('cue-104').zh.delivery, 'queued')
await sleep(3500)
assert.equal(cue('cue-104').zh.delivery, 'delivered')
const attemptsBefore = cue('cue-104').zh.attempts
schedulePush(); await sleep(3500)
assert.equal(cue('cue-104').zh.attempts, attemptsBefore, '已送达不会被再次推送')
assert.deepEqual(zhOnScreen(), ['cue-101', 'cue-102', 'cue-103', 'cue-104', n0])
console.log('✓ 失败可重试，已送出的不重复上屏')

// 8. 运行时确认顺序错位 → 动态生成核对单；撤回一路后自动消解，不影响另一路
ingestCue('Runtime ordering segment alpha.')
const n1 = state().cues.at(-1)!.id
await sleep(50)
ingestCue('Runtime ordering segment beta.')
const n2 = state().cues.at(-1)!.id
confirmTrack(n1, 'zh'); await sleep(30); confirmTrack(n2, 'zh')
confirmTrack(n2, 'en'); await sleep(30); confirmTrack(n1, 'en')
assert.ok(pending().some(d => d.cueIds.includes(n1) && d.cueIds.includes(n2)), '动态检测到顺序反转')
withdrawTrack(n1, 'en')
assert.ok(!pending().some(d => d.cueIds.includes(n1)), '撤回一路后核对单自动消解')
assert.equal(cue(n1).zh.confirmedAt !== null, true, '中文位确认不受影响')
console.log('✓ 运行时顺序核对可动态生成/消解')

// 9. 驳回关闭同样解除暂缓
ingestCue('Dismiss path alpha.')
const m1 = state().cues.at(-1)!.id
await sleep(50)
ingestCue('Dismiss path beta.')
const m2 = state().cues.at(-1)!.id
confirmTrack(m1, 'zh'); await sleep(30); confirmTrack(m2, 'zh')
confirmTrack(m2, 'en'); await sleep(30); confirmTrack(m1, 'en')
const d2 = pending().find(d => d.cueIds.includes(m1))!
assert.ok(d2)
resolveDiscrepancy(d2.id, 'dismissed')
assert.equal(pending().some(d => d.id === d2.id), false)
console.log('✓ 值班主管可驳回关闭核对单')

console.log('\n全部行为断言通过 ✅')
