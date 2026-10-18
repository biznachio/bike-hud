# Changelog

## 0.3.3 (2026-10-18)

- Fixed: clicking a row while the outline is filtered (after clicking a tag or a day) now goes to the row. HUD clears the filter first, as Bike's calendar does, and Back restores it.

## 0.3.2 (2026-10-18)

- Fixed: the reschedule button no longer overlaps the lateness pill. On hover it takes the pill's place in line, with no fade behind it.

## 0.3.1 (2026-10-18)

- "Left today" is now a tag like overdue and stalled. Click it to filter the outline to what's still open today.
- Rescheduling is one calendar button that opens a menu with labeled choices: Tomorrow, Next week (each with its date) and Pick a Date.
- Next week is always the Monday that starts next week. On a Sunday it no longer repeats Tomorrow.
- Collapsed sections drop their rule, so closed headers read as a list.

## 0.3.0 (2026-10-18)

Rebuilt on the same design system as Backlinks and Timeline.

- Shared tokens: label grays, the hairline separator, a 6 percent hover fill, accent for "you are here" and orange for "waiting on you."
- Section headers follow Backlinks: chevron, title, a plain count and a hairline rule. Titles stay one step larger than Backlinks' for readability.
- Rows follow Backlinks: a soft hover fill, the title turns accent, and a clicked row no longer stays lit.
- Reschedule actions are Backlinks-style icon buttons that float over the row's end on a fade, so nothing reflows.
- Back chip: when a click zooms you into another area, "Back to …" returns you to where you were.
- Toast: a short confirmation after you check off or reschedule a row, since the row may leave the list.
- Band counts use Timeline's soft tags. Stalled is orange, for work waiting on you, and fills solid while its list is open.
- The week is now Backlinks' activity strip: one cell per day, deeper with more due.
- Lateness chips and the stalled idle count use Backlinks' pill shape.
- Empty state uses Backlinks' tip box.

## 0.2.1 (2026-10-18)

- Fixed: clicking a row no longer zooms out to the whole outline. If the row is already in view, HUD selects it where you are. If you're zoomed into another area, HUD zooms into the row's area and selects it.

## 0.2.0 (2026-10-18)

- Fixed: the HUD now redraws when the outline changes. Checking a row off, rescheduling or editing in Bike updates it right away.
- Compact layout: the ring, pills and the week's bars share one band, and every row is a single line. The HUD is about 40 percent of its old height.
- Section titles are larger and easier to read, and Overdue, Today and Stalled collapse. Bike remembers which ones you close.
- Hovering a row no longer shifts anything. Reschedule links (Tomorrow, the coming Monday, Pick a date) replace the lateness chip in line.
- The project and area show as a tooltip on each row.
- Coming up is gone; the week's bars cover it, and clicking a bar filters to that day.
- Stalled work now sits behind its pill. Click the pill to show or hide the list.
- All clear now lives in the band, keeping the week in view.

## 0.1.0 (2026-10-18)

First build.
