// Custom overlays keep the independent PWA update prompt operable. Manage
// their background centrally so stacked dialogs cannot restore each other's
// inert state out of order. Native showModal() would also disable that prompt.
const overlays = new Set<HTMLElement>()
const previousInert = new Map<HTMLElement, boolean>()

function syncBackground(): void {
  for (const [element, inert] of previousInert) element.inert = inert
  previousInert.clear()

  const top = [...document.querySelectorAll<HTMLElement>('.dialog-backdrop')]
    .filter(element => overlays.has(element)).at(-1)
  if (!top) return

  let branch: HTMLElement = top
  while (branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (!(sibling instanceof HTMLElement) || sibling === branch || sibling.matches('.pwa-update')) continue
      // A game's paused state may own this attribute. Do not restore a stale
      // value over React when that game resumes or another overlay closes.
      if (sibling.inert) continue
      previousInert.set(sibling, Boolean(sibling.inert))
      sibling.inert = true
    }
    if (branch.parentElement === document.body) break
    branch = branch.parentElement
  }
}

export function isolateDialog(backdrop: HTMLElement): () => void {
  overlays.add(backdrop)
  syncBackground()
  // Observe the ancestor chain for replaced background branches, without
  // watching high-frequency updates inside game boards or live counters.
  const observer = new MutationObserver(syncBackground)
  let ancestor = backdrop.parentElement
  while (ancestor) {
    observer.observe(ancestor, { childList: true })
    if (ancestor === document.body) break
    ancestor = ancestor.parentElement
  }
  return () => {
    observer.disconnect()
    overlays.delete(backdrop)
    syncBackground()
  }
}
