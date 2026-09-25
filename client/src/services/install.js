import { useSyncExternalStore } from 'react'

// "Install the app" support. Android/desktop Chrome and Edge hand the page a one-shot install
// prompt (beforeinstallprompt) that we hold on to until the customer taps our button. iPhone has
// no such API — Safari only installs via Share → Add to Home Screen — so we just show the steps.
// This file is imported from main.jsx so the event is caught even though it fires once, early.

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

// Remembers that this device installed the app, so the Install button also stays hidden when the
// site is later opened in a normal browser tab. Keyed by the page's manifest because the customer,
// restaurant and super admin apps are separate installs on the same origin. Only set on real proof
// of install: the browser's appinstalled event, or the page running as the installed app.
const INSTALLED_KEY = `cc-installed:${document.querySelector('link[rel="manifest"]')?.getAttribute('href') || ''}`
const rememberInstalled = (on) => { try { on ? localStorage.setItem(INSTALLED_KEY, '1') : localStorage.removeItem(INSTALLED_KEY) } catch {} }
const wasInstalled = () => { try { return localStorage.getItem(INSTALLED_KEY) === '1' } catch { return false } }

let deferredPrompt = null
if (isInstalled()) rememberInstalled(true)
let installed = isInstalled() || wasInstalled()
const listeners = new Set()
const notify = () => listeners.forEach(l => l())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // suppress the browser's own mini-infobar; our button triggers it instead
  deferredPrompt = e
  // The browser only offers this when the app is NOT installed — so it was uninstalled since.
  if (!isInstalled()) { installed = false; rememberInstalled(false) }
  notify()
})
window.addEventListener('appinstalled', () => {
  installed = true
  deferredPrompt = null
  rememberInstalled(true)
  notify()
})

// Some Chrome versions only treat a site as installable once a service worker is registered.
// /sw.js is the push worker and does no caching, so registering it up front is harmless.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

// 'installed' | 'available' (native prompt ready) | 'ios' (show manual steps) | 'unavailable'
const getState = () => {
  if (installed) return 'installed'
  if (deferredPrompt) return 'available'
  if (isIOS()) return 'ios'
  return 'unavailable'
}

const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb) }
export const useInstallState = () => useSyncExternalStore(subscribe, getState)

// Must be called straight from a tap. Resolves to 'accepted' | 'dismissed' | 'unavailable'.
export const promptInstall = async () => {
  if (!deferredPrompt) return 'unavailable'
  const prompt = deferredPrompt
  deferredPrompt = null // the browser only lets an event be used once
  notify()
  prompt.prompt()
  const { outcome } = await prompt.userChoice
  return outcome
}
