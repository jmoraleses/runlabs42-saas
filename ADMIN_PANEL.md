# Panel de Administración - Runlabs42

## Descripción General

El panel de administración está disponible en `/admin` y proporciona herramientas completas para gestionar la plataforma Runlabs42.

**Acceso restringido a:** `javiermoralesestevez@gmail.com`, `demo@runlabs42.com`

---

## Funcionalidades Implementadas

### 1. **Panel de Resumen (Overview)**
- Estadísticas en tiempo real:
  - Nuevos usuarios (últimos 7 meses)
  - Nuevas suscripciones
  - Créditos utilizados
  - Ingresos totales

- Gráficos:
  - Línea de área: Actividad de usuarios
  - Gráfico de barras: Créditos por mes
  - Donut: Distribución de planes

---

### 2. **Gestión de Créditos**
Configurar créditos gratis que se otorgan automáticamente a nuevos usuarios.

**Parámetros configurables:**
- **Créditos al registrarse:** Cantidad inicial (1-200)
- **Máximo por usuario:** Tope de créditos acumulables (1-500)
- **Caducidad (días):** Días de validez (1-365)
- **Presupuesto máximo total:** Límite global (100-99,999)

**Indicador visual:**
- Barra de progreso con color según uso:
  - Verde: < 65%
  - Naranja: 65-85%
  - Rojo: > 85% (alerta)

**Persistencia:** Los cambios se guardan automáticamente en localStorage.

---

### 3. **Modo de Mantenimiento**
Pausa la plataforma completamente, mostrando un mensaje a los usuarios.

**Características:**
- Bloquea acceso a todas las rutas (excepto `/admin`)
- Mensaje personalizable en múltiples idiomas
- Tiempo estimado opcional
- Email de contacto para soporte

**Idiomas soportados:**
- English (EN)
- Español (ES)
- Français (FR)
- Deutsch (DE)
- Nederlands (NL)
- Italiano (IT)

**Comportamiento:**
1. Activa el toggle "Poner plataforma en mantenimiento"
2. Personaliza el mensaje (usa default si está vacío)
3. Guarda los cambios
4. Los usuarios verán la página de mantenimiento automáticamente

**Desactivación:** Desactiva el toggle nuevamente y guarda.

---

### 4. **Gestión de Usuarios**
Administra las cuentas de usuarios registrados.

**Funcionalidades:**
- **Búsqueda:** Por nombre o email
- **Filtros:**
  - Todos: Todas las cuentas
  - Pro: Usuarios con plan Pro
  - Free: Usuarios con plan Free
  - Deshabilitados: Cuentas suspendidas

- **Acciones por usuario:**
  - Habilitar/deshabilitar cuenta (requiere confirmación)
  - Ver información completa:
    - Nombre y email
    - Plan actual
    - Créditos disponibles
    - Fecha de registro
    - Último acceso

**Persistencia:** Los cambios se guardan automáticamente en localStorage.

---

### 5. **Estadísticas Avanzadas**
Análisis detallados de la plataforma.

**Métricas incluidas:**
- Usuarios activos
- Tasa de crecimiento
- Ingresos mensuales
- Uso de créditos
- Retención de usuarios

**Gráficos:**
- Tendencias mensuales
- Distribución por plan
- Evolución de ingresos

---

### 6. **Controles Globales**
- **Tema:** Cambiar entre modo oscuro y claro
- **Idioma:** Selector de idioma para la interfaz del admin

---

## Almacenamiento de Datos

Todos los datos se persisten en **localStorage** del navegador:

```javascript
// Configuración de créditos
localStorage.getItem('adm.creditConfig')

// Configuración de mantenimiento
localStorage.getItem('adm.maintenanceConfig')

// Lista de usuarios
localStorage.getItem('adm.users')
```

### Estructura de datos:

**creditConfig:**
```json
{
  "enabled": true,
  "creditsOnRegister": 10,
  "maxPerUser": 10,
  "maxTotalBudget": 5000,
  "currentTotalGiven": 1223,
  "expiresAfterDays": 30
}
```

**maintenanceConfig:**
```json
{
  "enabled": false,
  "title": "Estamos mejorando Runlabs42",
  "message": "La plataforma estará disponible en breve...",
  "estimatedTime": "2 horas",
  "contactEmail": "soporte@runlabs42.com"
}
```

**users:**
```json
[
  {
    "id": 1,
    "name": "Ana García",
    "email": "ana@ejemplo.com",
    "plan": "pro",
    "credits": 67,
    "status": "active",
    "joined": "15 Dic 2025",
    "lastActive": "Hoy"
  }
]
```

---

## Flujos de Trabajo Comunes

### Activar Mantenimiento
1. Ir a "Modo mantenimiento"
2. Activar toggle "Poner plataforma en mantenimiento"
3. Personalizar mensaje (opcional)
4. Guardar cambios
5. El resto de usuarios verá la página de mantenimiento

### Cambiar Créditos Iniciales
1. Ir a "Créditos de prueba gratuitos"
2. Modificar "Créditos al registrarse"
3. Guardar cambios
4. Los nuevos usuarios recibirán la cantidad configurada

### Deshabilitar Usuario
1. Ir a "Usuarios"
2. Buscar o filtrar el usuario
3. Hacer clic en el botón de acción (toggle)
4. Confirmar la acción
5. La cuenta estará suspendida

### Monitorear Créditos
1. Ir a "Créditos de prueba gratuitos"
2. Ver barra de progreso del presupuesto
3. Si está > 85%, se muestra alerta
4. Aumentar límite o desactivar si es necesario

---

## Notas Técnicas

### Validaciones
- Números negativos se previenen automáticamente
- Rangos mínimos y máximos se respetan
- Cambios se guardan automáticamente en localStorage
- Toast notifications para feedback del usuario

### Rendimiento
- Componentes memoizados para prevenir re-renders innecesarios
- Filtrado y búsqueda optimizados
- Gráficos SVG inline (sin dependencias externas)

### Seguridad
- Acceso verificado por email
- Solo administradores pueden acceder
- Los datos se guardan localmente (no se envían a servidor en esta versión)

---

## Mejoras Futuras

- [ ] Conectar con API backend para persistencia en base de datos
- [ ] Auditoría de cambios (logs)
- [ ] Exportar estadísticas (CSV, PDF)
- [ ] Gestión de roles más granular
- [ ] Webhooks para acciones de admin
- [ ] Restricciones de IP
- [ ] Autenticación de dos factores para admin

---

## Soporte

Para reportar problemas o sugerencias, contacta a: `javiermoralesestevez@gmail.com`
