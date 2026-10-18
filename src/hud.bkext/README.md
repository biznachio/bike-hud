# HUD

A heads-up display for Bike. It shows what needs attention today in one glance and gets you to it in one click.

HUD is a dashboard, not a planner. Bike holds the work. HUD answers one question: what's waiting on me right now?

## Install

Double-click `hud.bkext`, or drag it onto Bike. HUD adds an item to the inspector, the same place the calendar lives. Open the inspector and choose HUD.

## What you see

**The band** at the top holds three things:

- A ring that fills as you finish what's due today.
- Tags for what's left today, what's overdue and what's stalled. Click the blue tag to filter the outline to what's still open today, or the red one for overdue rows. Click the orange stalled tag to show or hide the Stalled list.
- One cell for each of the next seven days, starting tomorrow. A cell gets deeper as more is due. Hover a cell for the date and count, and click it to filter the outline to that day.

Once nothing is overdue and today's work is done, the ring closes with a checkmark and the band reads All clear.

**Overdue** lists open rows past their due date, oldest first. The chip shows how many days late each one is, and it gets louder with age: pale at a day or two, stronger at three, solid red after a week. The first five show here, with a link to the rest.

**Today** lists everything due today. Finished rows stay in the list, struck through, so you can see progress.

**Stalled** lists rows marked Started that haven't changed in a week or more. A change anywhere inside the row counts, so a project with recent work in its tasks isn't stalled. The list stays hidden until you click its tag.

Click a section title to collapse it. Bike remembers which sections you close.

Each row is one line, with a dot colored by area. Areas are your top-level rows, and colors follow their order in the outline. Hover a row to see its project and area.

## Acting from the HUD

- **Click a row** to select it in the outline. If you're zoomed into a different area, HUD zooms into the row's area first, so you land in context instead of the whole outline. If a filter is on, HUD clears it so the row isn't hidden. Either way, a Back chip appears at the top to return you to where you were, filter included.
- **Click the checkbox** to mark it done. HUD uses Bike's own task commands, so logs and clocks stay correct.
- **Hover a row** in Overdue or Today and click the calendar button, which takes the place of the lateness pill, to reschedule it. A menu offers Tomorrow and Next week, each with its date, plus Pick a Date for Bike's own date picker. A short confirmation appears at the bottom after each change.

## What HUD reads and writes

HUD reads native data only: `@due`, `@status`, row types and modified dates. It writes only when you act: the done state through Bike's commands, and `@due` when you reschedule. It adds no attributes of its own.

A few rules shape what appears:

- A `@due` with no date ("Soon") isn't shown, since it has no day to count from.
- Rows under a done or canceled row are skipped. A finished project has left your attention.
- Canceled rows due today don't count toward the ring.
- Log rows are ignored.

## License

MIT. See LICENSE.
