import { describe, expect, it } from 'vitest'
import { nextGenericProjectName } from '@/lib/projects/genericProjectName'

describe('nextGenericProjectName', () => {
  it('starts at Proyecto 1 when empty', () => {
    expect(nextGenericProjectName([])).toBe('Proyecto 1')
  })

  it('increments past existing numbered names', () => {
    expect(nextGenericProjectName(['Proyecto 1', 'Proyecto 3'])).toBe('Proyecto 2')
    expect(nextGenericProjectName(['Proyecto 1', 'Proyecto 2'])).toBe('Proyecto 3')
  })

  it('ignores custom names', () => {
    expect(nextGenericProjectName(['Mi app', 'Proyecto 1'])).toBe('Proyecto 2')
  })

  it('uses English base when lang is en', () => {
    expect(nextGenericProjectName(['Project 1'], 'en')).toBe('Project 2')
  })
})
