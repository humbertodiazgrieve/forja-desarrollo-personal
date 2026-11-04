# Fitness OS dentro de Forja

## Importar los datos de Fitness OS

1. En la versión original de Fitness OS, pulsa **Exportar datos** y guarda el JSON en una ubicación privada.
2. Abre **Performance** en Forja y pulsa **Importar**.
3. Selecciona el JSON exportado. Las cuatro vistas de Fitness OS conservan su navegación, gráficos, tablas y controles de edición.
4. Comprueba los datos importados y crea un respaldo de Forja desde Ajustes. El estado de Performance queda dentro del JSON de Forja.

Fitness OS puede exportar las fotos por separado con **Respaldar galería**. En Performance usa **Restaurar galería** para importar ese archivo. Las fotos se guardan en IndexedDB en el navegador y no viajan dentro de los respaldos de Forja ni se sincronizan con la cuenta.

## Compatibilidad y almacenamiento

- El esquema de estado de Forja añade `performanceData` como campo opcional. Los respaldos anteriores siguen siendo válidos; al restaurarlos, Performance empieza vacío.
- Fitness OS mantiene su formato `schemaVersion: 1`. Los cambios se guardan en el mismo estado local de Forja que metas, misiones y diario.
- Un archivo Fitness OS inválido se rechaza antes de guardarse. Las fechas se validan como fechas reales y los números desconocidos deben ser `null` o permanecer ausentes según el formato original.
- La galería usa la base local `forja-performance-visual` para evitar leer fotos de otros sitios que usaban Fitness OS.

## Migración sin datos incluidos

El paquete de Forja contiene la aplicación, no los datos personales que estaban escritos en la versión original de Fitness OS. Para migrar un perfil, exporta su JSON desde esa aplicación y luego impórtalo en Forja. No se cargan mediciones, actividad, macros ni fotos de ejemplo. Los campos desconocidos aparecen como guion y no se interpretan como cero.

El JSON de datos Fitness OS no incluye la galería. Si aún tienes una galería del sitio original, crea allí un respaldo de galería y restaura ese archivo por separado. Forja no cambia ni publica el sitio original.

## Límites actuales

- Performance no modifica XP, metas, misiones ni el diario de Forja.
- La sincronización de Forja puede guardar el JSON de indicadores, pero la galería de fotos permanece local al navegador.
- Los gráficos y cálculos conservan las etiquetas reportadas o estimadas de Fitness OS. Un cálculo no convierte una estimación en una medición clínica.
