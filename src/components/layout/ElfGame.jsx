import { useEffect, useRef, useState } from 'react'
import { fetchElfLeader, saveElfScore } from '../../lib/elfGame'

/*
 * The elf's game: presents fall from the sky, slide the sleigh under them to
 * catch them, and keep it out from under the coal. A present that lands in the
 * snow costs a life, and so does coal in the sleigh; now and then a heart
 * drifts down that gives one back (letting it fall costs nothing). Out of
 * lives and the round is over. It speeds up the longer you last.
 */

const W = 360 // the playfield in its own units; the canvas scales it to fit
const H = 480
const SLED = { w: 72, h: 24, y: H - 48 }
const BEST_KEY = 'elf-game-best'
const LIVES = 3
const MAX_LIVES = 5
const GROUND = H - 16 // where a dropped present hits the snow
const PRESENT_COLORS = [
  ['#dc2626', '#fde68a'],
  ['#2563eb', '#f8fafc'],
  ['#16a34a', '#fecaca'],
  ['#9333ea', '#fde68a'],
]
const STARS = Array.from({ length: 40 }, () => [Math.random() * W, Math.random() * (H - 80), Math.random() * 1.2 + 0.3])

export default function ElfGame({ onClose }) {
  const canvasRef = useRef(null)
  const game = useRef(null)
  const [phase, setPhase] = useState('ready') // ready | play | over
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY)) || 0)
  const [leader, setLeader] = useState(null)

  // The pool's best round, so there's a number to chase.
  useEffect(() => {
    fetchElfLeader().then(setLeader)
  }, [])

  // Hold the page still and listen for the keyboard while the game is open.
  useEffect(() => {
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      const g = game.current
      if (!g) return
      if (e.key === 'ArrowLeft') g.keys.left = e.type === 'keydown'
      if (e.key === 'ArrowRight') g.keys.right = e.type === 'keydown'
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [onClose])

  // Size the canvas to its box at the screen's pixel density.
  useEffect(() => {
    const canvas = canvasRef.current
    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      const { width } = canvas.getBoundingClientRect()
      canvas.width = width * dpr
      canvas.height = (width * H / W) * dpr
      canvas.getContext('2d').setTransform((width / W) * dpr, 0, 0, (width / W) * dpr, 0, 0)
      if (game.current) draw(canvas.getContext('2d'), game.current)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // Draw the empty scene behind the start screen.
  useEffect(() => {
    if (phase === 'ready') draw(canvasRef.current.getContext('2d'), newGame())
  }, [phase])

  function start() {
    const g = newGame()
    game.current = g
    setScore(0)
    setLives(LIVES)
    setPhase('play')

    const ctx = canvasRef.current.getContext('2d')
    let last = performance.now()
    const tick = (now) => {
      if (game.current !== g) return
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      step(g, dt, {
        onScore: (s) => setScore(s),
        onLives: (l) => setLives(l),
      })
      draw(ctx, g)
      if (g.lives <= 0) {
        setPhase('over')
        saveElfScore(g.score).then(() => fetchElfLeader().then(setLeader))
        setBest((b) => {
          const next = Math.max(b, g.score)
          localStorage.setItem(BEST_KEY, String(next))
          return next
        })
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  // Stop the loop if the game is closed mid-round.
  useEffect(() => () => { game.current = null }, [])

  function aim(e) {
    const g = game.current
    if (!g) return
    const r = canvasRef.current.getBoundingClientRect()
    g.target = ((e.clientX - r.left) / r.width) * W
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The elf's present catch"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgb(2 10 6 / 0.85)', backdropFilter: 'blur(3px)' }}
    >
      <div className="w-full max-w-[380px] rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <div>
            <h2 className="text-sm font-extrabold text-text">🧝 You caught the elf!</h2>
            <p className="text-[11px] text-muted">Catch the presents. Dodge the coal.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close the game" className="text-muted text-xl px-2">
            ×
          </button>
        </div>

        <div className="flex justify-between px-1 pb-2 text-xs font-semibold">
          <span className="text-text">🎁 {score}</span>
          <span aria-label={`${lives} lives left`}>
            {'❤️'.repeat(Math.max(lives, 0))}
            {'🖤'.repeat(Math.max(LIVES - lives, 0))}
          </span>
          <span className="text-primary-light">Best {best}</span>
        </div>
        {leader && (
          <p className="px-1 pb-2 text-[11px] text-muted">
            🏆 Pool best: <span className="font-semibold text-text">{leader.name}</span> with {leader.score}
            {' '}· the top score this week wins a 🎁 on the standings
          </p>
        )}

        <div className="relative">
          <canvas
            ref={canvasRef}
            className="block w-full rounded-xl"
            style={{ aspectRatio: `${W} / ${H}`, touchAction: 'none' }}
            onPointerDown={aim}
            onPointerMove={aim}
          />

          {phase !== 'play' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/50 text-center px-6">
              {phase === 'over' ? (
                <>
                  <p className="text-2xl font-extrabold text-text">{score} presents</p>
                  <p className="text-sm text-muted">
                    {score > 0 && score >= best ? 'A new best! The elf is impressed.' : 'Coal for you this time.'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-text leading-relaxed">
                  Drag your sleigh (or use ← →) to catch falling presents.
                  <br />Gold ones are worth 5. Let one hit the snow, or catch
                  coal, and you lose a life. Grab a falling ❤️ to win one back.
                </p>
              )}
              <button type="button" onClick={start} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white">
                {phase === 'over' ? 'Play again' : 'Start'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function newGame() {
  return {
    x: W / 2,
    target: W / 2,
    keys: { left: false, right: false },
    items: [],
    popups: [],
    spawnIn: 0.6,
    elapsed: 0,
    score: 0,
    lives: LIVES,
    shake: 0,
  }
}

function step(g, dt, { onScore, onLives }) {
  g.elapsed += dt
  g.shake = Math.max(0, g.shake - dt)

  // The sleigh: arrow keys move the aim, then it glides after it.
  if (g.keys.left) g.target -= 420 * dt
  if (g.keys.right) g.target += 420 * dt
  g.target = Math.min(Math.max(g.target, SLED.w / 2), W - SLED.w / 2)
  g.x += (g.target - g.x) * Math.min(1, dt * 14)

  // Something new falls more often, and faster, as the round goes on.
  g.spawnIn -= dt
  if (g.spawnIn <= 0) {
    g.spawnIn = Math.max(0.42, 1.1 - g.elapsed * 0.012)
    const roll = Math.random()
    const coalChance = Math.min(0.32, 0.16 + g.elapsed * 0.003)
    const type =
      roll < 0.04 ? 'heart' :
      roll < 0.11 ? 'gold' :
      roll < 0.11 + coalChance ? 'coal' : 'present'
    g.items.push({
      type,
      x: 20 + Math.random() * (W - 40),
      y: -20,
      size: type === 'coal' ? 22 : 26,
      // Hearts float down slowly, so they're worth going for.
      vy: (type === 'heart' ? 0.6 : 1) * (115 + g.elapsed * 3.5 + Math.random() * 55),
      spin: (Math.random() - 0.5) * 2,
      angle: 0,
      colors: PRESENT_COLORS[Math.floor(Math.random() * PRESENT_COLORS.length)],
    })
  }

  for (const it of g.items) {
    it.y += it.vy * dt
    it.angle += it.spin * dt
    const inReach =
      it.y + it.size / 2 >= SLED.y && it.y - it.size / 2 <= SLED.y + SLED.h &&
      Math.abs(it.x - g.x) <= SLED.w / 2 + it.size / 3
    if (!it.done && inReach) {
      it.done = true
      if (it.type === 'heart') {
    ctx.fillStyle = '#ef4444'
    ctx.shadowColor = '#f87171'
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.moveTo(0, s / 2.4)
    ctx.bezierCurveTo(-s * 0.7, -s * 0.05, -s * 0.35, -s * 0.6, 0, -s * 0.22)
    ctx.bezierCurveTo(s * 0.35, -s * 0.6, s * 0.7, -s * 0.05, 0, s / 2.4)
    ctx.fill()
  } else if (it.type === 'coal') {
        loseLife(g, it.x, 'Coal!', '#9ca3af', onLives)
      } else if (it.type === 'heart') {
        g.lives = Math.min(MAX_LIVES, g.lives + 1)
        onLives(g.lives)
        g.popups.push({ x: it.x, y: SLED.y - 10, text: '+1 ❤️', color: '#f87171', life: 0.8 })
      } else {
        const points = it.type === 'gold' ? 5 : 1
        g.score += points
        onScore(g.score)
        g.popups.push({ x: it.x, y: SLED.y - 10, text: `+${points}`, color: it.type === 'gold' ? '#facc15' : '#f8fafc', life: 0.8 })
      }
    }
  }
  // A present that reaches the snow is a present lost.
  for (const it of g.items) {
    if (!it.done && (it.type === 'present' || it.type === 'gold') && it.y + it.size / 2 >= GROUND) {
      it.done = true
      loseLife(g, it.x, 'Dropped!', '#fca5a5', onLives)
    }
  }
  g.items = g.items.filter((it) => !it.done && it.y < H + 30)

  for (const p of g.popups) {
    p.life -= dt
    p.y -= 40 * dt
  }
  g.popups = g.popups.filter((p) => p.life > 0)
}

function loseLife(g, x, text, color, onLives) {
  g.lives -= 1
  g.shake = 0.3
  onLives(g.lives)
  g.popups.push({ x, y: SLED.y - 10, text, color, life: 0.8 })
}

function draw(ctx, g) {
  ctx.save()
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4)

  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#071423')
  sky.addColorStop(1, '#14324f')
  ctx.fillStyle = sky
  ctx.fillRect(-10, -10, W + 20, H + 20)

  ctx.fillStyle = '#ffffff'
  for (const [x, y, r] of STARS) {
    ctx.globalAlpha = 0.35 + r * 0.3
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Snowy ground.
  ctx.fillStyle = '#e8f1f8'
  ctx.beginPath()
  ctx.moveTo(0, H - 18)
  ctx.quadraticCurveTo(W * 0.25, H - 28, W * 0.5, H - 18)
  ctx.quadraticCurveTo(W * 0.75, H - 8, W, H - 20)
  ctx.lineTo(W, H)
  ctx.lineTo(0, H)
  ctx.fill()

  for (const it of g.items) drawItem(ctx, it)
  drawSled(ctx, g.x)

  ctx.textAlign = 'center'
  ctx.font = 'bold 16px Inter, system-ui, sans-serif'
  for (const p of g.popups) {
    ctx.globalAlpha = Math.min(1, p.life * 2)
    ctx.fillStyle = p.color
    ctx.fillText(p.text, p.x, p.y)
  }
  ctx.restore()
}

function drawItem(ctx, it) {
  const s = it.size
  ctx.save()
  ctx.translate(it.x, it.y)
  ctx.rotate(it.angle * 0.3)
  if (it.type === 'coal') {
    ctx.fillStyle = '#1f2328'
    ctx.beginPath()
    ctx.moveTo(-s / 2, 2)
    ctx.lineTo(-s / 3, -s / 2)
    ctx.lineTo(s / 4, -s / 2 + 2)
    ctx.lineTo(s / 2, -2)
    ctx.lineTo(s / 3, s / 2)
    ctx.lineTo(-s / 4, s / 2 - 1)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#4b5563'
    ctx.fillRect(-s / 5, -s / 4, 4, 3)
    ctx.fillRect(s / 8, 0, 3, 3)
  } else {
    const [box, ribbon] = it.type === 'gold' ? ['#eab308', '#ffffff'] : it.colors
    if (it.type === 'gold') {
      ctx.shadowColor = '#facc15'
      ctx.shadowBlur = 14
    }
    ctx.fillStyle = box
    ctx.fillRect(-s / 2, -s / 2, s, s)
    ctx.shadowBlur = 0
    ctx.fillStyle = ribbon
    ctx.fillRect(-2.5, -s / 2, 5, s)
    ctx.fillRect(-s / 2, -2.5, s, 5)
    ctx.beginPath()
    ctx.ellipse(-5, -s / 2 - 3, 5, 3.5, -0.4, 0, Math.PI * 2)
    ctx.ellipse(5, -s / 2 - 3, 5, 3.5, 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawSled(ctx, x) {
  const { w, h, y } = SLED
  const left = x - w / 2
  // Runner.
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(left - 4, y + h + 6)
  ctx.lineTo(left + w - 2, y + h + 6)
  ctx.quadraticCurveTo(left + w + 10, y + h + 6, left + w + 8, y + h - 6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(left + 12, y + h)
  ctx.lineTo(left + 12, y + h + 6)
  ctx.moveTo(left + w - 14, y + h)
  ctx.lineTo(left + w - 14, y + h + 6)
  ctx.stroke()
  // Body.
  ctx.fillStyle = '#dc2626'
  ctx.beginPath()
  ctx.moveTo(left, y + 4)
  ctx.lineTo(left + w, y)
  ctx.quadraticCurveTo(left + w + 4, y + h, left + w - 8, y + h)
  ctx.lineTo(left + 6, y + h)
  ctx.quadraticCurveTo(left - 4, y + h, left, y + 4)
  ctx.fill()
  ctx.fillStyle = '#facc15'
  ctx.fillRect(left + 4, y + 8, w - 10, 3)
}
