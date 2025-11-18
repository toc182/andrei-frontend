/**
 * EJEMPLO DE MODAL CON FORMULARIO - Shadcn + React Hook Form + Zod
 *
 * Este componente demuestra:
 * - Dialog (modal) de Shadcn
 * - Formulario con validación usando React Hook Form + Zod
 * - Inputs estilizados
 * - Manejo de errores
 * - Loading states
 * - Cierre con Escape y overlay click
 *
 * USO:
 * import { EjemploClienteModal } from "@/components/ejemplos/EjemploClienteModal"
 *
 * <EjemploClienteModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSubmit={(data) => console.log(data)}
 * />
 */

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Schema de validación con Zod
const clienteSchema = z.object({
  nombre: z.string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  email: z.string()
    .email("Email inválido")
    .min(1, "El email es requerido"),
  telefono: z.string()
    .min(10, "El teléfono debe tener al menos 10 dígitos")
    .max(15, "El teléfono no puede exceder 15 dígitos")
    .regex(/^[0-9+\-\s()]+$/, "El teléfono solo puede contener números y símbolos +()-")
    .optional()
    .or(z.literal("")),
  empresa: z.string()
    .min(2, "La empresa debe tener al menos 2 caracteres")
    .optional()
    .or(z.literal("")),
})

export function EjemploClienteModal({ isOpen, onClose, onSubmit, initialData = null }) {
  const [isLoading, setIsLoading] = useState(false)

  // Configurar React Hook Form con Zod
  const form = useForm({
    resolver: zodResolver(clienteSchema),
    defaultValues: initialData || {
      nombre: "",
      email: "",
      telefono: "",
      empresa: "",
    },
  })

  // Handler para submit
  const handleSubmit = async (data) => {
    setIsLoading(true)
    try {
      // Simular llamada API
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Llamar callback del padre
      await onSubmit(data)

      // Resetear form y cerrar
      form.reset()
      onClose()
    } catch (error) {
      console.error("Error al guardar cliente:", error)
      // Aquí podrías mostrar un toast o alert con el error
    } finally {
      setIsLoading(false)
    }
  }

  // Handler para cancelar
  const handleCancel = () => {
    form.reset()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar Cliente" : "Nuevo Cliente"}
          </DialogTitle>
          <DialogDescription>
            Complete los datos del cliente. Los campos marcados con * son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Nombre */}
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Juan Pérez"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="ejemplo@email.com"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Teléfono */}
            <FormField
              control={form.control}
              name="telefono"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+1 (555) 123-4567"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Opcional - Formato: números, +, -, (), espacios
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Empresa */}
            <FormField
              control={form.control}
              name="empresa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Pinellas S.A."
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : initialData ? "Actualizar" : "Crear Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
