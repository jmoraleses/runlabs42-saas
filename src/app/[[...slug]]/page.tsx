import SpecKitApp from '@/components/app/SpecKitApp'

/** SPA en cliente: evita static-paths-worker y vendor-chunks rotos en dev. */
export const dynamic = 'force-dynamic'

export default function CatchAllPage() {
  return <SpecKitApp />
}
