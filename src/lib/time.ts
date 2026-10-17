import { useEffect, useState } from 'react'
import type { JulEvent } from '../data'

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function countdown(target: string, now: number) {
  const diff = new Date(target).getTime() - now
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true }
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    passed: false,
  }
}

export const eventStatus = (e: JulEvent, now: number) => {
  const start = new Date(e.start).getTime()
  const end = start + e.durationHours * 3_600_000
  return now < start ? 'upcoming' : now < end ? 'live' : 'passed'
}

export const formatDate = (iso: string) => {
  const s = new Date(iso).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
  return s[0].toUpperCase() + s.slice(1)
}

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function downloadIcs(e: JulEvent) {
  const start = new Date(e.start)
  const end = new Date(start.getTime() + e.durationHours * 3_600_000)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daniels Jul//SV',
    'BEGIN:VEVENT',
    `UID:${e.id}-${start.getFullYear()}@danielsjul`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${e.emoji} ${e.name} hos Daniel`,
    `LOCATION:${e.location}`,
    `DESCRIPTION:${e.description.replace(/\n/g, '\\n')} ${location.origin}/event/${e.id}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `${e.id}.ics`
  a.click()
  URL.revokeObjectURL(a.href)
}
