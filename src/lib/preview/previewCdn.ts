/** Utilidades CDN del preview — sin esbuild (seguro para componentes cliente). */

export type PreviewFile = { path: string; content: string }

export const PREVIEW_CDN_PACKAGES: Record<string, { url: string; globalVar: string }> = {
  p5: {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js',
    globalVar: 'p5',
  },
  'p5/addons/p5.sound': {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/addons/p5.sound.min.js',
    globalVar: 'p5',
  },
  phaser: {
    url: 'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js',
    globalVar: 'Phaser',
  },
  three: {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js',
    globalVar: 'THREE',
  },
  'chart.js': {
    url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
    globalVar: 'Chart',
  },
  'chart.js/auto': {
    url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
    globalVar: 'Chart',
  },
  tone: {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js',
    globalVar: 'Tone',
  },
  'matter-js': {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js',
    globalVar: 'Matter',
  },
  'pixi.js': {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.4.2/pixi.min.js',
    globalVar: 'PIXI',
  },
  d3: {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js',
    globalVar: 'd3',
  },
  gsap: {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
    globalVar: 'gsap',
  },
}

export const PREVIEW_REACT_CDN_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js'
export const PREVIEW_REACT_DOM_CDN_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js'

const REACT_CHARTJS_2_RE =
  /from\s+['"]react-chartjs-2['"]|require\s*\(\s*['"]react-chartjs-2['"]\s*\)/

const CHART_JS_RE =
  /from\s+['"]chart\.js(?:\/auto)?['"]|require\s*\(\s*['"]chart\.js(?:\/auto)?['"]\s*\)/

/**
 * Shim ESM para el bundle UMD de Chart.js v4 (CategoryScale, LineElement, register, etc.).
 * El shim genérico `export const Chart = window.Chart` no expone los submódulos nombrados.
 */
export const CHART_JS_PREVIEW_SHIM = `const C=typeof window!=='undefined'?window.Chart:null;if(!C)throw new Error('Chart.js no cargó en el preview (CDN)');export default C;export const Chart=C;export const register=C.register.bind(C);export const registerables=C.registerables;export const CategoryScale=C.CategoryScale;export const LinearScale=C.LinearScale;export const RadialLinearScale=C.RadialLinearScale;export const LogarithmicScale=C.LogarithmicScale;export const TimeScale=C.TimeScale;export const TimeSeriesScale=C.TimeSeriesScale;export const PointElement=C.PointElement;export const LineElement=C.LineElement;export const BarElement=C.BarElement;export const ArcElement=C.ArcElement;export const Filler=C.Filler;export const Title=C.Title;export const Tooltip=C.Tooltip;export const Legend=C.Legend;export const SubTitle=C.SubTitle;export const Decimation=C.Decimation;export const Colors=C.Colors;`

/** Scripts CDN extra para el srcdoc (chart.js con react-chartjs-2 o imports directos). */
export function previewExtraCdnScriptTags(files: PreviewFile[]): string {
  const joined = files.map((f) => f.content).join('\n')
  return previewExtraCdnScriptTagsFromSource(joined)
}

export function previewExtraCdnScriptTagsFromSource(source: string): string {
  const tags: string[] = []
  if (REACT_CHARTJS_2_RE.test(source) || CHART_JS_RE.test(source)) {
    tags.push(
      `<script src="${PREVIEW_CDN_PACKAGES['chart.js']!.url}"></script>`,
    )
  }
  return tags.join('\n')
}

/** Etiquetas script CDN para proyectos HTML (incluye React + dependencias detectadas). */
export function buildPreviewCdnScriptTags(source: string): string {
  const tags: string[] = [
    `<script src="${PREVIEW_REACT_CDN_URL}"></script>`,
    `<script src="${PREVIEW_REACT_DOM_CDN_URL}"></script>`,
  ]
  for (const [pkg, { url }] of Object.entries(PREVIEW_CDN_PACKAGES)) {
    const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (
      new RegExp(`from ['"]${escaped}['"]|require\\(['"]${escaped}['"]\\)`).test(
        source,
      )
    ) {
      tags.push(`<script src="${url}"></script>`)
    }
  }
  const chartExtra = previewExtraCdnScriptTagsFromSource(source)
  if (chartExtra && !tags.some((t) => t.includes(PREVIEW_CDN_PACKAGES['chart.js']!.url))) {
    tags.push(chartExtra)
  }
  return tags.join('\n')
}
