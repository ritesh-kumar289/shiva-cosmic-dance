import { useEffect, useState } from 'react'
import { themeStore, toggleTheme, subscribeTheme } from './themeStore'

export function useTheme() {
  const [theme, set] = useState(themeStore.current)
  useEffect(() => subscribeTheme(set), [])
  return [theme, toggleTheme]
}

export default function ThemeToggle() {
  const [theme, toggle] = useTheme()
  const isLight = theme === 'light'
  return (
    <button
      data-ui="true"
      onClick={(e) => { e.stopPropagation(); toggle() }}
      className="theme-toggle"
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Dark mode' : 'Light mode'}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isLight ? '🌙' : '☀️'}
      </span>
      <span className="theme-toggle__lbl">
        {isLight ? 'NIGHT' : 'DAWN'}
      </span>
    </button>
  )
}
