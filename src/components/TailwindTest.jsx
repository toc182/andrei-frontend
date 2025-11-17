/**
 * Componente temporal para probar que Tailwind funciona correctamente
 * ELIMINAR después de confirmar que todo funciona
 */

export function TailwindTest() {
  return (
    <div className="p-8 bg-gray-100 rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">
        ✅ Tailwind CSS Funcionando!
      </h1>

      <p className="text-gray-700 mb-4">
        Si ves este texto con estilos, Tailwind está instalado correctamente.
      </p>

      <div className="flex gap-4">
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Botón Tailwind
        </button>

        <button className="bg-pinellas-primary hover:bg-pinellas-dark text-white font-bold py-2 px-4 rounded">
          Color Pinellas Custom
        </button>
      </div>

      <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400">
        <p className="text-sm text-yellow-700">
          <strong>Responsive test:</strong> Redimensiona la ventana para ver efectos responsive.
        </p>
      </div>
    </div>
  );
}
