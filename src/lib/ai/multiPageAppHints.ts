/** Instrucciones para que la IA cree varias páginas/rutas en el mismo proyecto. */

export const MULTI_PAGE_APP_HINT =
  'El proyecto usa React + react-router-dom (disponible en el preview). ' +
  'Cuando el usuario pida otra página, una segunda pantalla o un archivo nuevo para una ruta distinta: ' +
  '(1) crea un archivo nuevo bajo src/pages/ (ej. src/pages/About.tsx) con el componente de esa página; ' +
  '(2) registra la ruta en src/App.tsx con <Routes> y <Route path="..." element={...} />; ' +
  '(3) añade navegación con <Link to="..."> si procede; ' +
  '(4) en CADA bloque de código incluye la ruta en la primera línea del fence (```tsx src/pages/About.tsx). ' +
  'Nunca metas una página nueva solo editando App.tsx sin crear el archivo de la página. ' +
  'Si modificas App.tsx para routing, devuelve también el archivo de la nueva página (puedes sobrescribir App.tsx por completo).'

export function multiPageContextBlock(): string {
  return MULTI_PAGE_APP_HINT
}
