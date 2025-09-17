# Estructura CSS del Proyecto Andrei

## 📁 Organización de Archivos

```
src/styles/
├── components/
│   ├── common.css          # Estilos universales y reutilizables
│   ├── projects.css        # Estilos específicos de proyectos
│   └── [futuras-secciones].css
├── globals.css             # Variables CSS y estilos base
├── layout.css              # Layout principal (sidebar, header)
└── navigation.css          # Navegación del sidebar
```

## 🎯 Clases Universales para Headers de Sección

### Para Contenedores de Sección:
```jsx
// Estructura OBLIGATORIA para todas las secciones
<div className="section-container">
  <div className="section-header">
    <h1>Título de la Sección</h1>
    <button className="btn btn-primary">Agregar</button>
  </div>
  {/* Contenido de la sección */}
</div>

// Para botones de icono (como + para agregar)
<div className="section-header">
  <h1>Gestión de Proyectos</h1>
  <button className="btn-add-icon">
    <i className="fas fa-plus"></i>
  </button>
</div>
```

### Clase Principal:
- `.section-header` - **ÚNICA clase universal** para todos los headers de sección

### Clases Específicas (solo si necesario):
- Solo agregar clases específicas como `.clients-header` si esa sección necesita estilos únicos diferentes al estándar

## 🎨 Estilos Aplicados Automáticamente

La clase `.section-header` incluye:
- **Padding compacto**: `0.25rem 0.75rem`
- **Margen inferior**: `1rem` (separación mejorada de contenido)
- **Fuente del título**: `1.25rem` (compacta pero legible)
- **Espaciado entre elementos**: `justify-content: space-between`
- **Tarjeta blanca** con sombra consistente
- **Border radius**: `6px`
- **Sombra uniforme**: `0 4px 15px rgba(0, 0, 0, 0.25)`
- **Botón de icono**: Estilos para `.btn-add-icon` incluidos
- **Responsive design**: Automático en todos los breakpoints

## 📝 Ejemplo Completo para Nueva Sección

```jsx
// ClientesHub.jsx (ejemplo)
import React from 'react';

function ClientesHub() {
  return (
    <div className="section-container">
      <div className="section-header">
        <h1>Gestión de Clientes</h1>
        <button className="btn btn-primary">
          <i className="fas fa-plus"></i>
          Nuevo Cliente
        </button>
      </div>

      <div className="clients-table-container">
        {/* Tabla de clientes */}
      </div>
    </div>
  );
}

export default ClientesHub;
```

## 🔧 Personalización

Si necesitas un header diferente para una sección específica:

1. **Usa la clase universal** y agrega modificaciones específicas:
```css
/* En tu archivo CSS específico */
.special-section .section-header {
  background: #custom-color;
}
```

2. **O crea una clase específica** siguiendo el patrón:
```css
/* En common.css */
.custom-header {
  /* Copia los estilos base y modifica lo necesario */
}
```

## 📋 TODO: Próximas Secciones a Migrar

- [ ] Documentos (DocumentosHub.jsx)
- [ ] Clientes
- [ ] Reportes
- [ ] Configuración

## 💡 Beneficios de esta Estructura

✅ **Consistencia**: Todos los títulos se ven igual
✅ **Mantenibilidad**: Un solo lugar para cambiar el estilo de todos los headers
✅ **Escalabilidad**: Fácil agregar nuevas secciones
✅ **DRY**: No repetir código CSS
✅ **Flexibilidad**: Permite personalizaciones específicas cuando sea necesario
✅ **Sombras uniformes**: Todas las cards y elementos tienen la misma sombra
✅ **Variables CSS**: Sombras definidas en `globals.css` para fácil mantenimiento

## 🎨 Sistema de Sombras Unificado

Todas las sombras en el proyecto ahora usan:
```css
/* En globals.css */
--shadow-sm: 0 4px 15px rgba(0, 0, 0, 0.25);
--shadow-md: 0 4px 15px rgba(0, 0, 0, 0.25);
--shadow-sidebar: 0 4px 15px rgba(0, 0, 0, 0.25);
```

Esto garantiza que:
- Headers de secciones
- Tablas de contenido
- Modales
- Cards de documentos
- Sidebar y navegación

Todos tengan el mismo estilo visual consistente.