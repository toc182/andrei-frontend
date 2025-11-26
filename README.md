# Andrei Frontend

> Sistema de gestión de proyectos de construcción, licitaciones y equipos para Pinellas S.A.

[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646cff?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

## Descripción

Interfaz web moderna para la gestión integral de:
- **Proyectos de construcción** (activos, planificación, completados)
- **Licitaciones y oportunidades**
- **Gestión de clientes y contactos**
- **Equipos y asignaciones**
- **Generación de documentos oficiales** (PDFs)
- **Seguimiento de tuberías y frentes de obra**

## Tecnologías

### Core
- **React 19** - Framework UI con hooks modernos
- **Vite 7.x** - Build tool de alto rendimiento
- **React Router 7** - Navegación client-side

### Diseño y Componentes
- **shadcn/ui** - Sistema de componentes accesibles (copiados al proyecto, 100% personalizables)
- **Tailwind CSS 4.x** - Utility-first CSS con sintaxis moderna
- **Lucide React** - Iconos SVG optimizados
- **Radix UI** - Primitivos UI sin estilos (base de shadcn/ui)

### Formularios y Validación
- **React Hook Form** - Gestión de formularios performante
- **Zod** - Validación de esquemas TypeScript-first

### PDF y Exportación
- **jsPDF** - Generación de PDFs en cliente (cuando aplique)

### HTTP y Estado
- **Axios** - Cliente HTTP con interceptores
- **Context API** - Estado global (Auth, UI)

## Requisitos Previos

- **Node.js**: v18.x o superior
- **npm**: v9.x o superior
- **Backend**: Servidor backend corriendo en `http://localhost:5000`

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/toc182/andrei-frontend.git
cd andrei-frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El servidor se iniciará en: **http://localhost:5173**

## Scripts Disponibles

```bash
# Desarrollo - Hot Module Replacement
npm run dev

# Desarrollo - Exponer a red local (para testing móvil)
npm run dev -- --host

# Build para producción
npm run build

# Preview del build de producción
npm run preview

# Linting
npm run lint
```

## Estructura de Carpetas

```
andrei-frontend/
├── src/
│   ├── components/          # Componentes React
│   │   ├── ui/              # Componentes shadcn/ui (Button, Dialog, etc.)
│   │   ├── layout/          # Layouts (AppLayout, Sidebar, etc.)
│   │   ├── forms/           # Formularios (DocumentFormN, etc.)
│   │   └── *.jsx            # Componentes específicos
│   ├── pages/               # Páginas/vistas principales
│   │   ├── equipos/         # Módulo de equipos
│   │   └── *.jsx            # Dashboard, Clientes, etc.
│   ├── context/             # React Context providers
│   │   └── AuthContext.jsx  # Autenticación global
│   ├── services/            # Servicios y utilidades
│   │   └── api.js           # Cliente Axios configurado
│   ├── index.css            # Estilos globales + tema Tailwind
│   ├── App.jsx              # Componente raíz
│   └── main.jsx             # Entry point
├── public/                  # Archivos estáticos
├── .env                     # Variables de entorno (NO commitear)
├── vite.config.js           # Configuración de Vite
├── tailwind.config.js       # Configuración de Tailwind
└── package.json             # Dependencias y scripts
```

## Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# URL del backend (desarrollo)
VITE_API_URL=http://localhost:5000/api

# URL del backend (producción - opcional, se detecta automáticamente)
# VITE_API_URL=https://tu-backend.railway.app/api
```

**Nota**: El archivo `src/services/api.js` ya tiene configuración de fallback inteligente.

## Configuración del Backend

El frontend se conecta al backend en `http://localhost:5000/api` por defecto.

**Verificar configuración en**: `src/services/api.js` (línea 7)

```javascript
baseURL: process.env.VITE_API_URL || 'http://localhost:5000/api',
```

## Diseño Responsive

El proyecto implementa un enfoque **mobile-first**:

- **Móvil**: < 768px (diseño vertical, cards)
- **Desktop**: ≥ 768px (tablas, grids)

### Testing en Dispositivos Móviles

```bash
# Exponer servidor a red local
npm run dev -- --host

# Obtener IP local (Windows)
ipconfig | findstr "IPv4"

# Acceder desde móvil
# http://[TU-IP-LOCAL]:5173
```

**Ejemplo**: `http://192.168.1.100:5173`

## Sistema de Componentes

### shadcn/ui Instalados

El proyecto incluye los siguientes componentes de shadcn/ui:

```
✓ Button       ✓ Badge        ✓ Card
✓ Dialog       ✓ Table        ✓ Form
✓ Input        ✓ Select       ✓ Textarea
✓ RadioGroup   ✓ Label        ✓ Alert
✓ Skeleton     ✓ Avatar       ✓ Dropdown Menu
✓ Scroll Area  ✓ Sheet        ✓ Checkbox
```

Todos los componentes están en: `src/components/ui/`

### Tailwind 4.x - Sintaxis Crítica

⚠️ **IMPORTANTE**: Tailwind 4.x usa sintaxis diferente a v3.x

**Correcto (Tailwind 4.x):**
```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(31% 0.025 235);
}
```

**Incorrecto (Tailwind 3.x - NO usar):**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Ver: `src/index.css` para referencia completa

## Patrones de Código

### Crear Nuevo Componente

```jsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function MiComponente() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Título</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Acción</Button>
      </CardContent>
    </Card>
  )
}
```

### Formulario con React Hook Form

```jsx
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function MiFormulario() {
  const { register, handleSubmit } = useForm()

  const onSubmit = (data) => {
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register("nombre")} placeholder="Nombre" />
      <Button type="submit">Enviar</Button>
    </form>
  )
}
```

### Llamada a API

```jsx
import api from "../services/api"

const fetchData = async () => {
  try {
    const response = await api.get('/clientes')
    console.log(response.data)
  } catch (error) {
    console.error('Error:', error)
  }
}
```

## Troubleshooting

### Error: "Failed to load resource: 404 (Not Found)"

**Causa**: Backend no está corriendo o configuración de puerto incorrecta

**Solución**:
```bash
# Verificar que backend esté en puerto 5000
netstat -ano | findstr :5000

# Verificar api.js apunta a puerto correcto
# Debe ser: http://localhost:5000/api (NO 3000)
```

### Error: Página en blanco después de `npm run dev`

**Causa**: Puerto 5173 ya está en uso por otro proceso

**Solución**:
```bash
# Verificar proceso usando el puerto
netstat -ano | findstr :5173

# Matar proceso si es necesario
taskkill /f /pid [PID]

# Reiniciar Vite
npm run dev
```

### Error: "Cannot find module '@/components/ui/...'"

**Causa**: Alias `@` no configurado correctamente

**Solución**: Verificar `vite.config.js`:
```javascript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
}
```

### Problemas de CSS/Tailwind

**Síntomas**: Estilos no se aplican, clases no funcionan

**Solución**:
1. Verificar sintaxis Tailwind 4.x en `src/index.css`
2. Verificar `@import "tailwindcss"` (NO `@tailwind`)
3. Reiniciar servidor dev

## Despliegue en Producción

### Plataforma: Vercel

El proyecto está configurado para auto-deploy desde GitHub:

1. **Hacer commit y push**:
```bash
git add .
git commit -m "Descripción de cambios

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

2. **Vercel detecta cambios automáticamente** y ejecuta el build

3. **Verificar en**: Dashboard de Vercel

### Variables de Entorno en Producción

En Vercel Dashboard > Settings > Environment Variables:

```
VITE_API_URL=https://tu-backend.railway.app/api
```

## Documentación Adicional

- **CLAUDE.md** - Guía completa del proyecto, arquitectura, troubleshooting
- **COMPONENT_SYSTEM.md** - Detalles del sistema shadcn/ui + Tailwind
- **IMPROVEMENTS.md** - Auditoría de código y mejoras realizadas

## Puertos y Configuración

⚠️ **REGLA ABSOLUTA - NO MODIFICAR**:
- **Frontend**: Siempre puerto **5173**
- **Backend**: Siempre puerto **5000**

Nunca usar puertos alternativos (5174, 5175, 3000, etc.)

## Autenticación

El sistema usa **JWT** (JSON Web Tokens):
- Token almacenado en `localStorage`
- Expiración: 24 horas
- Renovación: Manual (re-login)

Roles disponibles:
- `admin` - Acceso completo
- `user` - Acceso limitado

## Contacto y Soporte

- **Repositorio**: https://github.com/toc182/andrei-frontend
- **Issues**: GitHub Issues (repositorio)
- **Documentación**: Ver `CLAUDE.md` en la raíz del proyecto

---

**Última actualización**: Noviembre 2025
**Versión**: 1.0.0
**Licencia**: Privado - Pinellas S.A.
