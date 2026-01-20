import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, it, expect } from 'vitest'
import { Button } from '../button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })
})
