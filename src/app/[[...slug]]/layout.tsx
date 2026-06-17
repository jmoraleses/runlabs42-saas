/** SPA catch-all: evita pre-render y static-paths en dev con manifests rotos. */
export const dynamic = 'force-dynamic'

export default function CatchAllLayout({ children }: { children: React.ReactNode }) {
  return children
}
