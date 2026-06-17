import { DESIGN_SPEC_JSON, type DesignSpec } from '@/lib/design/types'

/** Fuerza source vertex-imagen o vertex en spec/design.json. */
export function withVertexDesignSpec(files: Array<{ path: string; content: string }>) {
  return files.map((f) => {
    if (f.path !== DESIGN_SPEC_JSON) return f
    try {
      const spec = JSON.parse(f.content) as DesignSpec
      const isImagen = spec.pages?.some((p) => p.media === 'image') || spec.source === 'vertex-imagen'
      const next: DesignSpec = {
        ...spec,
        source: isImagen ? 'vertex-imagen' : 'vertex',
        prototypeLinks: spec.prototypeLinks ?? [],
      }
      return { ...f, content: JSON.stringify(next, null, 2) }
    } catch {
      return f
    }
  })
}
