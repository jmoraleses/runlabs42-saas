import path from 'node:path'
import { createRequire } from 'node:module'
import { MINIMAL_PREVIEW_APP_TSX } from '@/lib/projects/ensurePreviewEntryFiles'
import { normalizePreviewModuleSource } from './normalizePreviewExports'
import {
  buildPreviewCdnScriptTags,
  CHART_JS_PREVIEW_SHIM,
  PREVIEW_CDN_PACKAGES,
  type PreviewFile,
} from './previewCdn'
import { REACT_ROUTER_SHIM } from './reactRouterShim'

export type { PreviewFile }
export type BundleResult = {
  js: string
  css: string
  error: string | null
  html?: string
  /** Paquetes sustituidos por stubs en el bundler del preview (preview aproximado). */
  stubPackages?: string[]
}

const CDN_PACKAGES = PREVIEW_CDN_PACKAGES

const REACT_VIRTUAL_PACKAGES: Record<string, string> = {
  'react': `const R=window.React;if(!R)throw new Error('React no cargó en el preview (revisa CSP o red).');export default R;export const {Children,Component,Fragment,Profiler,PureComponent,StrictMode,Suspense,cloneElement,createContext,createElement,createRef,forwardRef,isValidElement,lazy,memo,startTransition,useCallback,useContext,useDebugValue,useDeferredValue,useEffect,useId,useImperativeHandle,useInsertionEffect,useLayoutEffect,useMemo,useReducer,useRef,useState,useSyncExternalStore,useTransition,version}=R;`,
  'react/jsx-runtime': `const R=window.React;export const jsx=R.createElement;export const jsxs=R.createElement;export const Fragment=R.Fragment;`,
  'react/jsx-dev-runtime': `const R=window.React;export const jsxDEV=R.createElement;export const Fragment=R.Fragment;`,
  'react-dom': `function __studioRD(){const R=typeof window!=='undefined'?window.ReactDOM:null;if(!R?.createRoot)throw new Error('ReactDOM no disponible en el preview');return R}const RD=__studioRD();export default RD;export const {createPortal,flushSync,render,unmountComponentAtNode,version}=RD;`,
  'react-dom/client': `function __studioRD(){const R=typeof window!=='undefined'?window.ReactDOM:null;if(!R?.createRoot)throw new Error('ReactDOM.createRoot no disponible en el preview');return R}export function createRoot(c,o){return __studioRD().createRoot(c,o)}export function hydrateRoot(c,o){const R=__studioRD();return (R.hydrateRoot||R.createRoot)(c,o)}const __studioRDC={createRoot,hydrateRoot};export default __studioRDC;`,
  // Stubs para librerías no disponibles en el bundler
  'recharts': `const React=window.React;const S=({children,width,height,...p})=>React.createElement('div',{...p,style:{padding:'16px',background:'#f9fafb',border:'1px dashed #d1d5db',borderRadius:'6px',minHeight:height||200,display:'flex',alignItems:'center',justifyContent:'center',color:'#6b7280',fontSize:'13px'}},children||'📊 Chart preview');const N=()=>null;export const LineChart=S;export const BarChart=S;export const PieChart=S;export const AreaChart=S;export const ComposedChart=S;export const RadarChart=S;export const ScatterChart=S;export const RadialBarChart=S;export const FunnelChart=S;export const Treemap=S;export const SankeyChart=S;export const Line=S;export const Bar=S;export const Pie=S;export const Area=S;export const Radar=S;export const Scatter=S;export const RadialBar=S;export const Funnel=S;export const Cell=N;export const XAxis=N;export const YAxis=N;export const ZAxis=N;export const CartesianGrid=N;export const PolarGrid=N;export const PolarAngleAxis=N;export const PolarRadiusAxis=N;export const Tooltip=N;export const Legend=N;export const Label=N;export const LabelList=N;export const ReferenceLine=N;export const ReferenceDot=N;export const ReferenceArea=N;export const Brush=N;export const ErrorBar=N;export const ResponsiveContainer=S;export const Surface=S;export const Layer=S;export const Text=S;export const Curve=N;export const Cross=N;export const Dot=N;export const Rectangle=N;export const Sector=N;export const Triangle=N;export const Symbols=N;export const PolarAngle=N;export default {LineChart,BarChart,PieChart,AreaChart,ComposedChart,RadarChart,ScatterChart,RadialBarChart,FunnelChart,Treemap,Line,Bar,Pie,Area,Radar,Scatter,RadialBar,Funnel,Cell,XAxis,YAxis,ZAxis,CartesianGrid,PolarGrid,PolarAngleAxis,PolarRadiusAxis,Tooltip,Legend,Label,LabelList,ReferenceLine,ReferenceDot,ReferenceArea,Brush,ErrorBar,ResponsiveContainer};`,
  'zustand': `const s=(fn)=>{let st=fn(set=>{ st=set; });return ()=>st;};export const create=s;export const createStore=s;export const useStore=(store,sel)=>sel?sel(store()):store();export default {create,createStore,useStore};`,
  'zustand/middleware': `export const persist=(fn)=>fn;export const devtools=(fn)=>fn;export const immer=(fn)=>fn;export const subscribeWithSelector=(fn)=>fn;export const combine=(...fns)=>fns[0];export default {persist,devtools,immer,subscribeWithSelector,combine};`,
  '@tanstack/react-table': `const noop=()=>{};const emptyArr=[];export const createColumnHelper=()=>({accessor:(k,d)=>({...d,accessorKey:k}),display:(d)=>d,group:(d)=>d});export const getCoreRowModel=()=>noop;export const getPaginationRowModel=()=>noop;export const getSortedRowModel=()=>noop;export const getFilteredRowModel=()=>noop;export const getExpandedRowModel=()=>noop;export const getGroupedRowModel=()=>noop;export const getFacetedRowModel=()=>noop;export const getFacetedUniqueValues=()=>noop;export const getFacetedMinMaxValues=()=>noop;export const useReactTable=(opts)=>({getHeaderGroups:()=>emptyArr,getRowModel:()=>({rows:emptyArr}),getState:()=>({pagination:{pageIndex:0,pageSize:10},sorting:emptyArr,columnFilters:emptyArr}),setPageIndex:noop,setPageSize:noop,setSorting:noop,setColumnFilters:noop,getPageCount:()=>0,getCanPreviousPage:()=>false,getCanNextPage:()=>false,previousPage:noop,nextPage:noop,getAllColumns:()=>emptyArr,getColumn:()=>null,options:opts});export const flexRender=(comp,ctx)=>typeof comp==='function'?comp(ctx):comp??null;export const sortingFns={alphanumeric:noop,alphanumericCaseSensitive:noop,text:noop,textCaseSensitive:noop,datetime:noop,basic:noop};export const filterFns={includesString:noop,includesStringSensitive:noop,equalsString:noop,arrIncludes:noop,arrIncludesAll:noop,arrIncludesSome:noop,equals:noop,weakEquals:noop,inNumberRange:noop};export default {createColumnHelper,getCoreRowModel,getPaginationRowModel,getSortedRowModel,getFilteredRowModel,useReactTable,flexRender,sortingFns,filterFns};`,
  'framer-motion': `const React=window.React;const M=(tag)=>React.forwardRef(({children,...p},r)=>React.createElement(tag,{...p,ref:r},children));export const motion={div:M('div'),span:M('span'),p:M('p'),h1:M('h1'),h2:M('h2'),h3:M('h3'),ul:M('ul'),li:M('li'),button:M('button'),a:M('a'),section:M('section'),article:M('article'),header:M('header'),nav:M('nav'),img:M('img')};export const AnimatePresence=({children})=>children;export const useAnimation=()=>({start:()=>{},stop:()=>{}});export const useMotionValue=(v)=>({get:()=>v,set:()=>{}});export const useSpring=(v)=>v;export const useTransform=(v,f)=>v;export const useScroll=()=>({scrollX:{get:()=>0},scrollY:{get:()=>0},scrollXProgress:{get:()=>0},scrollYProgress:{get:()=>0}});export const useInView=()=>false;export const animate=()=>({stop:()=>{}});export const useAnimate=()=>[null,()=>{}];export default {motion,AnimatePresence,useAnimation,useMotionValue,useSpring,useTransform,useScroll,useInView,animate,useAnimate};`,
  'date-fns': `export const format=(d,f)=>d instanceof Date?d.toLocaleDateString():'';export const parseISO=(s)=>new Date(s);export const parse=(s)=>new Date(s);export const addDays=(d,n)=>new Date(d.getTime()+n*86400000);export const subDays=(d,n)=>new Date(d.getTime()-n*86400000);export const addMonths=(d,n)=>{const r=new Date(d);r.setMonth(r.getMonth()+n);return r;};export const subMonths=(d,n)=>{const r=new Date(d);r.setMonth(r.getMonth()-n);return r;};export const startOfDay=(d)=>{const r=new Date(d);r.setHours(0,0,0,0);return r;};export const endOfDay=(d)=>{const r=new Date(d);r.setHours(23,59,59,999);return r;};export const isAfter=(a,b)=>a>b;export const isBefore=(a,b)=>a<b;export const isEqual=(a,b)=>a.getTime()===b.getTime();export const differenceInDays=(a,b)=>Math.floor((a-b)/86400000);export const differenceInMonths=(a,b)=>a.getMonth()-b.getMonth()+(a.getFullYear()-b.getFullYear())*12;export const startOfMonth=(d)=>new Date(d.getFullYear(),d.getMonth(),1);export const endOfMonth=(d)=>new Date(d.getFullYear(),d.getMonth()+1,0);export const formatDistanceToNow=(d)=>'some time ago';export default {format,parseISO,parse,addDays,subDays,addMonths,subMonths,startOfDay,endOfDay,isAfter,isBefore,isEqual,differenceInDays,differenceInMonths,startOfMonth,endOfMonth,formatDistanceToNow};`,
  'axios': `const ax=async(cfg)=>{const r=await fetch(cfg.url||cfg,{method:cfg.method||'GET',headers:cfg.headers,body:cfg.data?JSON.stringify(cfg.data):undefined});const d=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(r.statusText),{response:{data:d,status:r.status}});return {data:d,status:r.status,headers:{}};};ax.get=(u,c)=>ax({...c,url:u,method:'GET'});ax.post=(u,d,c)=>ax({...c,url:u,method:'POST',data:d});ax.put=(u,d,c)=>ax({...c,url:u,method:'PUT',data:d});ax.patch=(u,d,c)=>ax({...c,url:u,method:'PATCH',data:d});ax.delete=(u,c)=>ax({...c,url:u,method:'DELETE'});ax.create=(cfg)=>ax;export default ax;export const isAxiosError=(e)=>Boolean(e?.response);`,
  'lodash': `export const chunk=(a,n)=>{const r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r;};export const cloneDeep=(o)=>JSON.parse(JSON.stringify(o));export const debounce=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};export const throttle=(fn,ms)=>{let l=0;return(...a)=>{const n=Date.now();if(n-l>=ms){l=n;fn(...a);}};};export const flatten=(a)=>a.flat();export const flatMap=(a,fn)=>a.flatMap(fn);export const groupBy=(a,k)=>a.reduce((r,v)=>{const key=typeof k==='function'?k(v):v[k];(r[key]=r[key]||[]).push(v);return r;},{});export const keyBy=(a,k)=>a.reduce((r,v)=>{r[typeof k==='function'?k(v):v[k]]=v;return r;},{});export const mapValues=(o,fn)=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,fn(v,k)]));export const omit=(o,...k)=>Object.fromEntries(Object.entries(o).filter(([key])=>!k.includes(key)));export const pick=(o,...k)=>Object.fromEntries(Object.entries(o).filter(([key])=>k.includes(key)));export const sortBy=(a,...fns)=>[...a].sort((x,y)=>{for(const fn of fns){const kx=typeof fn==='function'?fn(x):x[fn],ky=typeof fn==='function'?fn(y):y[fn];if(kx<ky)return -1;if(kx>ky)return 1;}return 0;});export const uniq=(a)=>[...new Set(a)];export const uniqBy=(a,k)=>{const s=new Set();return a.filter(v=>{const key=typeof k==='function'?k(v):v[k];return s.has(key)?false:(s.add(key),true);});};export const merge=(t,...s)=>Object.assign(t,...s);export const isEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);export const isEmpty=(v)=>v==null||v===''||(Array.isArray(v)||typeof v==='string'?v.length===0:typeof v==='object'&&Object.keys(v).length===0);export const isNil=(v)=>v==null;export const get=(o,p,d)=>{const r=p.split('.').reduce((c,k)=>c?.[k],o);return r===undefined?d:r;};export const set=(o,p,v)=>{const k=p.split('.');let c=o;k.slice(0,-1).forEach(k=>{c=c[k]=c[k]??{};});c[k.at(-1)]=v;return o;};export const capitalize=(s)=>s?s[0].toUpperCase()+s.slice(1):'';export const camelCase=(s)=>s.replace(/[-_\s]+(.)/g,(_,c)=>c.toUpperCase()).replace(/^./,c=>c.toLowerCase());export const snakeCase=(s)=>s.replace(/([A-Z])/g,'_$1').toLowerCase().replace(/^_/,'');export const startCase=(s)=>s.replace(/[-_\s]+(.)/g,' $1').replace(/^./,c=>c.toUpperCase()).trim();export const range=(start,end,step=1)=>{const r=[];for(let i=start;i<(end??start);i+=step)r.push(i);return r;};export const sum=(a)=>a.reduce((s,v)=>s+v,0);export const sumBy=(a,k)=>a.reduce((s,v)=>s+(typeof k==='function'?k(v):v[k]),0);export const min=(a)=>Math.min(...a);export const max=(a)=>Math.max(...a);export const minBy=(a,k)=>a.reduce((m,v)=>(typeof k==='function'?k(v):v[k])<(typeof k==='function'?k(m):m[k])?v:m);export const maxBy=(a,k)=>a.reduce((m,v)=>(typeof k==='function'?k(v):v[k])>(typeof k==='function'?k(m):m[k])?v:m);export default {chunk,cloneDeep,debounce,throttle,flatten,flatMap,groupBy,keyBy,mapValues,omit,pick,sortBy,uniq,uniqBy,merge,isEqual,isEmpty,isNil,get,set,capitalize,camelCase,snakeCase,startCase,range,sum,sumBy,min,max,minBy,maxBy};`,
  'react-chartjs-2': `const React=window.React;const P=({type='line',children,...p})=>React.createElement('div',{...p,style:{padding:'16px',background:'#f9fafb',border:'1px dashed #d1d5db',borderRadius:'6px',minHeight:200,display:'flex',alignItems:'center',justifyContent:'center',color:'#6b7280',fontSize:'13px',...(p.style||{})}},children||'📈 '+type+' chart');export const Chart=P;export const Line=(props)=>P({...props,type:'line'});export const Bar=(props)=>P({...props,type:'bar'});export const Pie=(props)=>P({...props,type:'pie'});export const Doughnut=(props)=>P({...props,type:'doughnut'});export const Radar=(props)=>P({...props,type:'radar'});export const PolarArea=(props)=>P({...props,type:'polarArea'});export const Scatter=(props)=>P({...props,type:'scatter'});export const Bubble=(props)=>P({...props,type:'bubble'});export default {Chart,Line,Bar,Pie,Doughnut,Radar,PolarArea,Scatter,Bubble};`,
}

