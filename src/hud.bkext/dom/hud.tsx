import { DOMExtensionContext } from 'bike/dom'
import { Disclosure, SFSymbol } from 'bike/components'
import { createRoot } from 'react-dom/client'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import './lib/hud.css'
import {
  HudItem,
  HudModel,
  HudRowLike,
  addDays,
  buildModel,
  dayKey,
  findRow,
  nextWeekStart,
  paths,
  rowText,
} from './lib/model'

// What needs attention today, at a glance, one click from the row.
//
// Everything is read live from the window's outline through the session API.
// The panel writes only through actions you take: checking a row off goes
// through Bike's own task commands, and rescheduling sets native `@due`.
//
// The interface is built on the same pieces as Backlinks and Timeline: the
// label grays and hairline, a light hover fill, accent for "you are here,"
// orange for "waiting on you," the Back chip, hover actions that float over a
// row's end, and a toast that confirms what just happened.

const OVERDUE_LIMIT = 5
const AREA_COLORS = ['blue', 'orange', 'purple', 'green', 'pink', 'brown', 'yellow']
const COLLAPSED_KEY = 'collapsedSections'
const TOAST_MS = 1800

type SectionId = 'overdue' | 'today' | 'stalled'

/** Where you were before a jump zoomed the outline somewhere else. */
interface BackStop {
  focus?: number
  filter?: string
  select?: number
  label: string
}

interface Actions {
  goTo(item: HudItem): void
  toggleDone(item: HudItem): void
  setDue(item: HudItem, date: Date): void
  pickDue(item: HudItem): void
  filter(path: string): void
}

const ActionsContext = createContext<Actions | null>(null)
const useActions = () => useContext(ActionsContext)!

