import { AppExtensionContext, Window } from 'bike/app'

// The HUD lives in the inspector, beside the calendar. All of its reading and
// writing happens in the panel through the session API, so the app side only
// adds the item to each window.
export async function activate(context: AppExtensionContext) {
  bike.observeWindows(async (window: Window) => {
    await window.inspector.addItem({
      id: 'hud',
      label: bike.localize('HUD'),
      script: 'hud.js',
    })
  })
}
