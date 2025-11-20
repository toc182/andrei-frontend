/**
 * SystemTester - Testing Suite Profesional
 *
 * RUTA OCULTA: /sistema-debug
 * ACCESO: Solo administradores
 *
 * Niveles de prueba:
 * 1. Health checks básicos
 * 2. CRUD completo con datos de prueba
 * 3. Validaciones y casos de error
 * 4. Relaciones entre módulos
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle, Loader2, Play, AlertCircle, Shield, Lock, Trash2 } from 'lucide-react'
import api from '../services/api'

export default function SystemTester() {
  const { user } = useAuth()
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState([])
  const [currentTest, setCurrentTest] = useState('')
  const [createdIds, setCreatedIds] = useState({}) // Para limpiar después

  // Verificar si es admin
  const isAdmin = user?.rol === 'admin' || user?.rol === 'gerente'

  // Suite de pruebas completa - Nivel Profesional
  const professionalTests = [
    // ========== NIVEL 1: HEALTH CHECKS ==========
    {
      level: 1,
      name: '🏥 Backend Health Check',
      description: 'Verifica que el servidor responde',
      test: async () => {
        const response = await api.get('/health')
        return { success: true, data: response.data }
      }
    },
    {
      level: 1,
      name: '🔐 Autenticación - Verificar Token',
      description: 'Valida token actual',
      test: async () => {
        const response = await api.get('/auth/verify')
        return { success: true, data: response.data }
      }
    },

    // ========== NIVEL 2: PROYECTOS - CRUD COMPLETO ==========
    {
      level: 2,
      name: '📊 Proyectos - Listar',
      description: 'GET /projects',
      test: async () => {
        const response = await api.get('/projects')
        return {
          success: response.data.success,
          count: response.data.proyectos?.length || 0,
          data: response.data
        }
      }
    },
    {
      level: 2,
      name: '➕ Proyectos - Crear TEST',
      description: 'POST /projects con datos de prueba',
      test: async (context) => {
        const testData = {
          nombre: `TEST-Proyecto-${Date.now()}`,
          nombre_corto: 'TEST',
          codigo_proyecto: `TEST-${Date.now()}`,
          cliente_id: 1, // Asume que cliente 1 existe
          estado: 'planificacion',
          fecha_inicio: new Date().toISOString().split('T')[0],
          contratista: 'TEST Contratista',
          monto_contrato_original: 10000
        }

        const response = await api.post('/projects', testData)
        if (response.data.success) {
          context.testProjectId = response.data.proyecto?.id
        }
        return {
          success: response.data.success,
          projectId: response.data.proyecto?.id,
          data: response.data
        }
      }
    },
    {
      level: 2,
      name: '🔍 Proyectos - Leer TEST creado',
      description: 'GET /projects/:id',
      test: async (context) => {
        if (!context.testProjectId) throw new Error('No hay proyecto de prueba')
        const response = await api.get(`/projects/${context.testProjectId}`)
        return {
          success: response.data.success,
          data: response.data
        }
      }
    },
    {
      level: 2,
      name: '✏️ Proyectos - Actualizar TEST',
      description: 'PUT /projects/:id',
      test: async (context) => {
        if (!context.testProjectId) throw new Error('No hay proyecto de prueba')
        try {
          const updateData = {
            estado: 'en_curso'
          }
          const response = await api.put(`/projects/${context.testProjectId}`, updateData)
          return {
            success: response.data.success,
            data: response.data
          }
        } catch (error) {
          const errorData = error.response?.data || {}
          return {
            success: false,
            message: `Error: ${errorData.message || error.message}`,
            errorDetails: errorData.error,
            fullDetails: errorData.details
          }
        }
      }
    },

    // ========== NIVEL 2: CLIENTES - CRUD ==========
    {
      level: 2,
      name: '👥 Clientes - Listar',
      description: 'GET /clientes',
      test: async () => {
        const response = await api.get('/clientes')
        return {
          success: response.data.success,
          count: response.data.data?.length || 0,
          data: response.data
        }
      }
    },
    {
      level: 2,
      name: '➕ Clientes - Crear TEST',
      description: 'POST /clientes',
      test: async (context) => {
        const testData = {
          nombre: `TEST Cliente ${Date.now()}`,
          abreviatura: 'TEST',
          email: `test${Date.now()}@test.com`,
          telefono: '555-1234',
          direccion: 'Dirección de prueba'
        }
        const response = await api.post('/clientes', testData)
        // FIX: El backend devuelve { success, cliente, message }, no { success, data }
        if (response.data.success && response.data.cliente) {
          context.testClienteId = response.data.cliente.id
        }
        return {
          success: response.data.success,
          clienteId: response.data.cliente?.id,
          data: response.data
        }
      }
    },

    // ========== NIVEL 2: EQUIPOS - CRUD ==========
    {
      level: 2,
      name: '🚛 Equipos - Listar',
      description: 'GET /equipos',
      test: async () => {
        const response = await api.get('/equipos')
        return {
          success: response.data.success,
          count: response.data.data?.length || 0,
          data: response.data
        }
      }
    },
    {
      level: 2,
      name: '🚛 Equipos - Status',
      description: 'GET /equipos/status',
      test: async () => {
        const response = await api.get('/equipos/status')
        return {
          success: response.data.success,
          count: response.data.data?.length || 0,
          data: response.data
        }
      }
    },
    {
      level: 2,
      name: '➕ Equipos - Crear TEST',
      description: 'POST /equipos',
      test: async (context) => {
        const testData = {
          codigo: `TEST-${Date.now()}`,
          descripcion: 'Equipo de prueba',
          marca: 'TEST',
          modelo: 'TEST-MODEL',
          ano: new Date().getFullYear(),
          owner: 'Pinellas',
          estado: 'operativo'
        }
        const response = await api.post('/equipos', testData)
        if (response.data.success) {
          context.testEquipoId = response.data.data?.id
        }
        return {
          success: response.data.success,
          equipoId: response.data.data?.id,
          data: response.data
        }
      }
    },

    // ========== NIVEL 2: ASIGNACIONES ==========
    {
      level: 2,
      name: '📋 Asignaciones - Listar',
      description: 'GET /asignaciones',
      test: async () => {
        const response = await api.get('/asignaciones')
        return {
          success: response.data.success,
          count: response.data.data?.length || 0,
          data: response.data
        }
      }
    },

    // ========== NIVEL 3: VALIDACIONES ==========
    {
      level: 3,
      name: '❌ Validación - Proyecto sin nombre',
      description: 'Debe fallar con 400',
      expectError: true,
      test: async () => {
        try {
          await api.post('/projects', { cliente_id: 1 })
          return { success: false, message: 'Debió fallar pero no lo hizo' }
        } catch (error) {
          if (error.response?.status === 400) {
            return { success: true, message: 'Validación correcta - Error 400' }
          }
          throw error
        }
      }
    },
    {
      level: 3,
      name: '❌ Validación - Cliente email duplicado',
      description: 'Debe prevenir emails duplicados',
      expectError: true,
      test: async () => {
        const email = `duplicate${Date.now()}@test.com`
        // Crear primero
        await api.post('/clientes', {
          nombre: 'Test 1',
          email: email
        })
        // Intentar duplicar
        try {
          await api.post('/clientes', {
            nombre: 'Test 2',
            email: email
          })
          return { success: false, message: 'Permitió email duplicado' }
        } catch (error) {
          return { success: true, message: 'Validación correcta - Rechazó duplicado' }
        }
      }
    },

    // ========== NIVEL 4: ADMIN & LIMPIEZA ==========
    {
      level: 4,
      name: '🔍 DIAGNÓSTICO - Verificar columna activo',
      description: 'GET /admin/check-activo-column',
      test: async () => {
        try {
          const response = await api.get('/admin/check-activo-column')
          return {
            success: true,
            message: `${response.data.message} (exists: ${response.data.exists})`,
            exists: response.data.exists
          }
        } catch (error) {
          return {
            success: false,
            message: `Error: ${error.response?.data?.message || error.message}`
          }
        }
      }
    },
    {
      level: 4,
      name: '⚙️ ADMIN - Forzar Migración 022',
      description: 'POST /admin/force-migration-022 (Agregar columna activo a clientes)',
      test: async () => {
        try {
          const response = await api.post('/admin/force-migration-022')
          return {
            success: response.data.success,
            message: response.data.message
          }
        } catch (error) {
          return {
            success: false,
            message: `Error: ${error.response?.data?.message || error.message}`
          }
        }
      }
    },
    {
      level: 4,
      name: '🧹 LIMPIEZA - Eliminar Proyecto TEST',
      description: 'DELETE /projects/:id',
      cleanup: true,
      test: async (context) => {
        if (!context.testProjectId) {
          return { success: true, message: 'No hay proyecto que limpiar' }
        }
        const response = await api.delete(`/projects/${context.testProjectId}`)
        return {
          success: response.data.success,
          message: 'Proyecto de prueba eliminado'
        }
      }
    },
    {
      level: 4,
      name: '🧹 LIMPIEZA - Eliminar Cliente TEST',
      description: 'DELETE /clientes/:id',
      cleanup: true,
      test: async (context) => {
        if (!context.testClienteId) {
          return { success: true, message: 'No hay cliente que limpiar' }
        }
        try {
          const response = await api.delete(`/clientes/${context.testClienteId}`)
          return {
            success: response.data.success,
            message: 'Cliente de prueba eliminado'
          }
        } catch (error) {
          // Capturar error y mostrarlo claramente con TODOS los detalles
          const errorData = error.response?.data || {}
          return {
            success: false,
            message: `Error: ${errorData.message || error.message}`,
            errorDetails: errorData.error,
            fullDetails: errorData.details
          }
        }
      }
    },
    {
      level: 4,
      name: '🧹 LIMPIEZA - Eliminar Equipo TEST',
      description: 'DELETE /equipos/:id',
      cleanup: true,
      test: async (context) => {
        if (!context.testEquipoId) {
          return { success: true, message: 'No hay equipo que limpiar' }
        }
        const response = await api.delete(`/equipos/${context.testEquipoId}`)
        return {
          success: response.data.success,
          message: 'Equipo de prueba eliminado'
        }
      }
    }
  ]

  const runAllTests = async () => {
    setTesting(true)
    setResults([])
    setCurrentTest('')

    const testResults = []
    const context = {} // Contexto compartido entre tests

    for (const testConfig of professionalTests) {
      setCurrentTest(testConfig.name)

      const startTime = Date.now()
      let result

      try {
        const testResult = await testConfig.test(context)
        const duration = Date.now() - startTime

        result = {
          level: testConfig.level,
          name: testConfig.name,
          description: testConfig.description,
          status: testResult.success ? 'success' : 'error',
          message: testResult.message || `✓ Completado en ${duration}ms`,
          duration,
          details: testResult,
          cleanup: testConfig.cleanup
        }
      } catch (error) {
        const duration = Date.now() - startTime
        result = {
          level: testConfig.level,
          name: testConfig.name,
          description: testConfig.description,
          status: testConfig.expectError ? 'warning' : 'error',
          message: error.response?.data?.message || error.message,
          errorCode: error.response?.status,
          duration,
          details: error.response?.data
        }
      }

      testResults.push(result)
      setResults([...testResults])

      // Pausa entre tests
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    setTesting(false)
    setCurrentTest('')
  }

  const getStatusIcon = (status) => {
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-600" />
    if (status === 'error') return <XCircle className="h-4 w-4 text-red-600" />
    if (status === 'warning') return <AlertCircle className="h-4 w-4 text-yellow-600" />
    return <AlertCircle className="h-4 w-4 text-blue-600" />
  }

  const getStatusBadge = (status) => {
    if (status === 'success') return <Badge className="bg-green-600">Éxito</Badge>
    if (status === 'error') return <Badge variant="destructive">Error</Badge>
    if (status === 'warning') return <Badge className="bg-yellow-600">Advertencia</Badge>
    return <Badge variant="secondary">Info</Badge>
  }

  const getLevelBadge = (level) => {
    const levels = {
      1: { label: 'Health', className: 'bg-blue-600' },
      2: { label: 'CRUD', className: 'bg-purple-600' },
      3: { label: 'Validación', className: 'bg-orange-600' },
      4: { label: 'Limpieza', className: 'bg-gray-600' }
    }
    const l = levels[level] || levels[1]
    return <Badge className={l.className}>{l.label}</Badge>
  }

  const successCount = results.filter(r => r.status === 'success').length
  const errorCount = results.filter(r => r.status === 'error').length
  const warningCount = results.filter(r => r.status === 'warning').length
  const totalTests = professionalTests.length

  // Control de acceso
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-destructive/10">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <Lock className="h-6 w-6" />
              <CardTitle>Acceso Denegado</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                Esta página solo está disponible para administradores.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 bg-muted/20">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle className="text-2xl">Testing Suite Profesional</CardTitle>
                  <CardDescription>Sistema de pruebas automatizadas - Acceso Admin</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2">
                {user?.nombre}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este sistema ejecutará pruebas CRUD completas. Los datos de prueba se crearán y eliminarán automáticamente.
              </AlertDescription>
            </Alert>

            <Button
              onClick={runAllTests}
              disabled={testing}
              size="lg"
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Ejecutando... {currentTest}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Ejecutar Suite Completa ({totalTests} pruebas)
                </>
              )}
            </Button>

            {results.length > 0 && (
              <div className="grid grid-cols-4 gap-4 p-4 bg-background rounded-lg border">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{successCount}</div>
                  <div className="text-xs text-muted-foreground">Exitosos</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{errorCount}</div>
                  <div className="text-xs text-muted-foreground">Errores</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">{warningCount}</div>
                  <div className="text-xs text-muted-foreground">Advertencias</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{totalTests - results.length}</div>
                  <div className="text-xs text-muted-foreground">Pendientes</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resultados */}
        <div className="space-y-3">
          {results.map((result, index) => (
            <Card key={index} className={result.cleanup ? 'border-gray-400' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-sm">{result.name}</CardTitle>
                        {getLevelBadge(result.level)}
                        {result.cleanup && (
                          <Badge variant="outline" className="gap-1">
                            <Trash2 className="h-3 w-3" />
                            Limpieza
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{result.description}</p>
                    </div>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{result.message}</p>

                {result.status === 'success' && result.details && (
                  <Alert>
                    <AlertDescription className="text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        {result.details.count !== undefined && (
                          <div>
                            <span className="font-semibold">Registros:</span> {result.details.count}
                          </div>
                        )}
                        {result.details.projectId && (
                          <div>
                            <span className="font-semibold">ID:</span> {result.details.projectId}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold">Tiempo:</span> {result.duration}ms
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {result.status === 'error' && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs space-y-1">
                      <div><span className="font-semibold">Código:</span> {result.errorCode || 'N/A'}</div>
                      {result.details && (
                        <div className="mt-2 p-2 bg-destructive/10 rounded max-h-32 overflow-auto">
                          <pre className="text-xs whitespace-pre-wrap">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Resumen Final */}
        {results.length > 0 && !testing && (
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Ejecución</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Por Nivel</div>
                  <div className="space-y-1 text-sm">
                    <div>Nivel 1 (Health): {results.filter(r => r.level === 1).length} pruebas</div>
                    <div>Nivel 2 (CRUD): {results.filter(r => r.level === 2).length} pruebas</div>
                    <div>Nivel 3 (Validación): {results.filter(r => r.level === 3).length} pruebas</div>
                    <div>Nivel 4 (Limpieza): {results.filter(r => r.level === 4).length} pruebas</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Tiempo Total</div>
                  <div className="text-2xl font-bold">
                    {(results.reduce((acc, r) => acc + (r.duration || 0), 0) / 1000).toFixed(2)}s
                  </div>
                </div>
              </div>

              {errorCount === 0 ? (
                <Alert className="border-green-600">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    ✓ Todas las pruebas pasaron exitosamente. El sistema está funcionando correctamente.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Se encontraron {errorCount} errores de {totalTests} pruebas.
                    Revisa los detalles arriba para más información.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
