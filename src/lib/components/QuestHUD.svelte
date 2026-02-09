<script>
  import { getQuests } from '../stores/questProgress.svelte.js'

  const quests = $derived(getQuests())
</script>

{#if !quests.escaped}
  <div class="quest-hud">
    <svg class="brush-border" viewBox="0 0 220 160" preserveAspectRatio="none">
      <path d="M8 10 Q20 4 60 7 Q110 3 160 7 Q200 4 212 10 Q218 24 216 55 Q218 90 216 125 Q218 144 212 150 Q200 156 160 153 Q110 157 60 153 Q20 156 8 150 Q2 144 4 125 Q2 90 4 55 Q2 24 8 10Z"
        stroke="rgba(180,140,80,0.5)" stroke-width="1.5" fill="rgba(20,15,10,0.75)" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
    <div class="quest-list">
      <div class="quest-title">Quests</div>
      <label class="quest-item" class:done={quests.tomatoes}>
        <span class="checkbox">
          <svg class="box-border" viewBox="0 0 16 16">
            <path d="M2 3 Q4 1.5 8 2.2 Q12 1.5 14 3 Q15.5 5 15 8 Q15.5 11 14 13 Q12 14.5 8 13.8 Q4 14.5 2 13 Q0.5 11 1 8 Q0.5 5 2 3Z"
              stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
          {#if quests.tomatoes}
            <svg class="check-mark" viewBox="0 0 16 16">
              <path d="M3.5 8.5 Q5 11 6.5 12.5 Q9 7 13 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          {/if}
        </span>
        <span class="label">Pick Tomatoes</span>
      </label>
      <label class="quest-item" class:done={quests.softspot}>
        <span class="checkbox">
          <svg class="box-border" viewBox="0 0 16 16">
            <path d="M2 3 Q4 1.5 8 2.2 Q12 1.5 14 3 Q15.5 5 15 8 Q15.5 11 14 13 Q12 14.5 8 13.8 Q4 14.5 2 13 Q0.5 11 1 8 Q0.5 5 2 3Z"
              stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
          {#if quests.softspot}
            <svg class="check-mark" viewBox="0 0 16 16">
              <path d="M3.5 8.5 Q5 11 6.5 12.5 Q9 7 13 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          {/if}
        </span>
        <span class="label">Mark Soft Spot</span>
      </label>
      <label class="quest-item" class:done={quests.farmerInfo}>
        <span class="checkbox">
          <svg class="box-border" viewBox="0 0 16 16">
            <path d="M2 3 Q4 1.5 8 2.2 Q12 1.5 14 3 Q15.5 5 15 8 Q15.5 11 14 13 Q12 14.5 8 13.8 Q4 14.5 2 13 Q0.5 11 1 8 Q0.5 5 2 3Z"
              stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
          {#if quests.farmerInfo}
            <svg class="check-mark" viewBox="0 0 16 16">
              <path d="M3.5 8.5 Q5 11 6.5 12.5 Q9 7 13 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          {/if}
        </span>
        <span class="label">Talk to Farmer</span>
      </label>
      <label class="quest-item" class:done={quests.shovel}>
        <span class="checkbox">
          <svg class="box-border" viewBox="0 0 16 16">
            <path d="M2 3 Q4 1.5 8 2.2 Q12 1.5 14 3 Q15.5 5 15 8 Q15.5 11 14 13 Q12 14.5 8 13.8 Q4 14.5 2 13 Q0.5 11 1 8 Q0.5 5 2 3Z"
              stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
          {#if quests.shovel}
            <svg class="check-mark" viewBox="0 0 16 16">
              <path d="M3.5 8.5 Q5 11 6.5 12.5 Q9 7 13 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          {/if}
        </span>
        <span class="label">Find Shovel</span>
      </label>
    </div>
  </div>
{/if}

<style>
  .quest-hud {
    position: fixed;
    top: 2%;
    right: 2%;
    z-index: 500;
    width: 180px;
    pointer-events: none;
  }
  .brush-border {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .quest-list {
    position: relative;
    z-index: 1;
    padding: 12px 16px 14px;
  }
  .quest-title {
    font-family: "permanent-marker", sans-serif;
    font-size: 0.85rem;
    color: rgba(232, 212, 160, 0.6);
    margin-bottom: 6px;
    letter-spacing: 1px;
  }
  .quest-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    font-family: "permanent-marker", sans-serif;
    font-size: 0.8rem;
    color: rgba(232, 212, 160, 0.4);
    transition: color 0.3s, opacity 0.3s;
  }
  .quest-item.done {
    color: #f4d03f;
  }
  .checkbox {
    position: relative;
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }
  .checkbox .box-border {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    color: rgba(180, 140, 80, 0.5);
    transition: color 0.3s;
  }
  .quest-item.done .box-border {
    color: rgba(244, 208, 63, 0.6);
  }
  .checkbox .check-mark {
    position: absolute;
    inset: -1px;
    width: calc(100% + 2px);
    height: calc(100% + 2px);
    color: #f4d03f;
  }
</style>
