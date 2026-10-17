import { useEffect, useState } from 'react'

let audio: HTMLAudioElement | null = null
const KEY = 'gameSoundEnabled'

const readPref = () => {
  try {
    return localStorage.getItem(KEY) !== 'false'
  } catch {
    return true
  }
}

/** Background music for the games, remembered between visits. */
export function useMusic(playing: boolean) {
  const [enabled, setEnabled] = useState(readPref)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, String(enabled))
    } catch {
      /* ignore */
    }
  }, [enabled])

  useEffect(() => {
    audio ??= Object.assign(new Audio('/sounds/game-background-music.mp3'), { loop: true, volume: 0.35 })
    if (enabled && playing) audio.play().catch(() => {})
    else audio.pause()
  }, [enabled, playing])

  useEffect(() => () => audio?.pause(), [])

  return { enabled, toggle: () => setEnabled((e) => !e) }
}
