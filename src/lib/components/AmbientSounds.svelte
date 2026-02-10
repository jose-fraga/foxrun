<script>
  import { useTask } from '@threlte/core'
  import { onDestroy } from 'svelte'
  import { dayNight } from '../stores/dayNight.js'
  import { isMuted } from '../stores/sound.svelte.js'

  const WIND_VOL = 0.07
  const CRICKET_VOL = 0.15

  let ctx
  let windGain, windFilter
  let time = 0

  // Crickets — audio file, night only
  const cricketAudio = new Audio('/sounds/u_uy2kad5rlq-crickets-395138.mp3')
  cricketAudio.loop = true
  cricketAudio.volume = 0
  let cricketPlaying = false

  function createPinkNoise(seconds) {
    const len = ctx.sampleRate * seconds
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.96900 * b2 + w * 0.1538520
      b3 = 0.86650 * b3 + w * 0.3104856
      b4 = 0.55000 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.0168980
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
    return buf
  }

  function init() {
    try {
      ctx = new AudioContext()
      if (ctx.state === 'suspended') ctx.resume()
    } catch { return }

    // Wind: pink noise → lowpass → gain
    const windBuf = createPinkNoise(4)
    const windSrc = ctx.createBufferSource()
    windSrc.buffer = windBuf
    windSrc.loop = true
    windFilter = ctx.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 350
    windFilter.Q.value = 0.5
    windGain = ctx.createGain()
    windGain.gain.value = 0
    windSrc.connect(windFilter)
    windFilter.connect(windGain)
    windGain.connect(ctx.destination)
    windSrc.start()
  }

  $effect(() => {
    if (isMuted()) {
      if (ctx) {
        if (windGain) windGain.gain.value = 0
      }
      if (cricketPlaying) {
        cricketAudio.pause()
        cricketPlaying = false
      }
    }
  })

  onDestroy(() => {
    if (ctx) { ctx.close(); ctx = null }
    cricketAudio.pause()
  })

  useTask((delta) => {
    if (!ctx) init()
    if (!ctx || isMuted()) return

    time += delta
    const nightFactor = 1 - dayNight.sunFactor

    // Wind — always present, slightly louder at night, gentle gusting
    const windTarget = WIND_VOL * (0.6 + nightFactor * 0.4)
    windGain.gain.value += (windTarget - windGain.gain.value) * 2 * delta
    windFilter.frequency.value = 300 + Math.sin(time * 0.3) * 100

    // Crickets — fade in after sunset using audio file
    const cricketTarget = nightFactor > 0.3
      ? CRICKET_VOL * Math.min(1, (nightFactor - 0.3) / 0.3)
      : 0
    cricketAudio.volume += (cricketTarget - cricketAudio.volume) * 2 * delta
    if (cricketTarget > 0 && !cricketPlaying) {
      cricketAudio.play().catch(() => {})
      cricketPlaying = true
    } else if (cricketTarget <= 0 && cricketPlaying) {
      cricketAudio.pause()
      cricketPlaying = false
    }

  })
</script>
