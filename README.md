# Forja — tu progreso, tu leyenda

Aplicación personal para Windows, en español. Construida con Tauri 2, React, TypeScript y SQLite. Guarda tus metas, hábitos, diario y planificación en tu PC.

## Empezar

1. Instala Forja con el archivo `Forja_1.0.0_x64-setup.exe` de la entrega. La instalación es para tu usuario de Windows.
2. Abre **Planificación**, elige la fecha inicial de tu trimestre y guarda. Ajusta los días de fuerza y cardio a tu semana.
3. En **Misiones de hoy**, registra cantidades, minutos o sesiones. Usa la fecha de la barra superior para consultar y corregir días anteriores.
4. Escribe **Qué hice bien** y **Qué hice mal** en **Mi diario**. El borrador se guarda automáticamente; pulsa **Completar entrada** para cumplir la misión.
5. Registra tus mediciones reales en **Mi progreso**. Las metas iniciales vencen el **30 de noviembre de 2026** y sus fechas son editables.
6. Los domingos abre **Revisión semanal**. Revisa resultados, anota aprendizajes, edita y aprueba propuestas y guarda la siguiente semana.

## Qué incluye

- Trimestres móviles de tres meses con selector de fecha; tres períodos mensuales con hitos físicos editables y totales de hábitos según la programación real.
- Peso: 88 → 83 kg. Grasa corporal: 23 → 15 kg. Grasa visceral según tu báscula: 10 → 7.
- Fuerza cuatro veces por semana, cardio tres, referencia de 1500 kcal, tres litros de agua, un scoop de proteína, lectura veinte minutos, meditación treinta minutos y diario.
- Registro de claridad mental, paciencia y estrés del 1 al 5. Es opcional y no concede ni resta puntos.
- Temporizadores de lectura y meditación: registran minutos al pausarlos o al alcanzar el objetivo. Si sales de la pantalla, el temporizador conserva su inicio y se actualiza al volver a la misión.
- Dashboard con widgets reordenables, ocultables y en dos tamaños; gráficos, calendario de constancia y frases personales fijadas o rotativas.
- Guerrero ilustrado, 10 XP por misión, un nivel cada 100 XP y evoluciones visuales en los niveles 5, 10, 15 y 20. No hay puntos extra por superar cantidades.
- Rachas por ocasiones programadas. Los descansos no las rompen y faltar no resta experiencia. Corregir un registro sí recalcula su recompensa.
- Versiones de programación con fechas de vigencia. Las revisiones se aplican a la semana siguiente; los cambios futuros se pueden deshacer.
- Sección financiera pendiente, sin afectar los indicadores de cumplimiento.

Las mediciones corporales se registran manualmente. Completar misiones no cambia esas mediciones. Las valoraciones mentales muestran lo que registras, sin inferir diagnósticos.

## Datos y copias

La instalación guarda la base `forja.sqlite` y el perfil de WebView2 en `%LOCALAPPDATA%\com.forja.personal`. La interfaz confirma el estado **Guardado local**. No hay cuentas ni sincronización.

Al abrir Forja por segunda vez se enfoca la ventana existente para evitar dos instancias escribiendo sobre el mismo historial.

En **Ajustes** puedes exportar una copia JSON completa. Al restaurarla se valida su formato y se conserva una copia del estado anterior en SQLite. **Recuperar copia anterior** permite volver a ese estado. Se conservan hasta 30 respaldos de restauraciones; no sustituyen una copia externa ante pérdida del disco.

Las copias contienen tus reflexiones personales. La clave de IA no se incluye. Los archivos de datos locales no tienen cifrado adicional propio de la app; se aplican las protecciones de tu usuario y disco de Windows.

Existe un modo portátil para pruebas y uso avanzado: la variable `FORJA_DATA_DIR`, si contiene una ruta absoluta, cambia la carpeta de base de datos y perfil WebView2. Sin esa variable se usa la ubicación estándar. No se almacena ninguna ruta personal dentro del instalador.

## IA opcional

En **Ajustes**, introduce tu propia clave de OpenAI y el identificador de un modelo disponible en tu cuenta que admita Responses API y salidas estructuradas.

- La clave se guarda en el almacén de credenciales de Windows; las peticiones salen desde Rust, no desde la interfaz web.
- Solo hay una petición cuando pulsas **Enviar y pedir sugerencias**. Antes puedes revisar el contenido exacto y seleccionar entradas del diario.
- Se usa `store: false`. Esto evita el historial recuperable de respuestas en la API; no equivale a ausencia total de retención por el proveedor.
- No se ejecutan propuestas automáticamente. Las metas corporales y nutricionales no se cambian mediante IA.
- Sin clave, conexión o saldo, puedes seguir con sugerencias locales y editar el plan manualmente.
- La API puede generar costos en tu cuenta de OpenAI. La aplicación no incluye una clave ni una suscripción.

## Entorno de desarrollo

Requisitos estándar: Node.js 22 o superior, Rust, herramientas C++ para Windows y WebView2. Se recomienda el entorno MSVC descrito por Tauri. Dependencias fijadas en `package-lock.json` y `src-tauri/Cargo.lock`.

```powershell
npm ci
npm run desktop
```

Pruebas y compilación:

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --test storage
npm run package
```

El instalador queda en `src-tauri/target/release/bundle/nsis`. Usa WebView2 instalado en Windows o descarga su instalador oficial cuando falte. Después de esa preparación, las funciones locales funcionan sin internet. No hace falta Node.js, Rust o herramientas C++ para usar la aplicación instalada.

`npm run dev` abre el entorno de desarrollo web en `http://127.0.0.1:1420`. Esa vista utiliza almacenamiento del navegador, separado de SQLite, y no conecta la IA. Es una herramienta de desarrollo; para el uso diario, abre Forja instalada.

## Organización

- `src/domain.ts`: calendario, versiones de hábitos, métricas, XP, rachas, revisiones y validación de copias.
- `src/storage.ts`: adaptador de persistencia y copias.
- `src/App.tsx`: navegación, estado y cola de guardado.
- Pantallas separadas para inicio, misiones, planificación, diario, progreso, revisiones y ajustes.
- `src-tauri/src/database.rs`: transacciones SQLite y respaldo previo a restaurar.
- `src-tauri/src/lib.rs`: comandos nativos, diálogos, credenciales e integración OpenAI.
- `src/domain.test.ts` y `src-tauri/tests/storage.rs`: pruebas de comportamiento y almacenamiento.

La ilustración del guerrero es SVG local con evoluciones por nivel. No se descargan imágenes, fuentes o recursos visuales desde servicios externos al abrir la app.
