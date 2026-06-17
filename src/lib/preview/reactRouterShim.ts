/**
 * Shim mínimo de react-router-dom v6 para el preview propio.
 * react-router-dom no está en node_modules; los proyectos generados solo
 * usan un subconjunto (BrowserRouter, Routes, Route, Link, NavLink,
 * useNavigate, useParams, useLocation, Navigate, Outlet).
 */
export const REACT_ROUTER_SHIM = String.raw`
const React = window.React
if (!React?.createElement) throw new Error('React no cargó en el preview (revisa CSP o red).')

const Ctx = React.createContext({ path: '/', navigate: () => {} })

function normPath(p) {
  if (!p || typeof p !== 'string') return '/'
  // En un preview sandbox (about:srcdoc) no hay URL real: base siempre "/".
  if (!p.startsWith('/')) return '/'
  return p
}

export function BrowserRouter({ children }) {
  // Router puramente en memoria: el iframe srcdoc no tiene location real.
  const [path, setPath] = React.useState('/')
  const navigate = React.useCallback((to) => {
    if (typeof to === 'number') return
    setPath(normPath(String(to).split('?')[0].split('#')[0]))
  }, [])
  React.useEffect(() => {
    window.__studioNavigate = navigate
    window.__studioCurrentPath = path
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'runlabs:preview-navigate', path }, '*')
      }
    } catch (_) {}
    return () => {
      window.__studioNavigate = undefined
      window.__studioCurrentPath = undefined
    }
  }, [navigate, path])
  return React.createElement(Ctx.Provider, { value: { path, navigate } }, children)
}
export const HashRouter = BrowserRouter
export const MemoryRouter = BrowserRouter

function matchPath(pattern, pathname) {
  pathname = normPath(pathname)
  const p = pattern.replace(/\*$/, '')
  const keys = []
  const rx = new RegExp(
    '^' +
      p
        .replace(/\/+$/, '')
        .replace(/:[^/]+/g, (m) => {
          keys.push(m.slice(1))
          return '([^/]+)'
        }) +
      (pattern.endsWith('*') ? '(?:/.*)?' : '') +
      '/?$',
  )
  const m = pathname.match(rx)
  if (!m) return null
  const params = {}
  keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])))
  return params
}

function resolveRouteElement(element) {
  if (element == null) return null
  if (React.isValidElement(element)) return element
  if (typeof element === 'function') return React.createElement(element)
  if (typeof element === 'object') {
    const C = element.default ?? element
    if (typeof C === 'function') return React.createElement(C)
  }
  return element
}

export function Routes({ children }) {
  const { path } = React.useContext(Ctx)
  const routes = React.Children.toArray(children).filter(Boolean)
  for (const r of routes) {
    const params = matchPath(r.props.path ?? '*', path)
    if (params) {
      const el = resolveRouteElement(r.props.element ?? r.props.Component)
      return React.createElement(ParamsCtx.Provider, { value: params }, el)
    }
  }
  return null
}

const ParamsCtx = React.createContext({})

export function Route() { return null }

export function Link({ to, children, ...rest }) {
  const { navigate } = React.useContext(Ctx)
  return React.createElement(
    'a',
    {
      href: to,
      ...rest,
      onClick: (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || rest.target === '_blank') return
        e.preventDefault()
        navigate(to)
      },
    },
    children,
  )
}
export function NavLink(props) { return Link(props) }

export function Navigate({ to }) {
  const { navigate } = React.useContext(Ctx)
  React.useEffect(() => { navigate(to) }, [to])
  return null
}

export function Outlet() { return null }

export function useNavigate() {
  return React.useContext(Ctx).navigate
}
export function useLocation() {
  const { path } = React.useContext(Ctx)
  return { pathname: path, search: '', hash: '', state: null, key: 'default' }
}
export function useParams() {
  return React.useContext(ParamsCtx)
}
export function useSearchParams() {
  const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  return [sp, () => {}]
}

export default BrowserRouter
`
