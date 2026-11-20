// Lo que muestra la tabla de Permisos de la Administración.
//
// Paso 1 (Ivan, 2026-11-18): «el layout de cómo se ven y se asignan los permisos
// no debería cambiar nada». Cada casilla es una llave que el sistema revisa HOY
// (user_permissions); lo que hoy no tiene llave se dice con texto. Después, cada
// permiso nuevo se agrega uno a uno. Mock aprobado: versión 5 de
// https://claude.ai/artifact/J8jNDx9StPSLjBKT3mLmzt.
//
// Las llaves de casilla tienen que ser exactamente LLAVES_DE_PERFIL de
// andrei-backend/src/services/perfiles.ts: el servidor rechaza un perfil con
// otra llave, y una llave de perfil que no se viera aquí no se podría dar.
import type { UserPermissions } from '@/types/api';

export type Llave = keyof UserPermissions;
export type Columna = 'ver' | 'crear' | 'editar' | 'borrar';

export const COLUMNAS: { k: Columna; n: string }[] = [
  { k: 'ver', n: 'Ver' },
  { k: 'crear', n: 'Crear' },
  { k: 'editar', n: 'Editar' },
  { k: 'borrar', n: 'Borrar' },
];

/** Lo que no es casilla: hoy lo decide el rol, o no lo revisa nadie. */
export type Fijo = 'todos' | 'todosSistema' | 'gerencia' | 'dueno';

export const FIJO: Record<Fijo, { texto: string; ayuda: string }> = {
  todos: { texto: 'Todos', ayuda: 'Hoy no hay permiso para esto: lo puede cualquiera que tenga el proyecto.' },
  todosSistema: { texto: 'Todos', ayuda: 'Hoy no hay permiso para esto: lo puede cualquiera que entre al sistema.' },
  gerencia: { texto: 'Gerencia', ayuda: 'Solo Gerencia y el dueño.' },
  dueno: { texto: 'Dueño', ayuda: 'Solo el dueño.' },
};

export type Celda = { llave: Llave } | Fijo | null;

export interface Seccion {
  k: string;
  nombre: string;
  /** La línea del ícono de información: de qué se trata la sección. */
  info: string;
  nota?: string;
  /** null o ausente = no existe en esta sección. */
  celdas?: Partial<Record<Columna, Celda>>;
  /** Una sola llave que hoy cubre varias columnas a la vez (índices de COLUMNAS). */
  junto?: { llave: Llave; desde: number; hasta: number; texto: string };
  /** La sección no tiene llave propia: la decide otra fila. */
  va?: string;
  extras?: { llave: Llave; nombre: string }[];
}

export interface Grupo {
  grupo: string;
  nota: string;
  secciones: Seccion[];
}