const STUB_PACKAGE_NAMES = Object.keys(REACT_VIRTUAL_PACKAGES).filter(
  (k) =>
    k !== 'react' &&
    !k.startsWith('react/') &&
    !k.startsWith('react-dom'),
)

/** Detecta imports de librerías que solo tienen stub en el preview cliente. */
export function detectPreviewStubPackages(files: PreviewFile[]): string[] {
  const joined = files.map((f) => f.content).join('\n')
  const found: string[] = []
  for (const pkg of STUB_PACKAGE_NAMES) {
    const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const fromRe = new RegExp(`from\\s+['"]${escaped}['"]`)
    const reqRe = new RegExp(`require\\s*\\(\\s*['"]${escaped}['"]\\s*\\)`)
    if (fromRe.test(joined) || reqRe.test(joined)) found.push(pkg)
  }
  return found
}

/** Detects if the file set is a standalone HTML project (no TS/JSX framework). */
function detectHtmlProject(fileMap: Map<string, string>): string | null {
  const htmlEntry =
    fileMap.get('preview/index.html') ??
    fileMap.get('index.html') ??
    fileMap.get('src/index.html')
  if (!htmlEntry) return null
  // Must look like a full HTML document
  if (!/<html|<!DOCTYPE/i.test(htmlEntry)) return null
  return htmlEntry
}