function HudPanel() {
  const [root, setRoot] = useState<HudRowLike | null | undefined>(undefined)
  // Bike updates its outline object in place and passes the same reference
  // back, so the version, not the object, tells React something changed.
  const [version, setVersion] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const [back, setBack] = useState<BackStop | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const rootRef = useRef<HudRowLike | null>(null)
  rootRef.current = root ?? null

  useEffect(() => {
    let sub: SessionSubscription | undefined
    let canceled = false
    bike.session
      .observeOutline(
        { debounce: 250 },
        (outline) => {
          setRoot(outline ? outline.root : null)
          setVersion((v) => v + 1)
        },
        { onClose: () => setRoot(null) }
      )
      .then((s) => {
        if (canceled) s.dispose()
        else sub = s
      })
      .catch(() => setRoot(null))
    return () => {
      canceled = true
      sub?.dispose()
    }
  }, [])

  // A minute tick rolls the day over at midnight and keeps idle days current.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const tenMinutes = Math.floor(now.getTime() / 600_000)
  const model = useMemo(
    () => (root ? buildModel(root, now) : null),
    [root, version, dayKey(now), tenMinutes]
  )

  const say = (message: string) => {
    clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }

  const actions: Actions = {
    async goTo(item) {
      // Stay where you are when the row is already in view; otherwise zoom
      // into the row's area. A filter could hide the row, so it's cleared,
      // as Bike's calendar does. Either change leaves a Back chip.
      try {
        const editor = await bike.session.getEditor()
        const focused = editor.focused ?? []
        const current = focused[focused.length - 1]
        const rootId = rootRef.current?.id
        const inView = current === undefined || current === rootId || current === item.id || item.ancestorIds.includes(current)
        const area = item.ancestorIds[0]
        const refocus = !inView && area !== undefined
        const filtered = !!editor.filter
        if (refocus || filtered) {
          const from = current !== undefined && rootRef.current ? findRow(rootRef.current, current) : undefined
          const fromName = from && from.id !== rootId ? rowText(from) : ''
          setBack({
            focus: current,
            filter: editor.filter ?? undefined,
            select: editor.selection?.head,
            label: fromName || (filtered ? bike.localize('filtered view') : bike.localize('outline')),
          })
        }
        // `activate`: clicking here made the inspector first responder.
        await bike.session.updateEditor({
          ...(refocus ? { focus: area } : {}),
          ...(filtered ? { filter: '' } : {}),
          select: item.id,
          activate: true,
        })
      } catch {
        bike.session.updateEditor({ filter: '', select: item.id, activate: true }).catch(() => {})
      }
    },
    toggleDone(item) {
      // Bike's own commands, so the log and any running clock stay correct.
      bike.session
        .evaluateCommands({ ids: [item.done ? 'task:mark-todo' : 'task:mark-done'], rows: [item.id] })
        .then(() => say(item.done ? bike.localize('Marked not done') : bike.localize('Marked done')))
        .catch(() => {})
    },
    setDue(item, date) {
      const label = date.toLocaleDateString(bike.systemLocale, { weekday: 'short', month: 'short', day: 'numeric' })
      bike.session
        .updateRows({ rows: [item.id], attributes: { due: dayKey(date) } })
        .then(() => say(bike.localize('Due {date}', { date: label })))
        .catch(() => {})
    },
    async pickDue(item) {
      // Bike's date picker works on the editor's selection.
      try {
        await bike.session.updateEditor({ select: item.id, activate: true })
        await bike.session.evaluateCommands({ ids: ['due:set'], rows: [item.id] })
      } catch {
        // The row stays selected, so Bike's own Set Due command still reaches it.
      }
    },
    filter(path) {
      bike.session.updateEditor({ filter: path, activate: true }).catch(() => {})
    },
  }

  const goBack = () => {
    if (!back) return
    bike.session
      .updateEditor({
        ...(back.focus !== undefined ? { focus: back.focus } : {}),
        ...(back.filter ? { filter: back.filter } : {}),
        ...(back.select !== undefined ? { select: back.select } : {}),
        activate: true,
      })
      .catch(() => {})
    setBack(null)
  }

  const heading = now.toLocaleDateString(bike.systemLocale, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <Disclosure className="hud-disclosure" label={heading} defaultExpanded>
      <div className="hud">
        {root === undefined ? null : !model ? (
          <div className="hud-tip">
            <b>{bike.localize('No outline open.')}</b> {bike.localize('Open an outline to see what’s due today.')}
          </div>
        ) : (
          <ActionsContext.Provider value={actions}>
            {back && (
              <div className="hud-nav">
                <button type="button" className="hud-back" onClick={goBack} title={bike.localize('Return to where you were')}>
                  <SFSymbol name="chevron.backward" scale="small" />
                  <span>{bike.localize('Back to {name}', { name: back.label })}</span>
                </button>
              </div>
            )}
            <Hud model={model} now={now} />
          </ActionsContext.Provider>
        )}
        {toast && (
          <div className="hud-toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </Disclosure>
  )
}

function useCollapsed(): [Set<SectionId>, (id: SectionId) => void] {
  const [collapsed, setCollapsed] = useState<Set<SectionId>>(() => {
    const saved = bike.defaults.get(COLLAPSED_KEY)
    return new Set(Array.isArray(saved) ? (saved as SectionId[]) : [])
  })
  const toggle = (id: SectionId) => {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCollapsed(next)
    bike.defaults.set(COLLAPSED_KEY, [...next])
  }
  return [collapsed, toggle]
}

function Hud({ model, now }: { model: HudModel; now: Date }) {
  const actions = useActions()
  const [collapsed, toggle] = useCollapsed()
  // Stalled work stays behind its tag until you ask for it.
  const [showStalled, setShowStalled] = useState(false)
  const left = model.todayTotal - model.todayDone
  const clear = model.overdue.length === 0 && left === 0

  return (
    <>
      <Band model={model} now={now} clear={clear} showStalled={showStalled} onStalled={() => setShowStalled(!showStalled)} />

      {model.overdue.length > 0 && (
        <Section id="overdue" title={bike.localize('Overdue')} count={model.overdue.length} collapsed={collapsed} onToggle={toggle}>
          {model.overdue.slice(0, OVERDUE_LIMIT).map((item) => (
            <TaskRow key={item.id} item={item} now={now} kind="overdue" />
          ))}
          {model.overdue.length > OVERDUE_LIMIT && (
            <button type="button" className="hud-link hud-more" onClick={() => actions.filter(paths.overdue(now))}>
              {bike.localize('{count} more overdue', { count: model.overdue.length - OVERDUE_LIMIT })}
            </button>
          )}
        </Section>
      )}

      {!clear && model.today.length > 0 && (
        <Section id="today" title={bike.localize('Today')} count={left} collapsed={collapsed} onToggle={toggle}>
          {model.today.map((item) => (
            <TaskRow key={item.id} item={item} now={now} kind="today" />
          ))}
        </Section>
      )}

      {showStalled && model.stalled.length > 0 && (
        <Section id="stalled" title={bike.localize('Stalled')} count={model.stalled.length} collapsed={collapsed} onToggle={toggle}>
          {model.stalled.map((item) => (
            <TaskRow key={item.id} item={item} now={now} kind="stalled" />
          ))}
        </Section>
      )}
    </>
  )
}

// MARK: Band

function Ring({ done, total, clear }: { done: number; total: number; clear: boolean }) {
  const r = 21
  const c = 2 * Math.PI * r
  const filled = clear ? c : total === 0 ? 0 : (done / total) * c
  const label = clear ? bike.localize('All clear') : bike.localize('{done} of {total} due today done', { done, total })
  return (
    <div className={`hud-ring${clear ? ' hud-ring--clear' : ''}`} role="img" aria-label={label}>
      <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
        <circle className="hud-ring-track" cx="26" cy="26" r={r} />
        {filled > 0 && (
          <circle className="hud-ring-fill" cx="26" cy="26" r={r} strokeDasharray={`${filled} ${c}`} transform="rotate(-90 26 26)" />
        )}
      </svg>
      <div className="hud-ring-label">
        {clear ? (
          <SFSymbol name="checkmark" weight="bold" />
        ) : (
          <>
            {done}
            <span className="hud-ring-total">/{total}</span>
          </>
        )}
      </div>
    </div>
  )
}

function Band({
  model,
  now,
  clear,
  showStalled,
  onStalled,
}: {
  model: HudModel
  now: Date
  clear: boolean
  showStalled: boolean
  onStalled: () => void
}) {
  const actions = useActions()
  const left = model.todayTotal - model.todayDone
  const summary = clear ? bike.localize('All clear') : model.todayTotal === 0 ? bike.localize('Nothing due today') : null
  return (
    <div className="hud-band">
      <Ring done={model.todayDone} total={model.todayTotal} clear={clear} />
      <div className="hud-band-side">
        <div className="hud-band-top">
          {summary ? (
            <span className={clear ? 'hud-clear-title' : 'hud-summary'}>{summary}</span>
          ) : (
            left > 0 && (
              <button
                type="button"
                className="hud-tag hud-tag--today"
                title={bike.localize('Show what\u2019s left today')}
                onClick={() => actions.filter(paths.todayOpen(now))}
              >
                {bike.localize('{count, plural, one {# left today} other {# left today}}', { count: left })}
              </button>
            )
          )}
          {model.overdue.length > 0 && (
            <button
              type="button"
              className="hud-tag hud-tag--late"
              title={bike.localize('Show overdue rows')}
              onClick={() => actions.filter(paths.overdue(now))}
            >
              {bike.localize('{count} overdue', { count: model.overdue.length })}
            </button>
          )}
          {model.stalled.length > 0 && (
            <button
              type="button"
              className={`hud-tag hud-tag--wait${showStalled ? ' hud-tag--on' : ''}`}
              aria-pressed={showStalled}
              title={showStalled ? bike.localize('Hide stalled rows') : bike.localize('Show stalled rows')}
              onClick={onStalled}
            >
              {bike.localize('{count} stalled', { count: model.stalled.length })}
            </button>
          )}
        </div>
        <WeekStrip model={model} />
      </div>
    </div>
  )
}

// The week as Backlinks' activity strip: one cell per day, deeper with more due.
function WeekStrip({ model }: { model: HudModel }) {
  const actions = useActions()
  const letter = new Intl.DateTimeFormat(bike.systemLocale, { weekday: 'narrow' })
  const name = new Intl.DateTimeFormat(bike.systemLocale, { weekday: 'long', month: 'short', day: 'numeric' })
  return (
    <div className="hud-strip" role="group" aria-label={bike.localize('Next 7 days')}>
      {model.week.map((day) => {
        const level = Math.min(day.count, 3)
        const label = bike.localize('{day}: {count, plural, one {# due} other {# due}}', {
          day: name.format(day.date),
          count: day.count,
        })
        return (
          <button
            type="button"
            key={day.key}
            className="hud-day"
            title={label}
            aria-label={label}
            onClick={() => actions.filter(paths.day(day.date))}
          >
            <span className={`hud-cell hud-on${level}`} />
            <span className="hud-day-letter">{letter.format(day.date)}</span>
          </button>
        )
      })}
    </div>
  )
}

// MARK: Sections

function Section({
  id,
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  id: SectionId
  title: string
  count: number
  collapsed: Set<SectionId>
  onToggle: (id: SectionId) => void
  children: React.ReactNode
}) {
  const open = !collapsed.has(id)
  return (
    <section className="hud-sec">
      <button type="button" className="hud-sech" aria-expanded={open} onClick={() => onToggle(id)}>
        <SFSymbol className="hud-peek" name="chevron.right" scale="small" />
        <span className="hud-sech-title">{title}</span>
        {count > 0 && <span className="hud-sec-n">{count}</span>}
      </button>
      {open && <div className="hud-list">{children}</div>}
    </section>
  )
}

type RowKind = 'overdue' | 'today' | 'stalled'

function TaskRow({ item, now, kind }: { item: HudItem; now: Date; kind: RowKind }) {
  const actions = useActions()
  const title = item.title || bike.localize('Untitled')
  const checkable = kind !== 'stalled'
  const reschedulable = checkable && !item.done
  const tooltip = [item.context, item.areaName && item.areaName !== item.context ? item.areaName : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={`hud-row${item.done ? ' hud-row--done' : ''}`} title={tooltip || undefined}>
      {checkable ? (
        <button
          type="button"
          className="hud-check"
          aria-label={item.done ? bike.localize('Mark not done') : bike.localize('Mark done')}
          onClick={() => actions.toggleDone(item)}
        >
          <SFSymbol name={item.done ? 'checkmark.square.fill' : 'square'} />
        </button>
      ) : (
        <SFSymbol className="hud-stall-icon" name="hourglass" />
      )}
      <span
        className="hud-dot"
        style={item.area >= 0 ? { background: `var(--system-${AREA_COLORS[item.area % AREA_COLORS.length]})` } : undefined}
      />
      <button type="button" className="hud-t" onClick={() => actions.goTo(item)}>
        {title}
      </button>

      {kind === 'overdue' && (
        <span className={`hud-pill hud-late--${heat(-item.dayDiff)}`}>{bike.localize('{count}d', { count: -item.dayDiff })}</span>
      )}
      {kind === 'stalled' && <span className="hud-pill hud-pill--wait">{bike.localize('{count}d', { count: item.idleDays })}</span>}

      {reschedulable && (
        <span className="hud-acts">
          <RescheduleMenu item={item} now={now} />
        </span>
      )}
    </div>
  )
}

// One calendar button opens labeled choices, so no icon has to explain itself.
function RescheduleMenu({ item, now }: { item: HudItem; now: Date }) {
  const actions = useActions()
  const [open, setOpen] = useState(false)
  const [above, setAbove] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const tomorrow = addDays(now, 1)
  const monday = nextWeekStart(now)
  const short = (d: Date) => d.toLocaleDateString(bike.systemLocale, { weekday: 'short', month: 'short', day: 'numeric' })

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const toggle = () => {
    // Open upward when the menu would run past the bottom of the panel.
    const box = wrap.current?.getBoundingClientRect()
    const panel = wrap.current?.closest('.hud')?.getBoundingClientRect()
    setAbove(!!box && !!panel && box.bottom + 104 > panel.bottom)
    setOpen(!open)
  }
  const choose = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <span ref={wrap} className={`hud-menu-wrap${open ? ' hud-menu-wrap--open' : ''}`}>
      <button
        type="button"
        className="hud-act"
        aria-label={bike.localize('Reschedule')}
        aria-haspopup="menu"
        aria-expanded={open}
        title={bike.localize('Reschedule')}
        onClick={toggle}
      >
        <SFSymbol name="calendar" scale="small" />
      </button>
      {open && (
        <span className={`hud-menu${above ? ' hud-menu--above' : ''}`} role="menu">
          <button type="button" role="menuitem" onClick={choose(() => actions.setDue(item, tomorrow))}>
            <span>{bike.localize('Tomorrow')}</span>
            <span className="hud-menu-date">{short(tomorrow)}</span>
          </button>
          <button type="button" role="menuitem" onClick={choose(() => actions.setDue(item, monday))}>
            <span>{bike.localize('Next week')}</span>
            <span className="hud-menu-date">{short(monday)}</span>
          </button>
          <span className="hud-menu-sep" />
          <button type="button" role="menuitem" onClick={choose(() => actions.pickDue(item))}>
            <span>{bike.localize('Pick a Date\u2026')}</span>
          </button>
        </span>
      )}
    </span>
  )
}

function heat(daysLate: number): 'fresh' | 'warm' | 'hot' {
  return daysLate >= 7 ? 'hot' : daysLate >= 3 ? 'warm' : 'fresh'
}

export function activate(context: DOMExtensionContext) {
  createRoot(context.element).render(<HudPanel />)
}
