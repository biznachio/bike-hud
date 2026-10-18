import { buildModel, nextWeekStart, HudRowLike } from '../dom/lib/model'

let nextId = 1
function row(text: string, attributes: Record<string, string> = {}, children: HudRowLike[] = [], modified = '2026-10-18T09:00:00Z'): HudRowLike {
  return { id: nextId++, type: 'task', modified, attributes, text: [{ string: text }], children }
}

describe('hud model', () => {
  const now = new Date(2026, 9, 18, 9, 0)
  const root = row('root', {}, [
    row('Work', {}, [
      row('Strategy', {}, [
        row('Late task', { due: '2026-10-09' }),
        row('Today open', { due: '2026-10-18' }),
        row('Today done', { due: '2026-10-18', status: 'done' }),
        row('Today canceled', { due: '2026-10-18', status: 'canceled' }),
        row('Thursday', { due: '2026-10-22' }),
        row('Far off', { due: '2026-11-30' }),
        row('Soon', { due: '' }),
      ]),
      row('Finished project', { status: 'done' }, [row('Hidden late', { due: '2026-10-01' })]),
      row('Old started', { status: 'started' }, [], '2026-10-01T09:00:00Z'),
      row('Busy started', { status: 'started' }, [row('fresh child', {}, [], '2026-10-17T09:00:00Z')], '2026-10-01T09:00:00Z'),
    ]),
  ])
  const model = buildModel(root, now)

  it('sorts rows into sections', () => {
    assert.equal(model.overdue.map((i) => i.title).join('|'), ['Late task'].join('|'))
    assert.equal(model.overdue[0]!.dayDiff, -9)
    assert.equal(model.today.map((i) => i.title).join('|'), ['Today open', 'Today done'].join('|'))
    assert.equal(model.todayDone, 1)
    assert.equal(model.todayTotal, 2)
    assert.equal(model.week[3]!.count, 1)
  })

  it('reads project and area context', () => {
    assert.equal(model.overdue[0]!.context, 'Strategy')
    assert.equal(model.overdue[0]!.areaName, 'Work')
    assert.equal(model.overdue[0]!.ancestorIds.length, 2)
    assert.equal(model.rootId, root.id)
  })

  it('finds stalled work by subtree activity', () => {
    assert.equal(model.stalled.map((i) => i.title).join('|'), ['Old started'].join('|'))
  })

  it('picks next week\'s Monday, never tomorrow', () => {
    assert.equal(nextWeekStart(new Date(2026, 9, 18)).getDate(), 26)
    assert.equal(nextWeekStart(new Date(2026, 9, 19)).getDate(), 26)
    assert.equal(nextWeekStart(new Date(2026, 9, 21)).getDate(), 26)
  })
})
