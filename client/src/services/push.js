import { pushAPI } from './api'
import { isIOS, isInstalled } from './install'

// Phone/browser push notifications — these arrive even when the site is closed, via the
// service worker in /public/sw.js. The states returned below are what the UI shows:
// 'on' | 'off' | 'blocked' | 'needs-install' (iPhone, not added to home screen) | 'unsupported'.
// Same mechanism for customers ("your order is ready") and restaurants ("new order came in"),
// just subscribed/unsubscribed through different endpoints — see createPushClient below.

const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
// iOS only exposes push to sites added to the Home Screen, so a plain Safari tab has no PushManager.
const unavailableState = () => (isIOS() && !isInstalled() ? 'needs-install' : 'unsupported')

let serverInfo = null
const getServerInfo = async () => {
  if (serverInfo) return serverInfo
  try { serverInfo = (await pushAPI.publicKey()).data.data } catch { return { enabled: false } }
  return serverInfo
}

const urlBase64ToUint8Array = (b64) => {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

const getRegistration = async () => {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

// Builds the {getPushState, enableNotifications, syncPushIfAllowed, disablePush} API for a given
// subscribe/unsubscribe pair, so the customer and restaurant flows share every browser-facing bit
// (permission prompts, VAPID key handling, stale-subscription cleanup) and only differ in which
// server endpoint (and therefore which account) the subscription is filed under.
const createPushClient = (subscribeFn, unsubscribeFn) => {
  // Ensures this device has a push subscription and that the server has it filed under the
  // signed-in account. Safe to call repeatedly (it's how a device gets re-linked after login).
  const syncSubscription = async (publicKey) => {
    const reg = await getRegistration()
    const key = urlBase64ToUint8Array(publicKey)
    let sub = await reg.pushManager.getSubscription()
    // A subscription made under an old VAPID key (keys were rotated) can never be delivered to — replace it.
    const oldKey = sub?.options?.applicationServerKey
    if (sub && oldKey && !new Uint8Array(oldKey).every((b, i) => b === key[i])) {
      await sub.unsubscribe()
      sub = null
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    await subscribeFn(sub.toJSON())
  }

  const getPushState = async () => {
    if (!canPush()) return unavailableState()
    if (!(await getServerInfo()).enabled) return 'unsupported'
    if (Notification.permission === 'denied') return 'blocked'
    if (Notification.permission !== 'granted') return 'off'
    try {
      const reg = await getRegistration()
      return (await reg.pushManager.getSubscription()) ? 'on' : 'off'
    } catch { return 'off' }
  }

  // Asks for permission and subscribes. Must be called straight from a click/tap — browsers
  // (Safari especially) ignore permission prompts that aren't tied to a user gesture, so the
  // prompt is requested before anything is awaited.
  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return unavailableState()
    const asking = Notification.permission === 'default' ? Notification.requestPermission() : null
    const permission = asking ? await asking : Notification.permission
    if (permission === 'denied') return 'blocked'
    if (permission !== 'granted') return 'off'
    if (!canPush()) return unavailableState()
    const info = await getServerInfo()
    if (!info.enabled) return 'unsupported'
    await syncSubscription(info.publicKey)
    return 'on'
  }

  // On app load / login: if this device already allowed notifications, make sure it's attached
  // to *this* account (it may have been last used by someone else, or for a different role).
  const syncPushIfAllowed = async () => {
    try {
      if (!canPush() || Notification.permission !== 'granted') return
      const info = await getServerInfo()
      if (info.enabled) await syncSubscription(info.publicKey)
    } catch {}
  }

  // On sign-out: stop this device receiving this account's notifications. Unsubscribing locally
  // also invalidates the endpoint, so even if the server call fails the server will drop it on
  // its next send. Never throws or holds up sign-out for long.
  const disablePush = async () => {
    try {
      if (!canPush()) return
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (!sub) return
      await Promise.race([unsubscribeFn(sub.endpoint).catch(() => {}), new Promise(r => setTimeout(r, 2500))])
      await sub.unsubscribe()
    } catch {}
  }

  return { getPushState, enableNotifications, syncPushIfAllowed, disablePush }
}

const customerPush = createPushClient(pushAPI.subscribe, pushAPI.unsubscribe)
export const getPushState = customerPush.getPushState
export const enableNotifications = customerPush.enableNotifications
export const syncPushIfAllowed = customerPush.syncPushIfAllowed
export const disablePush = customerPush.disablePush

// Restaurant dashboard ("new order" alerts) — same states/behavior, filed under the signed-in
// restaurant instead of a customer.
export const restaurantPush = createPushClient(pushAPI.restaurantSubscribe, pushAPI.restaurantUnsubscribe)