function buildCdnScriptTags(fileMap: Map<string, string>): string {
  return buildPreviewCdnScriptTags([...fileMap.values()].join('\n'))
}

/** Builds CDN shim modules so esbuild can resolve CDN imports. */
function buildCdnVirtualPackages(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [pkg, { globalVar }] of Object.entries(CDN_PACKAGES)) {
    if (pkg === 'chart.js' || pkg === 'chart.js/auto') {
      result[pkg] = CHART_JS_PREVIEW_SHIM
      continue
    }
    result[pkg] = `export default window.${globalVar}; export const ${globalVar} = window.${globalVar};`
  }
  return result
}

// require real del runtime Node (Next/webpack no lo reescribe vía eval).
// Resuelve desde .next/server, cuyo ancestro contiene node_modules del repo.
// El try/catch evita que la importación falle en entornos ESM (tests).
const nodeRequire: NodeRequire = (() => {
  try {
    // eslint-disable-next-line no-eval
    const r = eval('require')
    if (typeof r === 'function') return r as NodeRequire
  } catch {
    /* entorno ESM (p.ej. vitest) */
  }
  return createRequire(path.join(process.cwd(), 'index.js'))
})()

const SOURCE_EXT = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json']
const MAIN_ENTRY_CANDIDATES = [
  'src/main.tsx', 'src/main.jsx', 'src/main.ts', 'src/main.js',
  'src/index.tsx', 'src/index.jsx', 'src/index.ts', 'src/index.js',
  'main.tsx', 'index.tsx',
]

