<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import Button from 'flowbite-svelte/Button.svelte'
  import type { ChannelId } from '$lib/types'
  import {
    desk, activeCueOf, channelCueState, channelReminders, confirmCue, retractCue, saveFollowup,
    sendReminder, acknowledgeReminder, pushCue, pushAllConfirmed, moveCue, setActiveCue,
    speakerName, termTarget, getDelay
  } from '$lib/store'

  export let channelId: ChannelId
  export let armed: boolean = false

  const dispatch = createEventDispatcher<{ arm: ChannelId }>()
  let followupDraft = ''
  let notice = ''

  $: channel = $desk.channels[channelId]
  $: activeCue = activeCueOf($desk, channelId)
  $: cs = activeCue ? channelCueState($desk, channelId, activeCue.id) : undefined
  $: activeTerms = $desk.terms.filter(item => item.speakerId === activeCue?.speakerId || activeCue?.tags.includes(item.target))
  $: reminders = channelReminders($desk, channelId)
  $: unread = reminders.filter(item => !item.acknowledged).length
  $: processedEntries = $desk.cues
    .map(cue => ({ cue, cs: channelCueState($desk, channelId, cue.id) }))
    .filter(entry => entry.cs.status !== 'pending')
  $: pendingCount = $desk.cues.filter(cue => channelCueState($desk, channelId, cue.id).status === 'pending').length
  $: isZh = channelId === 'zh'

  function flash(message: string) {
    notice = message
    window.setTimeout(() => { if (notice === message) notice = '' }, 2600)
  }
  function confirmAndAdvance() {
    if (!activeCue) return
    confirmCue(channelId, activeCue.id)
    flash(isZh ? '中文位已确认并推送，队列自动前进。' : 'EN confirmed and pushed, queue advanced.')
    moveCue(channelId, 1)
  }
  function retract() {
    if (!activeCue) return
    retractCue(channelId, activeCue.id)
    flash(isZh ? '中文位已撤回：回到待传并撤下本路上屏，英文位不受影响。' : 'EN retracted: back to pending and off this stage, other channel unaffected.')
  }
  function submitFollowup() {
    if (!activeCue || !followupDraft.trim()) return
    saveFollowup(channelId, activeCue.id, followupDraft)
    followupDraft = ''
    flash(isZh ? '补译已记入中文位。' : 'Follow-up saved for EN.')
  }
  function reminder(termId: string) {
    if (!activeCue) return
    sendReminder(channelId, termId, activeCue.id)
    flash(`术语提醒已发送（${isZh ? '中文' : 'EN'}）：${termTarget($desk, termId)}`)
  }
  function pushStatusLabel(status: string) {
    return ({ idle: '未推送', sending: '推送中…', sent: '已上屏', failed: '推送失败' })[status] || status
  }
  function statusBadge(status: string) {
    return ({
      confirmed: isZh ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-100 text-emerald-800',
      followup: 'bg-amber-100 text-amber-900',
      pending: 'bg-blue-100 text-blue-800'
    })[status] || 'bg-slate-100 text-slate-700'
  }
</script>

