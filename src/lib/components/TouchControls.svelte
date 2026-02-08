<script>
  import { onMount } from 'svelte'
  import { touchInput } from '../stores/input.js'

  let isTouchDevice = $state(false)

  // Joystick state
  let joystickActive = $state(false)
  let knobX = $state(0)
  let knobY = $state(0)
  let joystickTouchId = null
  let joystickBase = $state(null)

  // Button state
  let jumpActive = $state(false)
  let sprintActive = $state(false)
  let jumpTouchId = null
  let sprintTouchId = null

  const JOYSTICK_RADIUS = 55
  const DEAD_ZONE = 0.2

  onMount(() => {
    isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  })

  function updateJoystick(touch) {
    if (!joystickBase) return
    const rect = joystickBase.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = (touch.clientX - cx) / JOYSTICK_RADIUS
    let dy = (touch.clientY - cy) / JOYSTICK_RADIUS

    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > 1) {
      dx /= dist
      dy /= dist
    }

    knobX = dx * (JOYSTICK_RADIUS - 20)
    knobY = dy * (JOYSTICK_RADIUS - 20)

    touchInput.forward = dy < -DEAD_ZONE
    touchInput.backward = dy > DEAD_ZONE
    touchInput.left = dx < -DEAD_ZONE
    touchInput.right = dx > DEAD_ZONE
    // Analog amounts (0–1) scaled past dead zone
    touchInput.forwardAmount = dy < -DEAD_ZONE ? Math.min(1, (-dy - DEAD_ZONE) / (1 - DEAD_ZONE)) : 0
    touchInput.backwardAmount = dy > DEAD_ZONE ? Math.min(1, (dy - DEAD_ZONE) / (1 - DEAD_ZONE)) : 0
    touchInput.leftAmount = dx < -DEAD_ZONE ? Math.min(1, (-dx - DEAD_ZONE) / (1 - DEAD_ZONE)) : 0
    touchInput.rightAmount = dx > DEAD_ZONE ? Math.min(1, (dx - DEAD_ZONE) / (1 - DEAD_ZONE)) : 0
  }

  function onJoystickStart(e) {
    e.preventDefault()
    const touch = e.changedTouches[0]
    joystickTouchId = touch.identifier
    joystickActive = true
    updateJoystick(touch)
  }

  function onJoystickMove(e) {
    e.preventDefault()
    for (const touch of e.changedTouches) {
      if (touch.identifier === joystickTouchId) {
        updateJoystick(touch)
      }
    }
  }

  function onJoystickEnd(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === joystickTouchId) {
        joystickTouchId = null
        joystickActive = false
        knobX = 0
        knobY = 0
        touchInput.forward = false
        touchInput.backward = false
        touchInput.left = false
        touchInput.right = false
        touchInput.forwardAmount = 0
        touchInput.backwardAmount = 0
        touchInput.leftAmount = 0
        touchInput.rightAmount = 0
      }
    }
  }

  function onJumpStart(e) {
    e.preventDefault()
    const touch = e.changedTouches[0]
    jumpTouchId = touch.identifier
    jumpActive = true
    touchInput.jump = true
  }

  function onJumpEnd(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === jumpTouchId) {
        jumpTouchId = null
        jumpActive = false
        touchInput.jump = false
      }
    }
  }

  function onSprintStart(e) {
    e.preventDefault()
    const touch = e.changedTouches[0]
    sprintTouchId = touch.identifier
    sprintActive = true
    touchInput.sprint = true
  }

  function onSprintEnd(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === sprintTouchId) {
        sprintTouchId = null
        sprintActive = false
        touchInput.sprint = false
      }
    }
  }
</script>

{#if isTouchDevice}
  <div class="touch-controls">
    <!-- Joystick -->
    <div
      class="joystick-base"
      bind:this={joystickBase}
      ontouchstart={onJoystickStart}
      ontouchmove={onJoystickMove}
      ontouchend={onJoystickEnd}
      ontouchcancel={onJoystickEnd}
    >
      <div
        class="joystick-knob"
        class:active={joystickActive}
        style="transform: translate({knobX}px, {knobY}px)"
      ></div>
    </div>

    <!-- Right-side buttons -->
    <div class="buttons">
      <button
        class="btn jump-btn"
        class:active={jumpActive}
        ontouchstart={onJumpStart}
        ontouchend={onJumpEnd}
        ontouchcancel={onJumpEnd}
      >&#x2191;</button>
      <button
        class="btn sprint-btn"
        class:active={sprintActive}
        ontouchstart={onSprintStart}
        ontouchend={onSprintEnd}
        ontouchcancel={onSprintEnd}
      >&#x21E5;</button>
    </div>
  </div>
{/if}

<style>
  .touch-controls {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 100;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }

  .joystick-base {
    pointer-events: auto;
    position: absolute;
    bottom: 40px;
    left: 40px;
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    border: 2px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
  }

  .joystick-knob {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
    transition: background 0.1s;
  }

  .joystick-knob.active {
    background: rgba(255, 255, 255, 0.7);
  }

  .buttons {
    pointer-events: auto;
    position: absolute;
    bottom: 40px;
    right: 40px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    touch-action: none;
  }

  .btn {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
  }

  .btn.active {
    background: rgba(255, 255, 255, 0.4);
    color: white;
  }
</style>
