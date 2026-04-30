import { useEffect, useState } from 'react'

const SCENES = [
  {
    id: 1,
    label: 'I — VOID',
    title: 'THE ETERNAL SILENCE',
    sub: 'Before creation, only stillness',
    cls: 'scene-text--1',
    range: [0, 0.22],
  },
  {
    id: 2,
    label: 'II — AWAKENING',
    title: 'CONSCIOUSNESS STIRS',
    sub: null,
    cls: 'scene-text--2',
    range: [0.2, 0.42],
  },
  {
    id: 3,
    label: 'III',
    title: 'तांडव',
    sub: null,
    cls: 'scene-text--3',
    range: [0.4, 0.62],
  },
  {
    id: 4,
    label: 'IV — TRINETRA',
    title: 'THE THIRD EYE OPENS',
    sub: null,
    cls: 'scene-text--4',
    range: [0.6, 0.82],
  },
  {
    id: 5,
    label: null,
    title: null,
    om: true,
    sub: 'RETURN TO THE SOURCE',
    cls: 'scene-text--5',
    range: [0.8, 1.0],
  },
]

function isVisible(range, progress) {
  return progress >= range[0] && progress <= range[1]
}

export default function Overlay({ activeScene, scrollProgress }) {
  const scrollToScene = (index) => {
    const target = (index / 5) * (document.documentElement.scrollHeight - window.innerHeight)
    window.scrollTo({ top: target, behavior: 'smooth' })
  }

  return (
    <div className="overlay" data-ui="true">

      {/* Scene progress dots */}
      <div className="progress-dots" data-ui="true">
        {SCENES.map((scene, i) => (
          <div
            key={scene.id}
            className={`dot ${activeScene === i ? 'dot--active' : ''}`}
            onClick={() => scrollToScene(i)}
            title={scene.label || 'OM'}
          />
        ))}
      </div>
    </div>
  )
}