// Grupos y orden: el del menú del proyecto (Ivan, 2026-11-16).
export const CATALOGO: Grupo[] = [
  {
    grupo: 'Proyecto',
    nota: 'Solo en sus proyectos',
    secciones: [
      { k: 'proyecto', nombre: 'Datos del proyecto', info: 'Nombre, cliente, fechas, estado, contrato y montos del proyecto.',
        celdas: { ver: 'todos', editar: { llave: 'proyectos_editar' } } },
      { k: 'adendas', nombre: 'Adendas', info: 'Los cambios de monto o de plazo del contrato.',
        celdas: { ver: 'todos', crear: 'todos', editar: 'todos', borrar: 'todos' } },
      { k: 'documentos', nombre: 'Documentos del proyecto', info: 'Contratos, planos y demás archivos del proyecto.',
        nota: 'Editar y borrar: los que subió. Los de otros, Gerencia.',
        celdas: { ver: 'todos', crear: 'todos', editar: 'todos', borrar: 'todos' } },
      { k: 'desglose', nombre: 'Desglose de precios', info: 'Los renglones del contrato con sus cantidades y precios.',
        nota: 'Incluye los desgloses de cuenta.',
        junto: { llave: 'desglose_ver', desde: 0, hasta: 2, texto: 'Ver, crear y editar' } },
      { k: 'tareas', nombre: 'Tareas', info: 'Los pendientes del proyecto, con responsable y fecha.',
        nota: 'Cualquiera que entre al sistema, en cualquier proyecto.',
        celdas: { ver: 'todosSistema', crear: 'todosSistema', editar: 'todosSistema', borrar: 'todosSistema' } },
      { k: 'reportes', nombre: 'Reportes diarios y semanales',
        info: 'Hacer, enviar y consultar los reportes de la obra, con sus áreas y listas. También por WhatsApp.',
        nota: 'Editar y borrar: los suyos. Corregir los de otros y dar de baja uno enviado: Gerencia.',
        junto: { llave: 'reportes', desde: 0, hasta: 3, texto: 'Ver, crear, editar, borrar y enviar' } },
      { k: 'personal', nombre: 'Personal del proyecto',
        info: 'Quién trabaja en el proyecto y quién aprueba sus pagos, órdenes y requisiciones.',
        celdas: { ver: 'todosSistema', crear: 'gerencia', editar: 'gerencia', borrar: 'gerencia' } },
      { k: 'cronograma', nombre: 'Cronograma', info: 'El programa de trabajo del proyecto.',
        nota: 'En todos los proyectos, no solo en los suyos.',
        junto: { llave: 'cronogramas_ver', desde: 0, hasta: 3, texto: 'Ver, crear, editar y borrar' } },
    ],
  },
  {
    grupo: 'Administración',
    nota: 'Solo en sus proyectos',
    secciones: [
      { k: 'costos', nombre: 'Control de costos y presupuestos', info: 'Lo gastado contra lo presupuestado, por partida.',
        nota: 'Crear, editar y borrar presupuestos: cualquiera con el proyecto.',
        celdas: { ver: { llave: 'costos_ver' }, crear: 'todos', editar: 'todos', borrar: 'todos' } },
      { k: 'requisiciones', nombre: 'Requisiciones',
        info: 'Lo que la obra le pide a la oficina: materiales, servicios o un pago.',
        nota: 'Ver: las aprobadas. Corregir: quien la escribió o quien aprueba. Aprobar y anular: quien aprueba en el proyecto.',
        celdas: { ver: { llave: 'requisiciones_ver' }, crear: { llave: 'requisiciones_crear' } },
        extras: [{ llave: 'requisiciones_atender', nombre: 'Atenderlas (cotizar, marcar líneas, crear la solicitud o la orden)' }] },
      { k: 'solicitudes', nombre: 'Solicitudes de pago', info: 'Pedir, aprobar y pagar lo que se le debe a un proveedor.',
        nota: 'Crear: cualquiera, en cualquier proyecto. Editar y borrar: las suyas. Aprobar: la cadena del proyecto.',
        celdas: { ver: { llave: 'solicitudes_ver' }, crear: 'todosSistema', editar: 'todos', borrar: 'todos' },
        extras: [
          { llave: 'solicitudes_editar_todas', nombre: 'Editar y borrar las de otros' },
          { llave: 'registrar_pago', nombre: 'Registrar pagos, facturas, devoluciones y reembolsos' },
        ] },
      { k: 'ordenes', nombre: 'Órdenes de compra', info: 'Las compras a crédito: la orden, sus facturas y su pago.',
        nota: 'Editar: las suyas, antes de enviarlas. Aprobar: la cadena del proyecto.',
        junto: { llave: 'ordenes_ver', desde: 0, hasta: 2, texto: 'Ver, crear y editar' },
        celdas: { borrar: 'gerencia' },
        extras: [{ llave: 'ordenes_entregas', nombre: 'Registrar facturas y entregas' }] },
      { k: 'cajas', nombre: 'Cajas menudas', info: 'El efectivo de la obra: apertura, gastos y reembolsos.',
        nota: 'Incluye los gastos, los reembolsos y cerrar la caja.',
        junto: { llave: 'caja_menuda', desde: 0, hasta: 2, texto: 'Ver, crear y editar' } },
      { k: 'cuentas', nombre: 'Cuentas', info: 'Lo que se le cobra al cliente en cada periodo.',
        nota: 'Borrar: solo borradores.',
        junto: { llave: 'cuentas', desde: 0, hasta: 3, texto: 'Ver, crear, editar y borrar' } },
      { k: 'descuenta', nombre: 'Desgloses de cuenta', info: 'El detalle por renglón de cada cuenta.',
        va: 'Va con «Desglose de precios».' },
      { k: 'cotizaciones', nombre: 'Cotizaciones', info: 'Las ofertas de los proveedores, para comparar y elegir.',
        nota: 'En todos los proyectos.',
        junto: { llave: 'cotizaciones', desde: 0, hasta: 3, texto: 'Ver, crear, editar y borrar' } },
    ],
  },
  {
    grupo: 'Empresa',
    nota: 'En toda la empresa',
    secciones: [
      { k: 'proyectos', nombre: 'Proyectos', info: 'La lista de proyectos y crear uno nuevo.',
        nota: 'Ver: los suyos. Editar: en «Datos del proyecto».',
        celdas: { ver: 'todos', crear: { llave: 'proyectos_crear' }, borrar: 'dueno' } },
      { k: 'clientes', nombre: 'Clientes', info: 'Las entidades y empresas para las que se trabaja.',
        celdas: {
          ver: { llave: 'clientes_ver' }, crear: { llave: 'clientes_agregar' },
          editar: { llave: 'clientes_editar' }, borrar: { llave: 'clientes_eliminar' },
        } },
      { k: 'equipos', nombre: 'Equipos', info: 'La flota de equipos y maquinaria de la empresa.',
        celdas: {
          ver: { llave: 'equipos_ver' }, crear: { llave: 'equipos_agregar' },
          editar: { llave: 'equipos_editar' }, borrar: { llave: 'equipos_eliminar' },
        },
        extras: [
          { llave: 'equipos_asignacion', nombre: 'Asignar a proyectos' },
          { llave: 'equipos_editar_asignacion', nombre: 'Editar asignaciones' },
          { llave: 'equipos_uso', nombre: 'Registrar horas de uso' },
        ] },
      { k: 'contactos', nombre: 'Contactos externos', info: 'Personas de afuera que aparecen en el sistema sin entrar a él.',
        celdas: { ver: 'todosSistema', crear: 'todosSistema', editar: 'todosSistema', borrar: 'todosSistema' } },
      { k: 'cartas', nombre: 'Cartas legales',
        info: 'Los documentos de licitación: acuerdo de consorcio, pacto de integridad y otros.',
        junto: { llave: 'documentos_acceso', desde: 0, hasta: 1, texto: 'Ver y generar' } },
      { k: 'personas', nombre: 'Personas y perfiles', info: 'Esta pantalla: quién entra al sistema y qué puede hacer.',
        celdas: { ver: 'gerencia', crear: 'gerencia', editar: 'gerencia', borrar: 'gerencia' } },
    ],
  },
];

/** Las llaves que tienen casilla, en el orden de la tabla. */
export const LLAVES_DE_PERFIL: Llave[] = CATALOGO.flatMap((g) =>
  g.secciones.flatMap((s) => [
    ...(s.junto ? [s.junto.llave] : []),
    ...COLUMNAS.flatMap((c) => {
      const v = s.celdas?.[c.k];
      return v && typeof v === 'object' ? [v.llave] : [];
    }),
    ...(s.extras ?? []).map((e) => e.llave),
  ]),
);

export type Permisos = Partial<Record<Llave, boolean>>;
