<script lang="ts">
  import type { ChannelId } from '$lib/types'
  import { desk, speakerName, stageCues } from '$lib/store'

  export let channelId: ChannelId

  $: channel = $desk.channels[channelId]
  $: cues = stageCues($desk, channelId)
  $: isZh = channelId === 'zh'
</script>

<section class="overflow-hidden rounded-2xl border shadow-lg {isZh ? 'border-teal-800 bg-[#0d3b36]' : 'border-indigo-800 bg-[#1e293b]'} text-white">
  <div class="flex items-center justify-between border-b border-white/10 px-4 py-3">
    <div class="flex items-center gap-3">
      <span class="grid h-9 w-9 place-items-center rounded-lg text-sm font-black {isZh ? 'bg-teal-500' : 'bg-indigo-500'}">{channel.short}</span>
      <div>
        <span class="text-[10px] font-black uppercase tracking-[.16em] {isZh ? 'text-teal-200' : 'text-indigo-200'}">舞台上屏 · {channel.labelEn}</span>
        <h2 class="mt-0.5 font-bold">{isZh ? '中文字幕' : 'English Subtitles'}</h2>
      </div>
    </div>
    <span class="rounded-full px-2.5 py-1 text-[10px] font-black text-white {isZh ? 'bg-teal-600' : 'bg-indigo-600'}">{cues.length} 条在屏</span>
  </div>
  <div class="space-y-3 p-4">
    {#each cues as cue}
      <div class="rounded-xl bg-white/10 p-3">
        <div class="mb-1 flex justify-between text-[10px] {isZh ? 'text-teal-200' : 'text-indigo-200'}">
          <span>{speakerName($desk, cue.speakerId)}</span>
          <span>{new Date(cue.receivedAt).toLocaleTimeString('zh-CN', { hour12: false })}</span>
        </div>
        <p class="text-base leading-relaxed lg:text-lg">{cue.text}</p>
      </div>
    {/each}
    {#if !cues.length}
      <p class="py-5 text-center text-sm text-white/50">
        {isZh ? '中文位推送成功后，字幕在这里上屏。' : 'English subtitles appear here after a successful push.'}
      </p>
    {/if}
  </div>
</section>