<section class="rounded-2xl border bg-white shadow-sm {armed ? (isZh ? 'ring-2 ring-teal-500' : 'ring-2 ring-indigo-500') : ''}">
  <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
    <button class="flex min-w-0 items-center gap-3 text-left" on:click={() => dispatch('arm', channelId)}>
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-black text-white {isZh ? 'bg-teal-600' : 'bg-indigo-600'}">{channel.short}</span>
      <span class="min-w-0">
        <span class="block truncate font-bold">{channel.label}</span>
        <span class="block text-[10px] text-slate-500">{armed ? '当前操作位 · J/K 与 C 作用于此' : '点击设为当前操作位'}</span>
      </span>
    </button>
    <div class="flex items-center gap-2">
      <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">待传 {pendingCount}</span>
      <div class="flex gap-1">
        <button class="focus-ring rounded-lg border px-2 py-1 text-xs" aria-label="上一条" on:click={() => moveCue(channelId, -1)}>↑</button>
        <button class="focus-ring rounded-lg border px-2 py-1 text-xs" aria-label="下一条" on:click={() => moveCue(channelId, 1)}>↓</button>
      </div>
    </div>
  </div>

  {#if notice}<div role="status" class="mx-4 mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800">{notice}</div>{/if}

  <div class="space-y-4 p-4">
    {#if activeCue && cs}
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="mb-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>{speakerName($desk, activeCue.speakerId)}</span>
          <span>{new Date(activeCue.receivedAt).toLocaleTimeString('zh-CN', { hour12: false })} · 延迟 {getDelay(activeCue)}s</span>
        </div>
        <p class="text-sm leading-6">{activeCue.text}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="rounded-md px-2 py-0.5 text-[10px] font-black {statusBadge(cs.status)}">{cs.status === 'confirmed' ? '已确认' : cs.status === 'followup' ? '有补译' : '待传'}</span>
          <span class="rounded-md px-2 py-0.5 text-[10px] font-black
            {cs.pushStatus === 'sent' ? 'bg-emerald-100 text-emerald-800' : cs.pushStatus === 'failed' ? 'bg-red-100 text-red-800' : cs.pushStatus === 'sending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}">
            {pushStatusLabel(cs.pushStatus)}{#if cs.pushStatus === 'sent'} · 不重复推送{/if}
          </span>
          {#if cs.confirmOrder != null}<span class="text-[10px] text-slate-400">处理序号 #{cs.confirmOrder}</span>{/if}
        </div>
        {#if cs.followupText}<p class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><strong>补译：</strong>{cs.followupText}</p>{/if}
      </div>

      <div class="grid grid-cols-2 gap-2">
        <Button color="green" on:click={confirmAndAdvance}>确认已传并推送 <kbd class="ml-1 text-[10px]">C</kbd></Button>
        <Button color="light" on:click={retract} disabled={cs.status === 'pending'}>撤回本段</Button>
      </div>

      <label for="followup-{channelId}" class="block text-[10px] font-black uppercase tracking-wider text-slate-500">遗漏补译（仅记入{isZh ? '中文' : 'EN'}位）</label>
      <textarea id="followup-{channelId}" class="focus-ring w-full rounded-xl border p-3 text-sm" rows="2" bind:value={followupDraft} placeholder="输入遗漏内容或修正术语…"></textarea>
      <Button class="w-full" color="yellow" disabled={!followupDraft.trim()} on:click={submitFollowup}>标记补译完成</Button>
    {/if}

    <div>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">术语提醒 · {isZh ? '中文' : 'EN'}位</h3>
        <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">{activeTerms.length}</span>
      </div>
      <div class="space-y-2">
        {#each activeTerms as term}
          <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-2.5">
            <div class="min-w-0"><strong class="block truncate text-xs">{term.target}</strong><span class="block truncate text-[10px] text-slate-500">{term.source} · {term.note}</span></div>
            <Button size="xs" color={term.priority === 'high' ? 'yellow' : 'light'} on:click={() => reminder(term.id)}>提醒</Button>
          </div>
        {/each}
        {#if !activeTerms.length}<p class="py-2 text-center text-xs text-slate-400">当前发言人没有匹配术语。</p>{/if}
      </div>
    </div>

    <div>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">推送状态 · 失败可重试</h3>
        <Button size="xs" color="light" on:click={() => pushAllConfirmed(channelId)}>全部重推未上屏</Button>
      </div>
      <div class="max-h-44 space-y-1.5 overflow-y-auto">
        {#each processedEntries as entry}
          <div class="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs {entry.cs.pushStatus === 'failed' ? 'bg-red-50' : 'bg-slate-50'}">
            <span class="min-w-0 truncate"><strong>{entry.cue.text.slice(0, 18)}…</strong> · {pushStatusLabel(entry.cs.pushStatus)}{#if entry.cs.pushAttempts > 0} · 第 {entry.cs.pushAttempts} 次{/if}</span>
            {#if entry.cs.pushStatus === 'failed'}
              <Button size="xs" color="red" on:click={() => pushCue(channelId, entry.cue.id)}>重试</Button>
            {:else if entry.cs.pushStatus === 'sending'}
              <span class="text-[10px] text-amber-700">…</span>
            {:else}
              <span class="text-[10px] text-emerald-700">✓</span>
            {/if}
          </div>
        {/each}
        {#if !processedEntries.length}<p class="py-2 text-center text-xs text-slate-400">确认后在此跟踪推送。</p>{/if}
      </div>
    </div>

    <div>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">本路已发送提醒</h3>
        <span class="text-[10px] text-slate-500">{unread} 条未确认</span>
      </div>
      <div class="max-h-40 space-y-1.5 overflow-y-auto">
        {#each reminders as item}
          <div class="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs {item.acknowledged ? 'bg-slate-50 text-slate-400' : 'bg-teal-50 text-teal-900'}">
            <span class="min-w-0 truncate"><strong>{item.target}</strong> · {new Date(item.createdAt).toLocaleTimeString('zh-CN', { hour12: false })}</span>
            {#if !item.acknowledged}<button class="shrink-0 font-bold underline" on:click={() => acknowledgeReminder(channelId, item.id)}>已看到</button>{/if}
          </div>
        {/each}
        {#if !reminders.length}<p class="py-2 text-center text-xs text-slate-400">尚未发送术语提醒。</p>{/if}
      </div>
    </div>
  </div>
</section>
