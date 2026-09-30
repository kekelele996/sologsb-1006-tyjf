<script lang="ts">
  import type { Mismatch } from '$lib/store'
  import { desk, decideMismatch } from '$lib/store'

  export let pending: Mismatch[] = []
  export let decided: Mismatch[] = []

  function decide(key: string, value: 'zh' | 'en' | 'acknowledged') {
    decideMismatch(key, value)
  }
</script>

<section class="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
  <div class="mb-3 flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <span class="grid h-8 w-8 place-items-center rounded-lg bg-amber-400 text-sm font-black text-amber-950">核</span>
      <div>
        <h2 class="font-black text-amber-950">处理先后核对</h2>
        <p class="text-xs text-amber-800">两路对同一段的确认顺序不一致，或一路已处理、另一路未处理。</p>
      </div>
    </div>
    {#if pending.length}<span class="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-black text-white">{pending.length} 条等值班主管定</span>{:else}<span class="rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black text-white">顺序一致</span>{/if}
  </div>

  {#if pending.length}
    <div class="space-y-2">
      {#each pending as m}
        <div class="rounded-xl border border-amber-200 bg-white p-3">
          <div class="flex items-start gap-2">
            <span class="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black {m.type === 'inversion' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}">
              {m.type === 'inversion' ? '顺序颠倒' : '一路未处理'}
            </span>
            <p class="text-xs font-bold leading-5 text-slate-700">{m.message}</p>
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <button class="rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-black text-white" on:click={() => decide(m.key, 'zh')}>按中文顺序</button>
            <button class="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-black text-white" on:click={() => decide(m.key, 'en')}>按 English 顺序</button>
            <button class="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-600" on:click={() => decide(m.key, 'acknowledged')}>标记已知悉</button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="rounded-xl bg-white/60 py-3 text-center text-xs text-amber-800">两路处理顺序一致，无待裁决项。</p>
  {/if}

  {#if decided.length}
    <details class="mt-3">
      <summary class="cursor-pointer text-[11px] font-bold text-amber-700">已由值班主管决定（{decided.length}）</summary>
      <ul class="mt-2 space-y-1">
        {#each decided as m}
          <li class="rounded-lg bg-white/70 px-3 py-1.5 text-[11px] text-slate-500">
            <span class="font-black">{m.type === 'inversion' ? '顺序颠倒' : '一路未处理'}</span> · {m.message}
            <span class="ml-1 font-black text-emerald-700">
              （{#if $desk.mismatchDecisions[m.key]?.decision === 'zh'}按中文顺序{:else if $desk.mismatchDecisions[m.key]?.decision === 'en'}按 English 顺序{:else}已知悉{/if}）
            </span>
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</section>
