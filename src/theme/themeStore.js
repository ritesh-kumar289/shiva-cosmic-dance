// Lightweight pub/sub theme store. Mutated synchronously, accessible from
// both React (via useTheme) and Three.js useFrame loops without re-renders.

const KEY = 'shiva-theme'
const listeners = new Set()

function read() {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {}
  // Match OS preference if no saved choice
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return 'dark'
}

export const themeStore = {
  current: typeof window === 'undefined' ? 'dark' : read(),
}

function applyDom(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f9c39a' : '#05071a')
}

export function setTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return
  themeStore.current = theme
  try { localStorage.setItem(KEY, theme) } catch {}
  applyDom(theme)
  listeners.forEach((fn) => fn(theme))
}

export function toggleTheme() {
  setTheme(themeStore.current === 'dark' ? 'light' : 'dark')
}

export function subscribeTheme(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Apply once at import time so the DOM is themed before React mounts
if (typeof document !== 'undefined') applyDom(themeStore.current)
