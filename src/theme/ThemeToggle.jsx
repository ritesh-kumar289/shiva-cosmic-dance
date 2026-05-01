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
      className={`theme-toggle ${isLight ? 'theme-toggle--light' : 'theme-toggle--dark'}`}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to night sky' : 'Switch to sunset'}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__sun">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4.2"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        </span>
        <span className="theme-toggle__moon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
          </svg>
        </span>
        <span className="theme-toggle__thumb" />
      </span>
      <span className="theme-toggle__lbl">{isLight ? 'DAWN' : 'NIGHT'}</span>
    </button>
  )
}
