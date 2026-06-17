/** Instrucciones para que la IA genere todos los módulos que importa el código. */

export const COMPLETE_IMPORTS_HINT =
  'DEPENDENCIAS COMPLETAS (obligatorio en /build): ' +
  'Si un archivo importa otro con ruta relativa (./pages/Home, ../context/AuthContext, etc.), ' +
  'DEBES incluir en la misma respuesta un bloque ``` con el archivo importado, con código completo y funcional. ' +
  'Nunca dejes imports a módulos que no existen en el workspace: el preview fallará. ' +
  'Estructura típica React: src/App.tsx (rutas), src/pages/* (pantallas), src/components/*, src/context/* (providers), src/hooks/*. ' +
  'Antes de cerrar la respuesta, revisa cada import de App.tsx y de los archivos que crees; genera TODOS los archivos faltantes. ' +
  'Prioridad: si actualizas App.tsx con nuevas rutas o imports, devuelve App.tsx Y cada página/componente/context nuevo en bloques separados. ' +
  'Sobrescribe App.tsx por completo si hace falta conectar la UI (no dejes la plantilla en blanco).'

export function completeImportsContextBlock(): string {
  return COMPLETE_IMPORTS_HINT
}
