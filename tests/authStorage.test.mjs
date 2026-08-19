/**
 * Where a signed-in session is kept.
 *
 * Run with:  node --test tests/
 *
 * The part worth testing is the migration: unchecking "keep me signed in" has
 * to actually move the token out of localStorage, or the next person on the
 * device inherits the session. A stub window stands in for the browser.
 */
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

/** Minimal Storage: enough of the interface for the adapter to walk it. */
function fakeStorage() {
  const map = new Map()
  return {
    get length() { return map.size },
    key:        (i) => [...map.keys()][i] ?? null,
    getItem:    (k) => (map.has(k) ? map.get(k) : null),
    setItem:    (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
    _dump:      () => Object.fromEntries(map),
  }
}

const TOKEN = 'sb-jpeaijrdvbvbpcmuqhgt-auth-token'

let local, session, mod

/**
 * The adapter binds to window.localStorage at import time, so each case needs
 * a fresh module instance. The query string defeats the ESM module cache.
 */
async function loadFresh() {
  local = fakeStorage()
  session = fakeStorage()
  globalThis.window = { localStorage: local, sessionStorage: session }
  return import(`../src/lib/authStorage.js?t=${Math.random()}`)
}

describe('authStorage', () => {
  beforeEach(async () => { mod = await loadFresh() })

  test('remembering is the default, so nobody is logged out by the upgrade', () => {
    assert.equal(mod.isRemembered(), true)
  })

  test('a remembered session is written where it survives the browser', () => {
    mod.setRemembered(true)
    mod.authStorage.setItem(TOKEN, 'jwt')

    assert.equal(local.getItem(TOKEN), 'jwt')
    assert.equal(session.getItem(TOKEN), null)
    assert.equal(mod.authStorage.getItem(TOKEN), 'jwt')
  })

  test('an unremembered session dies with the tab', () => {
    mod.setRemembered(false)
    mod.authStorage.setItem(TOKEN, 'jwt')

    assert.equal(session.getItem(TOKEN), 'jwt')
    assert.equal(local.getItem(TOKEN), null)
    assert.equal(mod.isRemembered(), false)
  })

  test('unchecking moves an existing token out of localStorage', () => {
    mod.setRemembered(true)
    mod.authStorage.setItem(TOKEN, 'jwt')

    mod.setRemembered(false)

    assert.equal(local.getItem(TOKEN), null, 'token must not be left behind')
    assert.equal(session.getItem(TOKEN), 'jwt')
  })

  test('checking promotes a tab-only token so it survives the browser', () => {
    mod.setRemembered(false)
    mod.authStorage.setItem(TOKEN, 'jwt')

    mod.setRemembered(true)

    assert.equal(local.getItem(TOKEN), 'jwt')
    assert.equal(session.getItem(TOKEN), null)
  })

  test('the preference itself always outlives the browser', () => {
    mod.setRemembered(false)
    assert.equal(session.getItem('khfp.remember-me'), null)
    assert.equal(local.getItem('khfp.remember-me'), 'false')
  })

  test('signing out clears both stores', () => {
    mod.setRemembered(true)
    mod.authStorage.setItem(TOKEN, 'jwt')
    session.setItem(TOKEN, 'stale')

    mod.authStorage.removeItem(TOKEN)

    assert.equal(local.getItem(TOKEN), null)
    assert.equal(session.getItem(TOKEN), null)
  })

  test('a store the browser refuses falls back to memory instead of throwing', async () => {
    const denied = {
      get length() { return 0 },
      key: () => null,
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('SecurityError') },
      removeItem: () => { throw new Error('SecurityError') },
    }
    globalThis.window = { localStorage: denied, sessionStorage: denied }
    const isolated = await import(`../src/lib/authStorage.js?t=${Math.random()}`)

    isolated.setRemembered(true)
    isolated.authStorage.setItem(TOKEN, 'jwt')
    assert.equal(isolated.authStorage.getItem(TOKEN), 'jwt')
  })
})
