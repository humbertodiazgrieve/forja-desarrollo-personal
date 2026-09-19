# Verificación de Forja 1.0.0

Entrega: 14 de septiembre de 2026. Windows x64.

## Comprobado

- Compilación TypeScript y frontend de producción completada.
- Compilación nativa Rust/Tauri y creación del instalador NSIS completadas.
- 20 pruebas de dominio superadas: fechas y períodos, programación, diario, recompensas, rachas, cambios futuros y validación de copias.
- 2 pruebas SQLite superadas: guardado y restauración con respaldo transaccional; rechazo de una restauración inválida sin reemplazar los datos.
- Interacción en la interfaz: completar diario con ambas reflexiones, registrar agua, actualizar XP, persistir al recargar y aprobar una modificación de planificación futura.
- Apertura de la aplicación nativa y comprobación de integridad SQLite: `ok`. Estado inicial con ocho hábitos, tres metas y siete widgets, sin clave de API en los datos.
- Revisión del paquete final: incluye `ForjaApp.exe` y `WebView2Loader.dll` en la carpeta de instalación. El cargador es necesario en esta compilación GNU de Windows.

## Alcance de las comprobaciones

La apertura nativa se comprobó en este equipo durante el desarrollo. El instalador final se generó y se revisó su contenido declarado; no se ejecutó su asistente en una máquina Windows limpia. No se realizaron llamadas reales a OpenAI porque no se proporcionó una clave. La integración requiere configurar una clave propia y un modelo compatible.

El instalador no tiene firma de un certificado comercial. Si falta WebView2, el instalador descarga su componente oficial; el uso cotidiano de las funciones locales no requiere internet.
