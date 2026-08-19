/**
 * Where the signed-in session is kept, and how long it survives.
 *
 *   "Keep me signed in" checked  → localStorage. The session outlives the
 *                                  browser, so a player signs in once and
 *                                  stays signed in week to week.
 *   unchecked                    → sessionStorage. The session dies with the
 *                                  tab, which is what you want on a borrowed
 *                                  or shared device.
 *
 * Supabase reads and writes the session through whatever `storage` object it
 * is handed at construction, so the whole choice comes down to which store
 * this adapter points at. Checked is the default: that is what the client did
 * before this existed, and nobody should get logged out by the upgrade.
 */

/** Remembered across sessions itself, so the checkbox comes back as left. */
const REMEMBER_KEY = 'khfp.remember-me'

/** Everything Supabase writes is prefixed this way — used when migrating. */
const AUTH_PREFIX = 'sb-'

/**
 * Stand-in for a store the browser won't give us. Safari in private mode
 * throws on any Storage access; falling back to memory keeps sign-in working
 * for the life of the tab instead of taking the app down on load.
 */
function memoryStore() {
  const map = new Map()
  return {
    get length() { return map.size },
    key:        (i) => [...map.keys()][i] ?? null,
    getItem:    (k) => (map.has(k) ? map.get(k) : null),
    setItem:    (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

/** A store is only usable if it accepts a write — see memoryStore above. */
function resolve(kind) {
  try {
    const store = kind === 'local' ? window.localStorage : window.sessionStorage
    const probe = '__khfp_probe__'
    store.setItem(probe, '1')
    store.removeItem(probe)
    return store
  } catch {
    return memoryStore()
  }
}

const local   = resolve('local')
const session = resolve('session')

/** The Supabase-owned keys currently held by a store. */
function authKeys(store) {
  const keys = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key?.startsWith(AUTH_PREFIX)) keys.push(key)
  }
  return keys
}

/** Whether sessions should outlive the browser. Defaults to yes. */
export function isRemembered() {
  return local.getItem(REMEMBER_KEY) !== 'false'
}

/**
 * Choose where the session lives. Call this before signing in, so the token
 * lands in the right store the moment it is issued.
 *
 * Any session already stored moves with the choice. That matters most in the
 * unchecking direction: without the move, a token left behind in localStorage
 * would sign the next person on this device straight back in.
 */
export function setRemembered(remember) {
  const target = remember ? local : session
  const other  = remember ? session : local

  for (const key of authKeys(other)) {
    const value = other.getItem(key)
    if (value !== null) target.setItem(key, value)
    other.removeItem(key)
  }

  // The preference itself always lives in localStorage — it has to survive the
  // browser closing to be worth anything.
  local.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
}

/** The store the current preference points at. */
function active() {
  return isRemembered() ? local : session
}

export const authStorage = {
  getItem(key) {
    return active().getItem(key)
  },

  setItem(key, value) {
    active().setItem(key, value)
  },

  removeItem(key) {
    // Signing out clears both. A stale copy in the store we are not reading
    // from today would come back the moment the preference flipped.
    local.removeItem(key)
    session.removeItem(key)
  },
}
