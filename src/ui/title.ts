// The title screen is the welcome card now (src/ui/welcome.ts): identity, the
// pitch and the controls, over the same live fairground attract mode. This
// module stays as the delegate so `initTitle` — the name the app has always
// used for "mount the first screen" — keeps doing the right thing.
import { initWelcome } from './welcome'

export function initTitle(root: HTMLElement): void {
  initWelcome(root)
}