const APP_ENTRY_CANDIDATES = ['src/App.tsx', 'src/App.jsx']

const ENTRY_CANDIDATES = [...MAIN_ENTRY_CANDIDATES, ...APP_ENTRY_CANDIDATES]

const PREVIEW_BOOTSTRAP_ENTRY = '__studio_preview_entry__.tsx'

function norm(p: string): string {
  return p.replace(/^\.?\//, '').replace(/\/+/g, '/')
}

/** Empareja proyectos generados por el Studio con node_modules reales. */
const VIRTUAL_PACKAGES: Record<string, string> = {
  ...REACT_VIRTUAL_PACKAGES,
  'react-router-dom': REACT_ROUTER_SHIM,
  'react-router': REACT_ROUTER_SHIM,
  ...buildCdnVirtualPackages(),
}

function pickEntry(fileMap: Map<string, string>): string | null {
  for (const c of ENTRY_CANDIDATES) if (fileMap.has(c)) return c
  return null
}

function hasMainEntry(fileMap: Map<string, string>): boolean {
  return MAIN_ENTRY_CANDIDATES.some((c) => fileMap.has(c))
}

/** Si solo hay App.tsx, genera un entry que monta React en #root. */
function resolveBundleEntry(fileMap: Map<string, string>): string | null {
  const picked = pickEntry(fileMap)
  if (!picked) return null

  const needsBootstrap =
    APP_ENTRY_CANDIDATES.includes(picked) && !hasMainEntry(fileMap)
  if (!needsBootstrap) return picked

  const appSpec = picked.endsWith('.jsx') ? './src/App.jsx' : './src/App.tsx'
  fileMap.set(
    PREVIEW_BOOTSTRAP_ENTRY,
    `import { createRoot } from 'react-dom/client'\nimport App from '${appSpec}'\ncreateRoot(document.getElementById('root')!).render(<App />)\n`,
  )
  return PREVIEW_BOOTSTRAP_ENTRY
}

function pathLookupCandidates(base: string): string[] {
  return [
    base,
    ...SOURCE_EXT.map((e) => base + e),
    ...SOURCE_EXT.map((e) => norm(`${base}/index${e}`)),
  ]
}

function resolveRelative(
  fileMap: Map<string, string>,
  importer: string,
  spec: string,
): string | null {
  const base = norm(path.posix.join(path.posix.dirname(importer), spec))
  for (const t of pathLookupCandidates(base)) {
    if (fileMap.has(t)) return t
  }
  if (base.endsWith('.css') && fileMap.has(base)) return base

  const baseName = path.posix.basename(base).replace(/\.(tsx|ts|jsx|js)$/i, '')
  if (baseName === 'App') {
    for (const candidate of APP_ENTRY_CANDIDATES) {
      if (fileMap.has(candidate)) return candidate
    }
    if (fileMap.has('App.tsx')) return 'App.tsx'
    if (fileMap.has('App.jsx')) return 'App.jsx'
  }

  // p. ej. desde src/App.tsx: `./pages/Home` → `src/pages/Home.tsx` o `pages/Home.tsx`
  if (importer.startsWith('src/') && spec.startsWith('.')) {
    const rel = norm(spec.replace(/^\.\//, ''))
    for (const base of [rel, norm(`src/${rel}`)]) {
      for (const t of pathLookupCandidates(base)) {
        if (fileMap.has(t)) return t
      }
    }
  }

  // Desde src/components/Foo.tsx la IA a veces importa ./components/Bar en lugar de ./Bar
  if (/\/components\//.test(importer) && spec.startsWith('./components/')) {
    const sibling = norm(
      path.posix.join(path.posix.dirname(importer), spec.replace(/^\.\/components\//, './')),
    )
    for (const t of pathLookupCandidates(sibling)) {
      if (fileMap.has(t)) return t
    }
  }

  return null
}

/** Si hay main pero no App, inyecta un App mínimo para que `./App` resuelva en el preview. */
function ensureAppForMainEntry(fileMap: Map<string, string>): void {
  if (!hasMainEntry(fileMap)) return
  if (APP_ENTRY_CANDIDATES.some((p) => fileMap.has(p)) || fileMap.has('App.tsx') || fileMap.has('App.jsx')) {
    return
  }
  fileMap.set('src/App.tsx', MINIMAL_PREVIEW_APP_TSX)
}

/**
 * Genera el CSS del preview procesando Tailwind/PostCSS sobre el código
 * del proyecto. Si falla, cae al CSS crudo concatenado (sin Tailwind).
 */
/** Utilidades Tailwind en cadenas className (no en imports tipo `from './x'`). */
const TAILWIND_UTILITY_RE =
  /\b(?:flex|inline-flex|grid-cols-|grid-rows-|col-span-|row-span-|block|hidden|container|mx-auto|items-|justify-|gap-|space-x-|space-y-|p-\d|px-|py-|pt-|pb-|pl-|pr-|m-\d|mx-|my-|mt-|mb-|ml-|mr-|w-|h-|min-w-|max-w-|min-h-|max-h-|text-(?:xs|sm|base|lg|xl|2xl|3xl)|font-|leading-|tracking-|bg-|border|rounded|shadow|opacity-|z-\d|overflow-|truncate|underline|uppercase|lowercase|capitalize|sr-only)\b/

const TAILWIND_WARN_RE = /No utility classes were detected in your source files/

function extractMarkupClassBlob(sourceText: string): string {
  const chunks: string[] = []
  const patterns = [
    /className\s*=\s*"([^"]*)"/g,
    /className\s*=\s*'([^']*)'/g,
    /className\s*=\s*\{\s*`([^`]+)`\s*\}/g,
    /className\s*=\s*\{\s*["']([^"']+)["']\s*\}/g,
    /class\s*=\s*"([^"]*)"/g,
    /class\s*=\s*'([^']*)'/g,
  ]
  for (const re of patterns) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(sourceText)) !== null) {
      if (m[1]?.trim()) chunks.push(m[1])
    }
  }
  return chunks.join(' ')
}

function sourceUsesTailwindUtilities(sourceText: string): boolean {
  const classBlob = extractMarkupClassBlob(sourceText)
  if (!classBlob.trim()) return false
  return TAILWIND_UTILITY_RE.test(classBlob)
}

/** Claves VITE_* usadas en el proyecto (import.meta.env de Vite → esbuild define). */
function collectViteEnvKeys(files: PreviewFile[]): Set<string> {
  const keys = new Set<string>()
  const patterns = [
    /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g,
    /import\.meta\.env\??\.(VITE_[A-Z0-9_]+)/g,
    /import\.meta\.env\[['"](VITE_[A-Z0-9_]+)['"]\]/g,
    /\{\s*([^}]+)\s*\}\s*=\s*import\.meta\.env/g,
  ]
  const destructureKey = /(VITE_[A-Z0-9_]+)/g
  for (const f of files) {
    if (!/\.(tsx?|jsx?|mjs|js)$/i.test(f.path)) continue
    for (const re of patterns) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(f.content)) !== null) {
        if (re.source.includes('{')) {
          let km: RegExpExecArray | null
          destructureKey.lastIndex = 0
          while (m[1] && (km = destructureKey.exec(m[1])) !== null) if (km[1]) keys.add(km[1])
        } else if (m[1]) {
          keys.add(m[1])
        }
      }
    }
  }
  return keys
}

/** Sustituye import.meta.env en el bundle del preview (no hay Vite en runtime). */
function buildImportMetaEnvDefine(files: PreviewFile[]): Record<string, string> {
  const viteKeys = collectViteEnvKeys(files)
  for (const k of [
    'VITE_API_URL',
    'VITE_API_BASE',
    'VITE_BASE_URL',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ]) {
    viteKeys.add(k)
  }

  const env: Record<string, string | boolean> = {
    MODE: 'development',
    DEV: true,
    PROD: false,
    SSR: false,
  }
  for (const k of viteKeys) env[k] = ''

  const define: Record<string, string> = {
    'process.env.NODE_ENV': '"development"',
    'import.meta.env': JSON.stringify(env),
  }
  for (const [k, v] of Object.entries(env)) {
    define[`import.meta.env.${k}`] =
      typeof v === 'boolean' ? String(v) : JSON.stringify(v)
  }
  return define
}

function tailwindContentSources(classBlob: string): { raw: string; extension: string }[] {
  return [{ raw: classBlob.trim() || ' ', extension: 'html' }]
}

async function buildCss(files: PreviewFile[]): Promise<string> {
  const cssFiles = files.filter((f) => f.path.endsWith('.css'))
  const rawConcat = cssFiles.map((f) => `/* ${f.path} */\n${f.content}`).join('\n\n')

  const sourceText = files
    .filter((f) => /\.(tsx|ts|jsx|js|mjs|html)$/i.test(f.path))
    .map((f) => f.content)
    .join('\n')

  const classBlob = extractMarkupClassBlob(sourceText)
  const hasTailwindDirectives = /@tailwind|@apply/.test(rawConcat)
  const hasTailwindUtilities = sourceUsesTailwindUtilities(sourceText)

  // CSS propio (.hero, .feature-grid) sin utilidades Tailwind → sin PostCSS/Tailwind.
  if (!hasTailwindDirectives && !hasTailwindUtilities) {
    return rawConcat
  }

  const prevWarn = console.warn
  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] ?? '')
    if (TAILWIND_WARN_RE.test(msg)) return
    prevWarn.apply(console, args as [unknown?, ...unknown[]])
  }

  try {
    const postcss = nodeRequire('postcss') as (
      plugins: unknown[],
    ) => { process: (css: string, opts: { from: undefined }) => Promise<{ css: string }> }
    const tailwindcss = nodeRequire('tailwindcss') as (config: unknown) => unknown
    const autoprefixer = nodeRequire('autoprefixer') as () => unknown

    const hasDirectives = /@tailwind/.test(rawConcat)
    const input = hasDirectives
      ? rawConcat
      : hasTailwindUtilities
        ? `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n${rawConcat}`
        : rawConcat

    const tailwindConfig = {
      content: tailwindContentSources(classBlob),
      theme: { extend: {} },
      corePlugins: { preflight: true },
    }

    const result = await postcss([
      tailwindcss(tailwindConfig),
      autoprefixer(),
    ]).process(input, { from: undefined })

    const out = result.css?.trim() ?? ''
    // Si Tailwind no generó utilidades, conservar CSS del proyecto para que el preview no quede en blanco.
    if (out.length < 80 && rawConcat.trim()) return rawConcat
    return result.css
  } catch {
    return rawConcat
  } finally {
    console.warn = prevWarn
  }
}

export async function bundleProject(files: PreviewFile[]): Promise<BundleResult> {
  // Dynamic import so Vercel's bundler traces this dependency and includes it in the Lambda.
  const esbuild = await import('esbuild')

  const fileMap = new Map<string, string>()
  for (const f of files) {
    fileMap.set(norm(f.path), normalizePreviewModuleSource(f.content, norm(f.path)))
  }
  ensureAppForMainEntry(fileMap)

  // Tras conversión CMS el workspace puede conservar src/ legacy; priorizar preview/ estático.
  const preferStaticPreview = fileMap.has('preview/index.html')
  const entry = preferStaticPreview ? null : resolveBundleEntry(fileMap)

  // ── HTML-first project (solo si no hay entry TS/JS para esbuild) ─────────
  const rawHtml = entry ? null : detectHtmlProject(fileMap)
  if (rawHtml) {
    const cdnScripts = buildCdnScriptTags(fileMap)
    // Inline JS files referenced in the HTML
    let html = rawHtml
    for (const [filePath, content] of fileMap) {
      if (!/\.(tsx?|jsx?|mjs|cjs|js)$/i.test(filePath)) continue
      const fileName = filePath.split('/').pop()!
      const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Replace <script src="./file.js"> with inline script
      html = html.replace(
        new RegExp(
          `<script([^>]*)src=["'](?:\\.?\\/)?(?:src/)?${escaped}["']([^>]*)>\\s*</script>`,
          'gi',
        ),
        `<script$1$2>${content}</script>`,
      )
    }
    // Inject CDN scripts before </head>
    if (cdnScripts) {
      html = html.replace('</head>', `${cdnScripts}\n</head>`)
    }
    // Inline CSS files
    for (const [filePath, content] of fileMap) {
      if (!filePath.endsWith('.css')) continue
      const fileName = filePath.split('/').pop()!
      html = html.replace(
        new RegExp(`<link([^>]*)href=["'](?:\\.?\\/)?${fileName.replace('.', '\\.')}["']([^>]*)>`, 'gi'),
        `<style>${content}</style>`,
      )
    }
    return {
      js: '',
      css: '',
      error: null,
      html,
      stubPackages: detectPreviewStubPackages(files),
    }
  }

  if (!entry) {
    return { js: '', css: '', error: 'No se encontró un punto de entrada (src/main.tsx o index.html).' }
  }

  // CSS: el plugin las anula como módulos JS y se inyectan aparte,
  // procesando Tailwind/PostCSS para que las clases utilitarias se vean.
  const cssBundle = await buildCss(files)

  const resolveVirtualBare = (spec: string): { path: string; namespace: 'vpkg' } | null => {
    const parts = spec.split('/')
    const bare = spec.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0] ?? spec
    if (VIRTUAL_PACKAGES[spec]) return { path: spec, namespace: 'vpkg' }
    if (VIRTUAL_PACKAGES[bare]) return { path: bare, namespace: 'vpkg' }
    return null
  }

  const virtualPlugin: import('esbuild').Plugin = {
    name: 'studio-vfs',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === 'entry-point') {
          return { path: norm(args.path), namespace: 'vfs' }
        }

        const spec = args.path
        const isBare =
          !spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('@/')

        // React / router shims: también cuando el importador es vpkg (p. ej. react-router-dom)
        // o node_modules real (p. ej. lucide-react), para no duplicar React en el IIFE.
        if (isBare && (args.namespace === 'vfs' || args.namespace === 'vpkg' || args.namespace === 'file')) {
          const virtual = resolveVirtualBare(spec)
          if (virtual) return virtual
        }

        if (args.namespace !== 'vfs') return undefined

        if (spec.endsWith('.css')) {
          return { path: spec, namespace: 'vfs-empty' }
        }
        if (spec.startsWith('@/')) {
          const aliasPath = norm(`src/${spec.slice(2)}`)
          if (fileMap.has(aliasPath)) {
            if (aliasPath.endsWith('.css')) return { path: aliasPath, namespace: 'vfs-empty' }
            return { path: aliasPath, namespace: 'vfs' }
          }
          return { errors: [{ text: `No se pudo resolver el alias "${spec}"` }] }
        }
        if (spec.startsWith('.') || spec.startsWith('/')) {
          const resolved = resolveRelative(fileMap, args.importer, spec)
          if (resolved) {
            if (resolved.endsWith('.css')) return { path: resolved, namespace: 'vfs-empty' }
            return { path: resolved, namespace: 'vfs' }
          }
          return { errors: [{ text: `No se pudo resolver "${spec}" desde ${args.importer}` }] }
        }
        try {
          const real = nodeRequire.resolve(spec)
          return { path: real, namespace: 'file' }
        } catch {
          return { errors: [{ text: `Dependencia no disponible: "${spec}"` }] }
        }
      })

      build.onLoad({ filter: /.*/, namespace: 'vfs' }, (args) => {
        const contents = fileMap.get(args.path) ?? ''
        const ext = path.extname(args.path)
        const loader =
          ext === '.ts' ? 'ts'
          : ext === '.tsx' ? 'tsx'
          : ext === '.jsx' ? 'jsx'
          : ext === '.json' ? 'json'
          : 'js'
        return { contents, loader, resolveDir: process.cwd() }
      })

      build.onLoad({ filter: /.*/, namespace: 'vfs-empty' }, () => ({
        contents: 'export default {}',
        loader: 'js',
      }))

      build.onLoad({ filter: /.*/, namespace: 'vpkg' }, (args) => ({
        contents: VIRTUAL_PACKAGES[args.path] ?? 'export default {}',
        loader: 'js',
        resolveDir: process.cwd(),
      }))
    },
  }

  try {
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      jsx: 'automatic',
      jsxImportSource: 'react',
      absWorkingDir: process.cwd(),
      logLevel: 'silent',
      define: buildImportMetaEnvDefine(files),
      loader: { '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl' },
      plugins: [virtualPlugin],
    })
    const js = result.outputFiles?.[0]?.text ?? ''
    return {
      js,
      css: cssBundle,
      error: null,
      stubPackages: detectPreviewStubPackages(files),
    }
  } catch (e) {
    const msg =
      e && typeof e === 'object' && 'errors' in e
        ? (e as { errors: { text: string }[] }).errors.map((x) => x.text).join('\n')
        : e instanceof Error
          ? e.message
          : 'Error de compilación'
    return { js: '', css: cssBundle, error: msg }
  }
}
