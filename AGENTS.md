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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

In this repository, invoke the project-local CLI with `.\graphify.cmd` (for example, `.\graphify.cmd query "<question>"` or `.\graphify.cmd update .`). Do not rely on a globally installed `graphify` command.

Rules:
- When graphify-out/graph.json exists, run `.\graphify.cmd query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `.\graphify.cmd path "<A>" "<B>"` for relationships and `.\graphify.cmd explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `.\graphify.cmd update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
