# Plan de Migración a TypeScript

## Resumen

- **Total de archivos a migrar**: 71
- **Archivos nuevos a crear**: ~5 (tipos y configuración)
- **Tiempo estimado**: Depende de disponibilidad (se puede hacer gradualmente)

---

## Fase 0: Configuración (Prerequisito)

### Archivos a crear/modificar:

- [ ] `tsconfig.json` - Configuración TypeScript
- [ ] `tsconfig.node.json` - Configuración para Vite
- [ ] `vite.config.ts` - Renombrar de .js a .ts
- [ ] `src/types/index.ts` - Tipos globales
- [ ] `src/types/api.ts` - Tipos de respuestas API

### Dependencias a instalar:

```bash
npm install -D typescript @types/react @types/react-dom @types/node
```

---

## Fase 1: Fundación (Crítico - Hacer primero)

### 1.1 Utilidades y Servicios (3 archivos)

- [ ] `src/lib/utils.js` → `src/lib/utils.ts`
- [ ] `src/utils/dateUtils.js` → `src/utils/dateUtils.ts`
- [ ] `src/services/api.js` → `src/services/api.ts`

### 1.2 Contexto (1 archivo)

- [ ] `src/context/AuthContext.jsx` → `src/context/AuthContext.tsx`

### 1.3 Entry Point (1 archivo)

- [ ] `src/main.jsx` → `src/main.tsx`
- [ ] `src/App.jsx` → `src/App.tsx`

**Total Fase 1: 6 archivos**

---

## Fase 2: Componentes UI Base (shadcn/ui) (19 archivos)

Estos son componentes de shadcn/ui que ya tienen tipos bien definidos.

- [ ] `src/components/ui/alert.jsx` → `.tsx`
- [ ] `src/components/ui/avatar.jsx` → `.tsx`
- [ ] `src/components/ui/badge.jsx` → `.tsx`
- [ ] `src/components/ui/button.jsx` → `.tsx`
- [ ] `src/components/ui/card.jsx` → `.tsx`
- [ ] `src/components/ui/checkbox.jsx` → `.tsx`
- [ ] `src/components/ui/dialog.jsx` → `.tsx`
- [ ] `src/components/ui/dropdown-menu.jsx` → `.tsx`
- [ ] `src/components/ui/form.jsx` → `.tsx`
- [ ] `src/components/ui/input.jsx` → `.tsx`
- [ ] `src/components/ui/label.jsx` → `.tsx`
- [ ] `src/components/ui/radio-group.jsx` → `.tsx`
- [ ] `src/components/ui/scroll-area.jsx` → `.tsx`
- [ ] `src/components/ui/select.jsx` → `.tsx`
- [ ] `src/components/ui/separator.jsx` → `.tsx`
- [ ] `src/components/ui/sheet.jsx` → `.tsx`
- [ ] `src/components/ui/skeleton.jsx` → `.tsx`
- [ ] `src/components/ui/switch.jsx` → `.tsx`
- [ ] `src/components/ui/table.jsx` → `.tsx`
- [ ] `src/components/ui/textarea.jsx` → `.tsx`

**Total Fase 2: 19 archivos**

---

## Fase 3: Componentes Comunes (4 archivos)

- [ ] `src/components/Breadcrumbs.jsx` → `.tsx`
- [ ] `src/components/common/SectionHeader.jsx` → `.tsx`
- [ ] `src/components/common/StandardModal.jsx` → `.tsx`
- [ ] `src/components/common/StandardTable.jsx` → `.tsx`

**Total Fase 3: 4 archivos**

---

## Fase 4: Componentes de Proyecto (10 archivos)

- [ ] `src/components/ProjectsList.jsx` → `.tsx`
- [ ] `src/components/project/CostSummaryCards.jsx` → `.tsx`
- [ ] `src/components/project/ExpensesByCategory.jsx` → `.tsx`
- [ ] `src/components/project/ProjectAlerts.jsx` → `.tsx`
- [ ] `src/components/project/ProjectKPIsCards.jsx` → `.tsx`
- [ ] `src/components/project/ProjectSubMenu.jsx` → `.tsx`
- [ ] `src/components/project/ProjectTeam.jsx` → `.tsx`
- [ ] `src/components/project/ProjectTimeline.jsx` → `.tsx`
- [ ] `src/components/project/QuickActions.jsx` → `.tsx`
- [ ] `src/components/project/RecentExpenses.jsx` → `.tsx`

**Total Fase 4: 10 archivos**

---

## Fase 5: Formularios (14 archivos)

Estos son críticos porque manejan datos de API.

