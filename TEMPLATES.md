# SOP CHECKLIST DEL AGENTE: ZIP ADJUNTO -> PLANTILLA FINAL (SIN PROGRAMAS INTERNOS)

Este documento define cómo debo trabajar yo (agente) **directamente sobre un ZIP adjunto**, sin usar APIs, pipelines u orquestadores internos del proyecto.

---

## 0) Datos mínimos para empezar

Para ejecutar una conversión necesito:

- [ ] plataforma objetivo (`wordpress`, `joomla`, `prestashop`, etc.)
- [ ] ZIP adjunto en el chat (o ruta absoluta si ya existe localmente)
- [ ] objetivo del trabajo:
  - [ ] solo conversión
  - [ ] conversión + validación
  - [ ] conversión + validación + instalación local

---

## 1) Preparación de carpetas de trabajo

- [ ] Crear estructura base en local:
  - [ ] `~/Downloads/stitch-zip/inputs/<platform>/`
  - [ ] `~/Downloads/stitch-zip/work/<platform>/<slug>/`
  - [ ] `~/Downloads/stitch-zip/outputs/<platform>/<slug>/`
  - [ ] `~/Downloads/stitch-zip/reports/`
- [ ] Copiar el ZIP adjunto a `inputs/<platform>/`
- [ ] Normalizar `<slug>` (nombre corto en minúsculas y guiones)

---

## 2) Inspección inicial del ZIP (manual)

- [ ] Listar contenido:

```bash
unzip -l "$HOME/Downloads/stitch-zip/inputs/<platform>/<file>.zip"
```

- [ ] Confirmar estructura base:
  - [ ] HTML principal (`index.html` o equivalente)
  - [ ] assets (`css`, `js`, `img`, `fonts`)
  - [ ] páginas internas (si existen)
- [ ] Detectar problemas tempranos:
  - [ ] rutas rotas
  - [ ] nombres con caracteres extraños
  - [ ] archivos faltantes

---

## 3) Extracción y previsualización

- [ ] Extraer en carpeta de trabajo:

```bash
mkdir -p "$HOME/Downloads/stitch-zip/work/<platform>/<slug>/source" \
  && unzip -o "$HOME/Downloads/stitch-zip/inputs/<platform>/<file>.zip" \
  -d "$HOME/Downloads/stitch-zip/work/<platform>/<slug>/source"
```

- [ ] Levantar servidor local para revisión visual:

```bash
python3 -m http.server 8099 --directory "$HOME/Downloads/stitch-zip/work/<platform>/<slug>/source"
```

- [ ] Validar visualmente:
  - [ ] home carga correctamente
  - [ ] navegación funcional
  - [ ] responsive básico
  - [ ] tipografías e imágenes cargan

---

## 4) Conversión manual por plataforma (sin orquestador)

- [ ] Crear carpeta de exportación:
  - [ ] `~/Downloads/stitch-zip/outputs/<platform>/<slug>/export/`
- [ ] Adaptar estructura según plataforma:
  - [ ] **WordPress**: `style.css`, `index.php`, `functions.php`, `header.php`, `footer.php`, `assets/...`
  - [ ] **Joomla**: `templateDetails.xml`, `index.php`, `css/...`, `js/...`
  - [ ] **PrestaShop**: `config/`, `templates/`, `assets/`, `theme.yml` (si aplica)
- [ ] Reescribir rutas absolutas/relativas para que funcionen dentro de la plataforma
- [ ] Sustituir HTML estático por plantillas parciales/layouts de la plataforma
- [ ] Mantener una versión de preview en:
  - [ ] `~/Downloads/stitch-zip/outputs/<platform>/<slug>/preview/`

---

## 5) Validaciones post-conversión

- [ ] Validación de estructura mínima:
  - [ ] **WordPress**: existe `style.css` con cabecera válida
  - [ ] **Joomla**: existe `templateDetails.xml` válido
  - [ ] **PrestaShop**: estructura de tema completa
- [ ] Validación funcional:
  - [ ] home renderiza
  - [ ] assets cargan sin 404
  - [ ] navegación principal operativa
- [ ] Validación de consistencia visual:
  - [ ] diferencias no críticas frente al HTML original
  - [ ] fuentes/espaciados/colores razonables

---

## 6) Empaquetado final

- [ ] Generar ZIP instalable en:
  - [ ] `~/Downloads/stitch-zip/outputs/<platform>/<slug>/package/<slug>-<platform>.zip`
- [ ] (Opcional marketplace) preparar variante con estructura de entrega comercial:
  - [ ] documentación
  - [ ] demo content
  - [ ] preview cover

---

## 7) Instalación local (si el usuario lo pide)

- [ ] Instalar el paquete en entorno local de la plataforma
- [ ] Verificar activación del tema/plantilla
- [ ] Probar páginas clave (home, listing, detalle, checkout si aplica)
- [ ] Registrar evidencias y errores reales encontrados

---

## 8) Reporte obligatorio al usuario

Por cada ZIP procesado debo entregar:

- [ ] plataforma objetivo
- [ ] nombre/ruta del ZIP de entrada
- [ ] ruta exacta del paquete generado
- [ ] estado de conversión (`ok` / `parcial` / `fallo`)
- [ ] estado de validación
- [ ] estado de instalación local (si aplica)
- [ ] resumen de incidencias y decisiones tomadas
- [ ] ruta del reporte técnico

Formato recomendado de reporte técnico:

`~/Downloads/stitch-zip/reports/<slug>-<platform>-<timestamp>.md`

---

## 9) Política de fallos y reintentos

- [ ] No borrar trabajo parcial útil
- [ ] Indicar fase exacta del fallo (inspección, conversión, empaquetado, instalación)
- [ ] Guardar evidencia (logs, capturas, archivos conflictivos)
- [ ] Proponer reintento **por etapa** (evitar rehacer todo)
- [ ] Si falta información del usuario, solicitar solo lo mínimo imprescindible
