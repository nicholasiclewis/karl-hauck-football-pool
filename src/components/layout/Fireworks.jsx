import { useEffect, useRef } from 'react'
import { activeTheme } from '../../lib/seasonalTheme'

// A show of one to three rockets goes up every so often (ms between shows).
const GAP = [3_500, 9_000]
const COLORS = ['#fcd34d', '#f8fafc', '#f472b6', '#60a5fa', '#a78bfa', '#34d399', '#fb923c']
const GRAVITY = 90 // px/s²

const between = ([lo, hi]) => lo + Math.random() * (hi - lo)
const pick = (list) => list[Math.floor(Math.random() * list.length)]

/**
 * New Year's fireworks: rockets go up from the bottom of the screen at random
 * and burst over whatever page is open. They never take a tap, and the canvas
 * only animates while something is in the air.
 */
export default function Fireworks() {
  const canvasRef = useRef(null)
  const newYear = activeTheme() === 'newyear'

  useEffect(() => {
    if (!newYear || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let rockets = []
    let sparks = []
    let frame = null
    let last = 0
    let show
    let stopped = false

    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)

    const burst = (x, y, color) => {
      // Sized to the screen, so a burst fills a good part of it on any device.
      const scale = Math.min(window.innerWidth, window.innerHeight) / 400
      const count = 100 + Math.floor(Math.random() * 60)
      const power = (190 + Math.random() * 150) * Math.max(scale, 0.9)
      const second = Math.random() < 0.35 ? pick(COLORS) : color
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.1
        const speed = power * (0.55 + Math.random() * 0.45)
        sparks.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.6 + Math.random() * 0.9,
          max: 2.5,
          color: i % 2 ? color : second,
        })
      }
    }

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      ctx.globalCompositeOperation = 'lighter'

      for (const r of rockets) {
        r.y += r.vy * dt
        r.vy += GRAVITY * dt
        ctx.fillStyle = r.color
        ctx.globalAlpha = 0.9
        ctx.fillRect(r.x - 1.5, r.y, 3, 10)
        if (r.vy >= -40 || r.y <= r.peak) {
          r.done = true
          burst(r.x, r.y, r.color)
        }
      }
      rockets = rockets.filter((r) => !r.done)

      for (const s of sparks) {
        s.vx *= 1 - 1.4 * dt
        s.vy = s.vy * (1 - 1.4 * dt) + GRAVITY * 0.6 * dt
        const px = s.x
        const py = s.y
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.life -= dt
        const fade = Math.max(0, s.life / s.max)
        // A short streak behind each spark, then a bright head on it.
        ctx.globalAlpha = fade * 0.6
        ctx.strokeStyle = s.color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(px - s.vx * 0.04, py - s.vy * 0.04)
        ctx.lineTo(s.x, s.y)
        ctx.stroke()
        ctx.globalAlpha = fade
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.arc(s.x, s.y, 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
      sparks = sparks.filter((s) => s.life > 0)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      frame = rockets.length || sparks.length ? requestAnimationFrame(tick) : null
    }

    const launch = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const shots = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < shots; i++) {
        setTimeout(() => {
          if (stopped) return
          rockets.push({
            x: between([w * 0.12, w * 0.88]),
            y: h,
            vy: -between([h * 0.75, h * 1.0]),
            peak: between([h * 0.18, h * 0.42]),
            color: pick(COLORS),
          })
          if (!frame) {
            last = performance.now()
            frame = requestAnimationFrame(tick)
          }
        }, i * between([150, 500]))
      }
    }

    const schedule = () => {
      show = setTimeout(() => {
        if (!document.hidden) launch()
        schedule()
      }, between(GAP))
    }
    // The first show goes up soon after the page opens.
    show = setTimeout(() => {
      launch()
      schedule()
    }, between([800, 2_500]))

    return () => {
      stopped = true
      clearTimeout(show)
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', fit)
    }
  }, [newYear])

  if (!newYear) return null
  return <canvas ref={canvasRef} className="fireworks" aria-hidden="true" />
}
