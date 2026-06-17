/** Cómo editar archivos que ya existen en el workspace del Studio. */

export const OVERWRITE_FILES_HINT =
  'SOBRESCRITURA DE ARCHIVOS: puedes y debes sobrescribir archivos que ya existen en el workspace. ' +
  'Cada bloque ``` con ruta en la primera línea REEMPLAZA por completo ese archivo (no es un parche parcial). ' +
  'Si el pedido requiere cambiar src/App.tsx, un componente o una página, devuelve el archivo entero actualizado — ' +
  'incluso si ya hay una versión anterior (p. ej. App.tsx en blanco o un scaffold mínimo). ' +
  'No omitas archivos por miedo a pisar contenido previo.'

export const INCREMENTAL_EDIT_HINT =
  'Edición dirigida: no sustituyas el proyecto entero por otra app distinta ni ignores el contexto existente, ' +
  'pero SÍ sobrescribe con contenido completo cada archivo que deba cambiar para cumplir el pedido.'

export function workspaceEditContextBlock(): string {
  return `${OVERWRITE_FILES_HINT} ${INCREMENTAL_EDIT_HINT}`
}
