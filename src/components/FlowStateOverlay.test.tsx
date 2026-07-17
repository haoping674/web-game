// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FlowStateOverlay } from './FlowStateOverlay'

describe('FlowStateOverlay', () => {
  it('only renders the board-local Fruit Flow marker while active', () => {
    const { container, rerender } = render(<FlowStateOverlay active={false} reduced={false} />)
    expect(container.querySelector('.flow-state-overlay')).toBeNull()
    rerender(<FlowStateOverlay active reduced={false} />)
    expect(container.querySelector('.flow-state-overlay')?.textContent).toContain('Fruit Flow')
    rerender(<FlowStateOverlay active reduced />)
    expect(container.querySelector('.flow-state-overlay')?.classList.contains('is-reduced')).toBe(true)
  })
})
