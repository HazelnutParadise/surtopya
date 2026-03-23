import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"

import { Input } from "../input"

describe("Input", () => {
  it("blurs focused number input on wheel to avoid accidental value changes", () => {
    render(<Input aria-label="points" type="number" defaultValue="10" />)

    const input = screen.getByLabelText("points")
    input.focus()
    expect(input).toHaveFocus()

    fireEvent.wheel(input)

    expect(input).not.toHaveFocus()
  })

  it("does not blur non-number input on wheel", () => {
    render(<Input aria-label="title" type="text" defaultValue="hello" />)

    const input = screen.getByLabelText("title")
    input.focus()
    expect(input).toHaveFocus()

    fireEvent.wheel(input)

    expect(input).toHaveFocus()
  })

  it("still calls consumer onWheel handler", () => {
    const onWheel = vi.fn()
    render(<Input aria-label="reward" type="number" onWheel={onWheel} />)

    const input = screen.getByLabelText("reward")
    fireEvent.wheel(input)

    expect(onWheel).toHaveBeenCalledTimes(1)
  })
})
