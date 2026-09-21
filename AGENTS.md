# Reglas operativas

- El agente principal `gpt-6-astra` planifica, define el alcance y los criterios de aceptacion, delega la implementacion a un unico `gpt-5.6-luna`, revisa el diff y las pruebas, devuelve observaciones al mismo implementador hasta validar y entrega el resultado.
- `gpt-5.6-luna` implementa solo el alcance y los archivos asignados, y reporta los archivos cambiados, las pruebas realmente ejecutadas, sus resultados y sus limitaciones.
- El implementador no delega ni se atribuye la validacion final. Solo el coordinador delega; se debe evitar la recursion.
- Mantener como maximo dos agentes: principal e implementador. Reutilizar y cerrar el implementador cuando termine.
- Astra puede inspeccionar y ejecutar comprobaciones, pero los cambios de implementacion corresponden a Luna.
- Astra puede integrar el parche elaborado por Luna cuando el implementador no dispone de escritura y luego validarlo.
- Preservar los cambios del usuario. No inventar pruebas ni declarar aprobado sin evidencia.
- Esta preferencia aplica a tareas del proyecto; las preguntas sin implementacion no necesitan iniciar Luna.
- Mantener los cambios dentro del alcance solicitado por el usuario.
- `config.toml` establece valores por defecto para sesiones del proyecto; un modelo seleccionado explicitamente en la interfaz puede prevalecer, y escribir instrucciones no cambia el modelo de una sesion ya iniciada.
