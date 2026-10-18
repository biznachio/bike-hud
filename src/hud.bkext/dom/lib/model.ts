/**
 * Pure HUD model: walks an outline snapshot once and sorts what needs
 * attention into overdue, today, the next seven days and stalled work.
 *
 * Free of React and the session API so it can be tested on its own. It reads
 * only native data: `@due`, `@status`, row types and modified dates.
 */

export interface HudRowLike {
  id: number
  type: string
  modified: string
  attributes?: Record<string, string>
  text: { string: string }[]
  children?: HudRowLike[]
}

export interface HudItem {
  id: number
  title: string
  /** The row's project, or its area when it sits directly under one. */
  context: string
  /** Index into the area palette; -1 when the row has no area. */
  area: number
  areaName: string
  /** Ancestor ids from the area down to the parent; empty for a top-level row. */
  ancestorIds: number[]
  /** Whole days from today to the due day (negative when overdue). */
  dayDiff: number
  done: boolean
  /** Whole days since anything in the row's subtree changed (stalled only). */
  idleDays: number
}

export interface HudDay {
  date: Date
  key: string
  count: number
}

export interface HudModel {
  /** The outline's root, the focus when nothing is zoomed in. */
  rootId: number
  overdue: HudItem[]
  today: HudItem[]
  todayDone: number
  todayTotal: number
  /** The next seven days, starting tomorrow. */
  week: HudDay[]
  stalled: HudItem[]
}

/** Days without change before a started row counts as stalled. */
export const STALL_DAYS = 7

const DAY_MS = 86400000

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n)
}

export function dayDiff(date: Date, now: Date): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS)
}

/** Local `YYYY-MM-DD`, the wire form of a date-only value. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A `@due` value as a local day; undefined for "soon" (empty) and junk. */
export function parseDue(raw: string | undefined): Date | undefined {
  if (!raw) return undefined
  const decoded = bike.decodeValue('date', raw)
  return decoded ? startOfDay(decoded.date) : undefined
}

/** Bike stores "no timestamp" as year 0001; anything before 1971 is absent. */
function parseStamp(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const t = Date.parse(raw)
  return Number.isNaN(t) || t < Date.UTC(1971, 0, 1) ? undefined : t
}

export function rowText(row: HudRowLike): string {
  return row.text.map((run) => run.string).join('').trim()
}

function isClosed(status: string | undefined): boolean {
  return status === 'done' || status === 'canceled'
}

/** Latest modified stamp anywhere in the subtree; log rows count as activity. */
function lastActivity(row: HudRowLike): number | undefined {
  let latest = parseStamp(row.modified)
  for (const child of row.children ?? []) {
    const t = lastActivity(child)
    if (t !== undefined && (latest === undefined || t > latest)) latest = t
  }
  return latest
}

export function buildModel(root: HudRowLike | undefined, now: Date): HudModel {
  const overdue: HudItem[] = []
  const today: HudItem[] = []
  const stalled: HudItem[] = []
  const counts = new Array<number>(7).fill(0)

  const visit = (row: HudRowLike, ancestors: HudRowLike[], areaIndex: number) => {
    // A log holds history, not work.
    if (row.type === 'log') return
    const status = row.attributes?.['status']
    const closed = isClosed(status)
    const area = ancestors[0] ?? row
    const parent = ancestors[ancestors.length - 1]
    const context = parent ? rowText(parent) : ''

    const item = (extra: Partial<HudItem>): HudItem => ({
      id: row.id,
      title: rowText(row),
      context,
      area: ancestors.length > 0 ? areaIndex : -1,
      areaName: ancestors.length > 0 ? rowText(area) : '',
      ancestorIds: ancestors.map((a) => a.id),
      dayDiff: 0,
      done: status === 'done',
      idleDays: 0,
      ...extra,
    })

    const due = parseDue(row.attributes?.['due'])
    if (due) {
      const diff = dayDiff(due, now)
      if (diff === 0) {
        // Canceled work neither counts toward today nor against it.
        if (status !== 'canceled') today.push(item({ dayDiff: 0 }))
      } else if (!closed && diff < 0) {
        overdue.push(item({ dayDiff: diff }))
      } else if (!closed && diff <= 7) {
        counts[diff - 1]! += 1
      }
    }

    if (status === 'started') {
      const last = lastActivity(row)
      if (last !== undefined) {
        const idle = Math.floor((now.getTime() - last) / DAY_MS)
        if (idle >= STALL_DAYS) stalled.push(item({ idleDays: idle }))
      }
    }

    // Work under a finished project has left your attention.
    if (closed) return
    const next = [...ancestors, row]
    for (const child of row.children ?? []) visit(child, next, areaIndex)
  }

  ;(root?.children ?? []).forEach((top, index) => visit(top, [], index))

  overdue.sort((a, b) => a.dayDiff - b.dayDiff)
  stalled.sort((a, b) => b.idleDays - a.idleDays)
  // Open first, then what's done, each in outline order.
  today.sort((a, b) => Number(a.done) - Number(b.done))

  const week = counts.map((count, i) => {
    const date = addDays(now, i + 1)
    return { date, key: dayKey(date), count }
  })

  return {
    rootId: root?.id ?? -1,
    overdue,
    today,
    todayDone: today.filter((t) => t.done).length,
    todayTotal: today.length,
    week,
    stalled,
  }
}

/** Filter paths for the editor. `[d]` compares by day. */
export const paths = {
  overdue: (now: Date) => `//(@due <[d] "${dayKey(now)}" and open())`,
  todayOpen: (now: Date) =>
    `//(@due >=[d] "${dayKey(now)}" and @due <[d] "${dayKey(addDays(now, 1))}" and open())`,
  day: (date: Date) => `//(@due >=[d] "${dayKey(date)}" and @due <[d] "${dayKey(addDays(date, 1))}")`,
  nextWeek: (now: Date) =>
    `//(@due >=[d] "${dayKey(addDays(now, 1))}" and @due <[d] "${dayKey(addDays(now, 8))}" and open())`,
}

/**
 * The Monday that starts next week. When that Monday is tomorrow (today is
 * Sunday), it's the one after, so "Next week" never repeats "Tomorrow."
 */
export function nextWeekStart(now: Date): Date {
  const daysToMonday = ((8 - now.getDay()) % 7) || 7
  return addDays(now, daysToMonday === 1 ? 8 : daysToMonday)
}

/** The row with `id` anywhere under `root`. */
export function findRow(root: HudRowLike, id: number): HudRowLike | undefined {
  if (root.id === id) return root
  for (const child of root.children ?? []) {
    const found = findRow(child, id)
    if (found) return found
  }
  return undefined
}
