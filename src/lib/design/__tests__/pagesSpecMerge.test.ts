import { describe, expect, it } from 'vitest'
import { mergePagesIntoSpec, parseDesignSpec } from '@/lib/design/pages'
import { DESIGN_SYSTEM_PAGE_ID } from '@/lib/design/prototypePages'
import type { DesignPageMeta } from '@/lib/design/types'

describe('mergePagesIntoSpec', () => {
  it('preserves Visual Language frame when saving screen pages only', () => {
    const spec = parseDesignSpec(
      mergePagesIntoSpec(null, [
        {
          id: DESIGN_SYSTEM_PAGE_ID,
          name: 'Acme — Visual Language',
          path: '',
          width: 360,
          height: 480,
          x: 0,
          y: 0,
          frameType: 'designSystem',
        },
        {
          id: 'home',
          name: 'Home',
          path: 'design/site/index.html',
          width: 390,
          height: 844,
          x: 424,
          y: 0,
        },
      ]),
    )
    const screensOnly: DesignPageMeta[] = [
      {
        id: 'home',
        name: 'Home',
        path: 'design/site/index.html',
        width: 1280,
        height: 844,
        x: 0,
        y: 0,
      },
    ]
    const merged = parseDesignSpec(mergePagesIntoSpec(spec, screensOnly))
    expect(merged?.pages?.some((p) => p.id === DESIGN_SYSTEM_PAGE_ID)).toBe(true)
    expect(merged?.pages?.find((p) => p.id === 'home')?.width).toBe(1280)
  })
})
