import type { JulEvent } from './data'

export function countdown(target: string, now = Date.now()) {
  const ms = Math.max(0, new Date(target).getTime() - now)
  const s = Math.floor(ms / 1000)
  return { done: ms === 0, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}

export const eventStatus = (e: JulEvent, now = Date.now()) => {
  const start = new Date(e.start).getTime()
  const end = start + e.durationHours * 3600_000
  return now < start ? 'upcoming' : now < end ? 'live' : 'past'
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "47 d 03:12:09" – for signs that tick. */
export function clockText(e: JulEvent, now = Date.now()) {
  const st = eventStatus(e, now)
  if (st === 'live') return 'Pågår just nu!'
  if (st === 'past') return 'Över för i år'
  const c = countdown(e.start, now)
  return `${c.days} d ${pad(c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`
}

/** "om 47 dagar" – for sentences. */
export function untilText(e: JulEvent, now = Date.now()) {
  const st = eventStatus(e, now)
  if (st === 'live') return 'pågår just nu'
  if (st === 'past') return 'är redan över för i år'
  const c = countdown(e.start, now)
  if (c.days > 1) return `är om ${c.days} dagar`
  if (c.days === 1) return `är i morgon – om ${24 + c.hours} timmar`
  if (c.hours > 0) return `är om ${c.hours} h ${c.minutes} min`
  return `är om ${c.minutes} minuter!`
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

export const formatShortDate = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

export function downloadIcs(e: JulEvent) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const start = new Date(e.start)
  const end = new Date(start.getTime() + e.durationHours * 3600_000)
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daniels Jul//SV',
    'BEGIN:VEVENT',
    `UID:${e.id}-${start.getFullYear()}@danielsjul`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(`${e.emoji} ${e.name}`)}`,
    `LOCATION:${esc(e.location)}`,
    `DESCRIPTION:${esc(e.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `${e.id}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
