let sharedContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!sharedContext) sharedContext = new Ctor()
  return sharedContext
}

/** Kısa, iki notalı bir "yeni bildirim geldi" sesi çalar (harici dosya yok, Web Audio ile üretilir). */
export function playNotificationSound() {
  const ctx = getContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const now = ctx.currentTime
  const notes: Array<[frequency: number, start: number, duration: number]> = [
    [880, 0, 0.11],
    [1318.5, 0.09, 0.16],
  ]

  for (const [freq, start, duration] of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, now + start)
    gain.gain.linearRampToValueAtTime(0.16, now + start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + start)
    osc.stop(now + start + duration + 0.02)
  }
}
