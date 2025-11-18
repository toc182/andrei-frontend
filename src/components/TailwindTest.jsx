/**
 * Componente temporal para probar que Tailwind y Shadcn funcionan correctamente
 * ELIMINAR después de confirmar que todo funciona
 */

import { Button } from "@/components/ui/button"

export function TailwindTest() {
  return (
    <div className="p-8 bg-gray-100 rounded-lg shadow-lg max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">
        ✅ Tailwind CSS + Shadcn/ui Funcionando!
      </h1>

      <p className="text-gray-700 mb-4">
        Si ves este texto con estilos, Tailwind está instalado correctamente.
      </p>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Botones Tailwind (viejos):</h2>
        <div className="flex gap-4">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Botón Tailwind
          </button>

          <button className="bg-pinellas-primary hover:bg-pinellas-dark text-white font-bold py-2 px-4 rounded">
            Color Pinellas Custom
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Botones Shadcn (nuevos):</h2>
        <div className="flex flex-wrap gap-4">
          <Button>Default Button</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </div>

      <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400">
        <p className="text-sm text-yellow-700">
          <strong>¡Éxito!</strong> Si ves los botones de Shadcn con estilos profesionales,
          la Fase 2 está completa. Los botones tienen hover effects, diferentes variantes y tamaños.
        </p>
      </div>
    </div>
  );
}
