import { describe, expect, it } from 'vitest'
import {
  BLANK_PAGE_APP_TSX,
} from '@/lib/projects/ensurePreviewEntryFiles'
import {
  buildWiredAppTsx,
  fixMisplacedComponentImports,
  isBlankStudioApp,
  pickPrimaryUiModule,
  reconcilePreviewWorkspace,
} from '@/lib/projects/reconcilePreviewWorkspace'

describe('reconcilePreviewWorkspace', () => {
  it('detects blank studio App', () => {
    expect(isBlankStudioApp(BLANK_PAGE_APP_TSX)).toBe(true)
    expect(isBlankStudioApp('export default function App(){return <h1>Hi</h1>}')).toBe(false)
  })

  it('fixes ./components imports inside src/components', () => {
    const fixed = fixMisplacedComponentImports(
      "import X from './components/MetricCard'",
      'src/components/Dashboard.tsx',
    )
    expect(fixed).toContain("from './MetricCard'")
  })

  it('wires blank App to Dashboard and fixes component imports', () => {
    const files = [
      { path: 'src/App.tsx', content: BLANK_PAGE_APP_TSX },
      {
        path: 'src/components/Dashboard.tsx',
        content: `import MetricCard from './components/MetricCard'
export default function Dashboard() { return <MetricCard title="A" value="1" /> }`,
      },
      {
        path: 'src/components/MetricCard.tsx',
        content: 'export default function MetricCard() { return <div /> }',
      },
      { path: 'src/main.tsx', content: "import App from './App'" },
    ]
    const { ops, wiredApp, fixedImportPaths } = reconcilePreviewWorkspace(files)
    expect(wiredApp).toBe(true)
    expect(fixedImportPaths).toContain('src/components/Dashboard.tsx')
    const appOp = ops.find((o) => o.path === 'src/App.tsx' && o.type !== 'delete')
    expect(appOp && appOp.type !== 'delete' ? appOp.content : '').toContain('./components/Dashboard')
    expect(buildWiredAppTsx(pickPrimaryUiModule(files)!)).toContain('Dashboard')
  })
})
