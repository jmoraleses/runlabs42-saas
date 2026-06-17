# Guía de Planificación - Spec-Driven Development

## ¿Qué es Planificar?

**Planificar** (Plan Mode / Spec-Kit) es una metodología de desarrollo basada en especificaciones que genera planes detallados antes de escribir código. Está inspirado en [github/spec-kit](https://github.com/github/spec-kit).

---

## Cómo Funciona

### 1. **Activar el Modo Planificar**

En cualquier chat (Studio o página principal):
- Busca el botón **"Planificar"** o toggle en el composer
- Actívalo antes de enviar tu prompt

```
💡 Tip: El toggle aparece junto a las opciones de modelo
```

### 2. **El Flujo de Planificación**

Cuando envías un prompt con Planificar activado, Runlabs42 ejecuta estos pasos:

#### **Fase 1: Constitution** 📋
- Define principios del proyecto
- Calidad, UX, rendimiento, pruebas
- Archivo: `specs/constitution.md`

#### **Fase 2: Specification** 📝
- QUÉ construir y POR QUÉ
- User stories y criterios de aceptación
- SIN código, solo requisitos
- Archivo: `specs/spec.md`

#### **Fase 3: Plan** 🗺️
- Plan técnico detallado
- Stack, arquitectura, rutas, componentes
- Decisiones tecnológicas
- Archivo: `specs/plan.md`

#### **Fase 4: Tasks** ✅
- Lista de tareas numeradas y ordenadas
- Listas para implementar
- Archivo: `specs/tasks.md`

#### **Fase 5: Implement** 💻
- Genera código completo
- React + framework configurado
- Componentes, rutas, estilos

### 3. **Los Archivos Creados**

Después de completar el flujo, tu proyecto tendrá:

```
project/
├── specs/                    ← Carpeta de especificaciones
│   ├── constitution.md      ← Principios del proyecto
│   ├── spec.md             ← Requisitos funcionales
│   ├── plan.md             ← Plan técnico
│   └── tasks.md            ← Tareas a implementar
├── src/
│   ├── App.tsx
│   ├── components/
│   └── ...
└── ... (otros archivos generados)
```

---

## Uso Práctico

### Escenario 1: Crear un Nuevo Proyecto

**Prompt:**
```
Crear un sistema de gestión de tareas con:
- Autenticación de usuarios
- CRUD completo de tareas
- Filtros por estado (pendiente, completado)
- Diseño responsivo
```

**Con Planificar activado:**
1. Se genera `specs/constitution.md` con principios de UX
2. Se crea `specs/spec.md` con user stories
3. Se planifica `specs/plan.md` con componentes React
4. Se listan `specs/tasks.md` con implementación
5. Se genera código funcional automáticamente

### Escenario 2: Mejorar un Proyecto Existente

**Después de revisar el código generado:**

1. **Edita** `specs/spec.md` si cambió algo
2. **Actualiza** `specs/plan.md` con nuevas rutas
3. **Modifica** `specs/tasks.md` con nuevas funcionalidades
4. Vuelve a generar código desde el editor

---

## Cómo Editar las Especificaciones

### En el Editor

1. Abre tu proyecto en Studio
2. En el panel de archivos, ve a `specs/`
3. Haz clic en el archivo que quieres editar:
   - `constitution.md`
   - `spec.md`
   - `plan.md`
   - `tasks.md`

4. Edita directamente el contenido markdown
5. Los cambios se guardan automáticamente

### Cambios Recomendados

**Constitution:**
- Agregar nuevos principios de diseño
- Actualizar estándares de calidad

**Spec:**
- Nuevas user stories
- Criterios de aceptación modificados

**Plan:**
- Cambios en arquitectura
- Nuevas rutas o componentes

**Tasks:**
- Tareas prioritarias
- Subtareas desglosadas

---

## Mejores Prácticas

### ✅ Hazlo Así

1. **Sé específico en tu descripción inicial**
   ```
   ❌ "Crear una app"
   ✅ "Crear un dashboard de análisis con gráficos interactivos
        que muestren tendencias mensuales y comparativas"
   ```

2. **Revisa el plan antes de generar código**
   - Lee `specs/spec.md` y `specs/plan.md`
   - Verifica que sea lo que esperabas
   - Ajusta si es necesario

3. **Mantén las especificaciones actualizadas**
   - Si cambias requisitos, actualiza `specs/`
   - Regresa con nuevos specs = código mejor

4. **Usa las tareas como checklist**
   - Marca completadas en `specs/tasks.md`
   - Estructura para testing

### ❌ Evita Esto

1. Prompts vagos sin contexto
2. No revisar las specs generadas
3. Ignorar el plan técnico y pedir código directamente
4. No actualizar las specs cuando el proyecto evoluciona

---

## Comandos Avanzados

Si trabajas con la API o usas comandos directos:

```bash
# Iniciar especificación
/speckit.specify tu idea aquí

# Generar solo plan técnico
/speckit.plan mejora de arquitectura

# Obtener checklist de tareas
/speckit.tasks

# Implementar desde specs existentes
/speckit.implement
```

---

## Flujo de Trabajo Recomendado

```
1. Activa "Planificar" toggle
   ↓
2. Describe tu idea claramente
   ↓
3. Espera a que se generen las 5 fases
   ↓
4. Revisa los archivos en specs/
   ↓
5. Edita lo que necesite cambios
   ↓
6. Envía el código generado al editor
   ↓
7. Refina en el editor según sea necesario
   ↓
8. Guarda y publica tu proyecto
```

---

## Características Incluidas

### En Constitution
- Principios de UX/DX
- Estándares de calidad
- Rendimiento esperado
- Testing strategy

### En Specification
- User personas
- User stories con formato gherkin
- Criterios de aceptación
- Casos de uso

### En Plan
- Arquitectura propuesta
- Stack tecnológico
- Componentes principales
- Rutas y navegación
- Estructura de datos

### En Tasks
- Tareas numeradas
- Dependencias
- Estimaciones
- Checklist implementable

---

## Solución de Problemas

### P: ¿Dónde están los archivos specs?
**R:** En la carpeta `specs/` de tu proyecto. Visible en el editor bajo "Archivos".

### P: ¿Puedo modificar los specs después?
**R:** ¡Sí! Son archivos markdown normales. Edita y vuelve a usar el prompt con specs actualizados.

### P: ¿Qué pasa si no tengo "Planificar" activado?
**R:** Se genera código directamente sin fases de planificación. Menos estructura, más rápido.

### P: ¿Los specs son obligatorios?
**R:** No. Es opcional. Úsalo cuando necesites proyectos bien planificados y documentados.

### P: ¿Puedo combinar Planificar con otras opciones?
**R:** Sí. Funciona con cualquier modelo y framework seleccionado.

---

## Recursos

- [Spec-Kit Oficial](https://github.com/github/spec-kit)
- [Spec-Driven Development](https://github.com/github/spec-kit/blob/main/README.md)
- Documentación de Runlabs42: Consulta la sección de Studio

---

## Ejemplos de Proyectos Bien Planificados

### E-Commerce
```markdown
# Constitution
- Rendimiento: < 2s en home
- Mobile-first responsive
- Accesibilidad WCAG 2.1
```

### SaaS Dashboard
```markdown
# Specification
- User Admin: crear, editar, eliminar usuarios
- User Editor: ver stats, exportar reports
- Guest: solo lectura de datos públicos
```

### Blog con CMS
```markdown
# Plan
- Backend: Node/Express
- Frontend: React + TailwindCSS
- DB: PostgreSQL
- Auth: JWT
```

---

¡Usa Planificar para proyectos serios y bien estructurados! 🚀
