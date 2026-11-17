// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useRouteFocus } from './useRouteFocus'

afterEach(cleanup)

function Route({ path, ready = true }: { path: string; ready?: boolean }) {
  useRouteFocus(path)
  return <main>{ready ? <h1>{path}</h1> : <p>Loading</p>}</main>
}

describe('SPA route focus', () => {
  it('leaves initial focus alone and focuses a new route heading', () => {
    const view = render(<Route path="/" />)
    expect(screen.getByRole('heading')).not.toHaveFocus()
    view.rerender(<Route path="/games/fruit-sum" />)
    expect(screen.getByRole('heading')).toHaveFocus()
  })

  it('waits for lazy content and does not steal focus on later rerenders', async () => {
    const view = render(<Route path="/" />)
    view.rerender(<Route path="/games/fruit-sum" ready={false} />)
    view.rerender(<Route path="/games/fruit-sum" />)
    await waitFor(() => expect(screen.getByRole('heading')).toHaveFocus())
    screen.getByRole('heading').blur()
    view.rerender(<Route path="/games/fruit-sum" />)
    expect(screen.getByRole('heading')).not.toHaveFocus()
  })
})