- [ ] `src/components/forms/AdendaForm.jsx` → `.tsx`
- [ ] `src/components/forms/AsignacionForm.jsx` → `.tsx`
- [ ] `src/components/forms/BudgetConfigForm.jsx` → `.tsx`
- [ ] `src/components/forms/DocumentForm.jsx` → `.tsx`
- [ ] `src/components/forms/DocumentFormN.jsx` → `.tsx`
- [ ] `src/components/forms/EquipoForm.jsx` → `.tsx`
- [ ] `src/components/forms/EquipoStatusForm.jsx` → `.tsx`
- [ ] `src/components/forms/ExpenseForm.jsx` → `.tsx`
- [ ] `src/components/forms/LicitacionForm.jsx` → `.tsx`
- [ ] `src/components/forms/OportunidadForm.jsx` → `.tsx`
- [ ] `src/components/forms/ProjectForm.jsx` → `.tsx`
- [ ] `src/components/forms/ProjectFormNew.jsx` → `.tsx`
- [ ] `src/components/forms/RegistroUsoForm.jsx` → `.tsx`
- [ ] `src/components/forms/RequisicionForm.jsx` → `.tsx`

**Total Fase 5: 14 archivos**

---

## Fase 6: Layout (1 archivo)

- [ ] `src/components/layout/AppLayout.jsx` → `.tsx`

**Total Fase 6: 1 archivo**

---

## Fase 7: Páginas Principales (8 archivos)

- [ ] `src/pages/LoginN.jsx` → `.tsx`
- [ ] `src/pages/DashboardNew.jsx` → `.tsx`
- [ ] `src/pages/ClientesN.jsx` → `.tsx`
- [ ] `src/pages/DocumentosHubN.jsx` → `.tsx`
- [ ] `src/pages/RequisicionesGeneral.jsx` → `.tsx`
- [ ] `src/pages/equipos/AsignacionesEquiposN.jsx` → `.tsx`
- [ ] `src/pages/equipos/EquiposInformacionN.jsx` → `.tsx`
- [ ] `src/pages/equipos/EquiposStatusN.jsx` → `.tsx`

**Total Fase 7: 8 archivos**

---

## Fase 8: Páginas de Proyecto (8 archivos)

- [ ] `src/pages/project/ProjectAdendas.jsx` → `.tsx`
- [ ] `src/pages/project/ProjectBitacora.jsx` → `.tsx`
- [ ] `src/pages/project/ProjectCostos.jsx` → `.tsx`
- [ ] `src/pages/project/ProjectDetailLayout.jsx` → `.tsx`
- [ ] `src/pages/project/ProjectMembers.jsx` → `.tsx`
- [ ] `src/pages/project/ProjectRequisiciones.jsx` → `.tsx`
- [ ] `src/pages/project/ProjectSummary.jsx` → `.tsx`
- [ ] `src/pages/project/ProjectTodos.jsx` → `.tsx`

**Total Fase 8: 8 archivos**

---

## Resumen por Fase

| Fase      | Descripción          | Archivos   | Prioridad  |
| --------- | -------------------- | ---------- | ---------- |
| 0         | Configuración        | 5 nuevos   | 🔴 Crítica |
| 1         | Fundación            | 6          | 🔴 Crítica |
| 2         | UI Base (shadcn)     | 19         | 🟡 Media   |
| 3         | Componentes Comunes  | 4          | 🟡 Media   |
| 4         | Componentes Proyecto | 10         | 🟡 Media   |
| 5         | Formularios          | 14         | 🔴 Alta    |
| 6         | Layout               | 1          | 🟢 Baja    |
| 7         | Páginas Principales  | 8          | 🟡 Media   |
| 8         | Páginas Proyecto     | 8          | 🟡 Media   |
| **Total** |                      | **71 + 5** |            |

---

## Tipos a Definir (src/types/)

### api.ts - Respuestas de API

```typescript
// Proyectos
interface Project { ... }
interface ProjectMember { ... }
interface Adenda { ... }

// Costos
interface Expense { ... }
interface Category { ... }
interface Budget { ... }

// Usuarios
interface User { ... }
interface AuthResponse { ... }

// Requisiciones
interface Requisicion { ... }

// Equipos
interface Equipo { ... }
interface Asignacion { ... }

// Bitácora
interface BitacoraEntry { ... }
interface BitacoraComment { ... }
```

---

## Estrategia de Migración

1. **No romper el build** - Cada fase debe dejar el proyecto funcionando
2. **Strict mode gradual** - Empezar con `strict: false`, activar gradualmente
3. **any temporal** - Usar `any` temporalmente donde sea necesario, refinar después
4. **Tests después de cada fase** - Verificar que todo funciona antes de continuar

---

## Comandos Útiles

```bash
# Verificar tipos sin compilar
npx tsc --noEmit

# Ver errores de tipos
npx tsc --noEmit 2>&1 | head -50

# Contar archivos pendientes
find src -name "*.jsx" | wc -l
```

---

_Documento creado: 2025-12-17_
_Última actualización: 2025-12-17_
