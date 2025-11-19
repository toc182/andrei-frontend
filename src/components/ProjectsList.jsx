import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectFormNew from './forms/ProjectFormNew';
import AdendaForm from './forms/AdendaForm';
import api from '../services/api';
import { formatDate } from '../utils/dateUtils';
import { Pencil, Trash2, Plus } from 'lucide-react';
// Shadcn Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const ProjectsList = ({ onStatsUpdate }) => {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pagination, setPagination] = useState({});
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [viewingProject, setViewingProject] = useState(null);
    const [projectAdendas, setProjectAdendas] = useState([]);
    const [showAdendaForm, setShowAdendaForm] = useState(false);
    const [editingAdenda, setEditingAdenda] = useState(null);

    // Cargar proyectos
    const loadProjects = async () => {
        try {
            setLoading(true);
            const response = await api.get('/projects');

            if (response.data.success) {
                setProjects(response.data.proyectos);
                setPagination(response.data.pagination);
                setError('');
            } else {
                setError('Error cargando proyectos');
            }
        } catch (error) {
            console.error('Error:', error);
            setError('Error de conexión al cargar proyectos');
        } finally {
            setLoading(false);
        }
    };

    // Cargar proyectos al montar
    useEffect(() => {
        loadProjects();
    }, []);

    // Manejar guardado de proyecto
    const handleProjectSave = (savedProject) => {
        // Recargar la lista
        loadProjects();
        // Actualizar estadísticas del dashboard
        if (onStatsUpdate) {
            onStatsUpdate();
        }
        setShowCreateForm(false);
        setEditingProject(null);
    };

    // Manejar visualización de detalles del proyecto
    const handleViewProject = async (projectId) => {
        try {
            setLoading(true);
            const [projectResponse, adendasResponse] = await Promise.all([
                api.get(`/projects/${projectId}`),
                api.get(`/adendas/project/${projectId}`)
            ]);

            if (projectResponse.data.success) {
                setViewingProject(projectResponse.data.proyecto);
            } else {
                setError('Error al cargar los detalles del proyecto');
            }

            if (adendasResponse.data.success) {
                setProjectAdendas(adendasResponse.data.adendas);
            } else {
                setProjectAdendas([]);
            }
        } catch (error) {
            console.error('Error cargando proyecto:', error);
            setError('Error de conexión al cargar el proyecto');
            setProjectAdendas([]);
        } finally {
            setLoading(false);
        }
    };

    // Manejar edición
    const handleEditProject = (project) => {
        setEditingProject(project);
    };

    // Manejar eliminación
    const handleDeleteProject = async (projectId) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar este proyecto? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const response = await api.delete(`/projects/${projectId}`);

            if (response.data.success) {
                // Recargar la lista
                loadProjects();
                // Actualizar estadísticas
                if (onStatsUpdate) {
                    onStatsUpdate();
                }
                setProjectToDelete(null);
            } else {
                setError('Error al eliminar el proyecto');
            }
        } catch (error) {
            console.error('Error eliminando proyecto:', error);
            setError('Error de conexión al eliminar el proyecto');
        }
    };


    // Formatear monto
    const formatMoney = (amount) => {
        if (!amount) return '-';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PAB',
            currencyDisplay: 'symbol',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount).replace('PAB', 'B/.');
    };

    // Obtener variante de badge para estado (Shadcn)
    const getStatusBadgeVariant = (estado) => {
        const variants = {
            'planificacion': 'secondary',     // Amarillo/gris
            'en_curso': 'default',            // Verde (primary)
            'pausado': 'outline',             // Azul outline
            'completado': 'secondary',        // Gris
            'cancelado': 'destructive'        // Rojo
        };
        return variants[estado] || 'secondary';
    };

    // Obtener texto del estado
    const getStatusText = (estado) => {
        const statusTexts = {
            'planificacion': 'Planificación',
            'en_curso': 'En Curso',
            'pausado': 'Pausado',
            'completado': 'Completado',
            'cancelado': 'Cancelado'
        };
        return statusTexts[estado] || estado;
    };

    // Funciones para adendas
    const getAdendaStatusBadgeVariant = (estado) => {
        const variants = {
            'en_proceso': 'secondary',
            'aprobada': 'default',
            'rechazada': 'destructive'
        };
        return variants[estado] || 'secondary';
    };

    const getAdendaStatusText = (estado) => {
        const statusTexts = {
            'en_proceso': 'En Proceso',
            'aprobada': 'Aprobada',
            'rechazada': 'Rechazada'
        };
        return statusTexts[estado] || estado;
    };

    const getAdendaTypeText = (tipo) => {
        const typeTexts = {
            'tiempo': 'Extensión de Tiempo',
            'costo': 'Modificación de Costo',
            'mixta': 'Tiempo y Costo'
        };
        return typeTexts[tipo] || tipo;
    };

    // Manejar adendas
    const handleAdendaSave = async (adendaData) => {
        try {
            setLoading(true);
            let response;
            
            if (editingAdenda) {
                response = await api.put(`/adendas/${editingAdenda.id}`, adendaData);
            } else {
                response = await api.post('/adendas', adendaData);
            }
            
            if (response.data.success) {
                // Recargar adendas del proyecto
                const adendasResponse = await api.get(`/adendas/project/${viewingProject.id}`);
                if (adendasResponse.data.success) {
                    setProjectAdendas(adendasResponse.data.adendas);
                }
                setShowAdendaForm(false);
                setEditingAdenda(null);
            }
        } catch (error) {
            console.error('Error guardando adenda:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAdenda = async (adendaId) => {
        if (!confirm('¿Estás seguro de eliminar esta adenda?')) return;
        
        try {
            setLoading(true);
            await api.delete(`/adendas/${adendaId}`);
            
            // Recargar adendas del proyecto
            if (viewingProject) {
                const adendasResponse = await api.get(`/adendas/project/${viewingProject.id}`);
                if (adendasResponse.data.success) {
                    setProjectAdendas(adendasResponse.data.adendas);
                }
            }
            
        } catch (error) {
            console.error('Error eliminando adenda:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && projects.length === 0) {
        return (
            <div className="section-container">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Cargando proyectos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Botón de acción */}
            {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                <div className="flex justify-end">
                    <Button onClick={() => setShowCreateForm(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Proyecto
                    </Button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                    <div className="flex items-center justify-between">
                        <span>{error}</span>
                        <Button variant="outline" size="sm" onClick={loadProjects}>
                            Reintentar
                        </Button>
                    </div>
                </div>
            )}




            {/* Modal para crear proyecto */}
            <ProjectFormNew
                isOpen={showCreateForm}
                onClose={() => setShowCreateForm(false)}
                onSave={handleProjectSave}
            />

            {/* Modal para editar proyecto */}
            <ProjectFormNew
                projectId={editingProject?.id}
                isOpen={!!editingProject}
                onClose={() => setEditingProject(null)}
                onSave={handleProjectSave}
                onDelete={handleDeleteProject}
            />


            {/* Modal para ver detalles del proyecto - Shadcn Dialog */}
            <Dialog open={!!viewingProject} onOpenChange={() => setViewingProject(null)}>
                <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{viewingProject?.nombre_corto || "Detalles del Proyecto"}</DialogTitle>
                    </DialogHeader>

                    {viewingProject && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Proyecto:</label>
                                <span className="text-sm">{viewingProject.nombre}</span>
                            </div>

                        {viewingProject.codigo_proyecto && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Código:</label>
                                <span className="text-sm">{viewingProject.codigo_proyecto}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                            <label className="font-medium text-sm text-muted-foreground">Estado:</label>
                            <div>
                                <Badge variant={getStatusBadgeVariant(viewingProject.estado)}>
                                    {getStatusText(viewingProject.estado)}
                                </Badge>
                            </div>
                        </div>

                        {viewingProject.cliente_nombre && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Cliente:</label>
                                <span className="text-sm">{viewingProject.cliente_nombre}</span>
                            </div>
                        )}

                        {viewingProject.cliente_abreviatura && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Abreviatura:</label>
                                <span className="text-sm">{viewingProject.cliente_abreviatura}</span>
                            </div>
                        )}

                        {viewingProject.cliente_contacto && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Contacto:</label>
                                <span className="text-sm">{viewingProject.cliente_contacto}</span>
                            </div>
                        )}

                        {viewingProject.cliente_telefono && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Teléfono:</label>
                                <span className="text-sm">{viewingProject.cliente_telefono}</span>
                            </div>
                        )}

                        {viewingProject.cliente_email && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Email:</label>
                                <span className="text-sm">{viewingProject.cliente_email}</span>
                            </div>
                        )}

                        {viewingProject.contratista && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Contratista:</label>
                                <span className="text-sm">{viewingProject.contratista}</span>
                            </div>
                        )}

                        {viewingProject.ingeniero_residente && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Ingeniero Residente:</label>
                                <span className="text-sm">{viewingProject.ingeniero_residente}</span>
                            </div>
                        )}

                        {/* Fecha de Inicio */}
                        {viewingProject.fecha_inicio && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Fecha de Inicio:</label>
                                <span className="text-sm">{formatDate(viewingProject.fecha_inicio)}</span>
                            </div>
                        )}

                        {/* Fecha de Terminación */}
                        {viewingProject.fecha_fin_estimada && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Fecha de Terminación:</label>
                                <span className="text-sm">{formatDate(viewingProject.fecha_fin_estimada)}</span>
                            </div>
                        )}

                        {/* Presupuesto Base */}
                        {viewingProject.presupuesto_base && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Presupuesto Base:</label>
                                <span className="text-sm">{formatMoney(viewingProject.presupuesto_base)}</span>
                            </div>
                        )}

                        {/* ITBMS */}
                        {viewingProject.itbms && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">ITBMS (7%):</label>
                                <span className="text-sm">{formatMoney(viewingProject.itbms)}</span>
                            </div>
                        )}

                        {/* Monto Total */}
                        {viewingProject.monto_total && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Monto Total:</label>
                                <span className="text-sm">{formatMoney(viewingProject.monto_total)}</span>
                            </div>
                        )}

                        {/* Monto del Contrato (alternativo) */}
                        {!viewingProject.monto_total && viewingProject.monto_contrato_original && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Monto del Contrato:</label>
                                <span className="text-sm">{formatMoney(viewingProject.monto_contrato_original)}</span>
                            </div>
                        )}

                        {/* Número de Contrato */}
                        {viewingProject.contrato && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Número de Contrato:</label>
                                <span className="text-sm">{viewingProject.contrato}</span>
                            </div>
                        )}

                        {/* Acto Público */}
                        {viewingProject.acto_publico && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Acto Público:</label>
                                <span className="text-sm">{viewingProject.acto_publico}</span>
                            </div>
                        )}

                        {/* Observaciones */}
                        {viewingProject.datos_adicionales?.observaciones && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <label className="font-medium text-sm text-muted-foreground">Observaciones:</label>
                                <span className="text-sm">{viewingProject.datos_adicionales.observaciones}</span>
                            </div>
                        )}

                        {/* Adendas */}
                        {projectAdendas.length > 0 && (
                            <div className="space-y-6 mt-6 pt-6 border-t">
                                <h3 className="font-semibold text-base">Adendas del Proyecto</h3>
                                {projectAdendas.map(adenda => (
                                    <div key={adenda.id} className="space-y-3 p-4 bg-muted/50 rounded-lg">
                                        <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                            <label className="font-medium text-sm text-muted-foreground">Adenda #{adenda.numero_adenda}:</label>
                                            <div className="flex items-center gap-3">
                                                <Badge variant={getAdendaStatusBadgeVariant(adenda.estado)}>
                                                    {getAdendaStatusText(adenda.estado)}
                                                </Badge>
                                                {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingAdenda(adenda);
                                                                setShowAdendaForm(true);
                                                            }}
                                                            className="inline-flex items-center justify-center p-0 border-0 bg-transparent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                            title="Editar adenda"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAdenda(adenda.id)}
                                                            className="inline-flex items-center justify-center p-0 border-0 bg-transparent text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                                            title="Eliminar adenda"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                            <label className="font-medium text-sm text-muted-foreground">Tipo:</label>
                                            <span className="text-sm">{getAdendaTypeText(adenda.tipo)}</span>
                                        </div>

                                        {adenda.nueva_fecha_fin && (
                                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                                <label className="font-medium text-sm text-muted-foreground">Nueva Fecha de Terminación:</label>
                                                <span className="text-sm">
                                                    {formatDate(adenda.nueva_fecha_fin)}
                                                    {adenda.dias_extension && (
                                                        <span className="text-muted-foreground"> (+{adenda.dias_extension} días)</span>
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        {adenda.nuevo_monto && (
                                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                                <label className="font-medium text-sm text-muted-foreground">Nuevo Monto:</label>
                                                <span className="text-sm">{formatMoney(adenda.nuevo_monto)}</span>
                                            </div>
                                        )}

                                        {adenda.monto_adicional && (
                                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                                <label className="font-medium text-sm text-muted-foreground">Monto Adicional:</label>
                                                <span className="text-sm">{formatMoney(adenda.monto_adicional)}</span>
                                            </div>
                                        )}

                                        {adenda.observaciones && (
                                            <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                                <label className="font-medium text-sm text-muted-foreground">Observaciones:</label>
                                                <span className="text-sm">{adenda.observaciones}</span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                            <label className="font-medium text-sm text-muted-foreground">Solicitada:</label>
                                            <span className="text-sm">
                                                {formatDate(adenda.fecha_solicitud)}
                                                {adenda.fecha_aprobacion && (
                                                    <span className="text-muted-foreground"> | Aprobada: {formatDate(adenda.fecha_aprobacion)}</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer con botón de agregar adenda */}
                {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                    <DialogFooter>
                        <Button onClick={() => setShowAdendaForm(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar Adenda
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>

            {/* Modal para crear/editar adenda */}
            <AdendaForm
                projectId={viewingProject?.id}
                isOpen={showAdendaForm}
                onClose={() => {
                    setShowAdendaForm(false);
                    setEditingAdenda(null);
                }}
                onSave={handleAdendaSave}
                editingAdenda={editingAdenda}
            />

            {/* ===== TABLA DE PROYECTOS (Shadcn Table) ===== */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Proyecto</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                                <TableHead className="w-[50px]"></TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projects.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No hay proyectos disponibles
                                </TableCell>
                            </TableRow>
                        ) : (
                            projects.map((project) => (
                                <TableRow
                                    key={project.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleViewProject(project.id)}
                                >
                                    <TableCell className="font-medium">{project.nombre_corto}</TableCell>
                                    <TableCell>{project.cliente_abreviatura}</TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusBadgeVariant(project.estado)}>
                                            {getStatusText(project.estado)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatMoney(project.monto_total || project.monto_contrato_original || 0)}
                                    </TableCell>
                                    {(user?.rol === 'admin' || user?.rol === 'project_manager') && (
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditProject(project);
                                                }}
                                                title="Editar proyecto"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default ProjectsList;