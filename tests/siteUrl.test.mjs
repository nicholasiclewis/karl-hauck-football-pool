/**
 * Where emailed links point.
 *
 * Run with:  node --test tests/
 *
 * The case that matters is the one that broke: a deployed build must name the
 * production site even when it is itself served from a disposable preview
 * URL, because preview deployments get removed and take every link in every
 * inbox with them. resolveSiteUrl is the pure half, so no browser is needed.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { resolveSiteUrl } from '../src/lib/siteUrl.js'

const PROD = 'https://karl-hauck-football-pool.vercel.app'
const PREVIEW = 'https://karl-hauck-football-pool-nj7ooqh27.vercel.app'

describe('siteUrl', () => {
  test('a preview deployment still mails links to production', () => {
    const url = resolveSiteUrl({
      configured: PROD,
      hostname: 'karl-hauck-football-pool-nj7ooqh27.vercel.app',
      origin: PREVIEW,
    })
    assert.equal(url, PROD, 'a link must outlive the build that sent it')
  })

  test('localhost keeps its own origin, or dev testing is impossible', () => {
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
      const origin = `http://${hostname}:5173`
      assert.equal(resolveSiteUrl({ configured: PROD, hostname, origin }), origin)
    }
  })

  test('a leading space is trimmed — the typo that took the flow down', () => {
    assert.equal(
      resolveSiteUrl({ configured: ` ${PROD} `, hostname: 'x.vercel.app', origin: PREVIEW }),
      PROD
    )
  })

  test('a trailing slash or stray path is normalised away', () => {
    for (const configured of [`${PROD}/`, `${PROD}///`, `${PROD}/login`]) {
      assert.equal(
        resolveSiteUrl({ configured, hostname: 'x.vercel.app', origin: PREVIEW }),
        PROD
      )
    }
  })

  test('an unset or unusable value falls back to production, never to the preview', () => {
    for (const configured of [undefined, '', '   ', 'not-a-url', 'karl-hauck.vercel.app', 42]) {
      const url = resolveSiteUrl({ configured, hostname: 'x.vercel.app', origin: PREVIEW })
      assert.equal(url, PROD, `bad config ${JSON.stringify(configured)} must not fall through`)
      assert.notEqual(url, PREVIEW)
    }
  })

  test('the result is always a bare origin, so it can match an allow-list exactly', () => {
    const url = resolveSiteUrl({ configured: PROD, hostname: 'x.vercel.app', origin: PREVIEW })
    assert.equal(url, new URL(url).origin)
    assert.doesNotMatch(url, /\s/, 'whitespace would fail Supabase string matching')
    assert.doesNotMatch(url, /\/$/, 'a trailing slash would too')
  })
})
