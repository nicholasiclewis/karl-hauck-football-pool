/**
 * Why a rejected password-reset link dropped the player on the sign-in screen.
 *
 * Run with:  node --test tests/
 *
 * The behaviour worth pinning down: the reason survives long enough to be
 * shown, and the URL is left clean afterwards so a refresh does not keep
 * accusing the player of a stale link. A stub window stands in for the
 * browser, as in authStorage.test.mjs.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const SITE = 'https://pool.example.com/'

let replaced

/**
 * The module reads the URL at import time, so each case needs a fresh
 * instance. The query string defeats the ESM module cache.
 */
async function loadFresh(href) {
  replaced = null
  globalThis.window = {
    location: { href },
    history: {
      state: { any: 'state' },
      replaceState: (state, _title, url) => { replaced = { state, url } },
    },
  }
  return import(`../src/lib/authRedirectError.js?t=${Math.random()}`)
}

describe('authRedirectError', () => {
  test('an ordinary page load reports nothing and leaves the URL alone', async () => {
    const { authRedirectError } = await loadFresh(SITE)
    assert.equal(authRedirectError, '')
    assert.equal(replaced, null)
  })

  test('an expired link says so, and says how to get another', async () => {
    const { authRedirectError } = await loadFresh(
      `${SITE}#error=access_denied&error_code=otp_expired` +
      '&error_description=Email+link+is+invalid+or+has+expired'
    )
    assert.match(authRedirectError, /expired/i)
    assert.match(authRedirectError, /request a fresh one/i)
  })

  test('the reason is read from the query string too, for the PKCE flow', async () => {
    const { authRedirectError } = await loadFresh(
      `${SITE}?error=access_denied&error_code=otp_expired`
    )
    assert.match(authRedirectError, /expired/i)
  })

  test('an unrecognised code falls back to what Supabase said, spaces intact', async () => {
    const { authRedirectError } = await loadFresh(
      `${SITE}#error=server_error&error_code=unexpected_failure` +
      '&error_description=Database+error+saving+new+user'
    )
    assert.equal(authRedirectError, 'Database error saving new user')
  })

  test('the params are stripped, so a refresh does not re-accuse the player', async () => {
    await loadFresh(
      `${SITE}#error=access_denied&error_code=otp_expired&error_description=gone`
    )
    assert.ok(replaced, 'the URL should have been rewritten')
    assert.equal(replaced.url, SITE)
    assert.deepEqual(replaced.state, { any: 'state' }, 'history state is preserved')
  })

  test('anything else in the URL survives the strip', async () => {
    await loadFresh(`${SITE}?week=3#error=access_denied&keep=this`)
    assert.equal(replaced.url, `${SITE}?week=3#keep=this`)
  })

  test('a link that worked is left completely untouched', async () => {
    const href = `${SITE}#access_token=abc&refresh_token=def&type=recovery`
    const { authRedirectError } = await loadFresh(href)
    assert.equal(authRedirectError, '')
    assert.equal(replaced, null, 'a working callback must reach supabase-js intact')
  })
})
