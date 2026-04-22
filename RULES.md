# RULES

## Principios de Ingeniería

### DRY (Don't Repeat Yourself)
- Evitar duplicación de lógica, reglas de negocio, validaciones y constantes.
- Extraer código compartido a módulos reutilizables (`packages/shared`) cuando aplique.

### KISS (Keep It Simple, Stupid)
- Priorizar soluciones simples, legibles y mantenibles.
- Evitar sobreingeniería, abstracciones innecesarias y complejidad prematura.

### SOLID
- **S**ingle Responsibility: cada módulo/componente debe tener una única responsabilidad.
- **O**pen/Closed: extender comportamiento sin romper código existente.
- **L**iskov Substitution: implementaciones intercambiables sin efectos inesperados.
- **I**nterface Segregation: interfaces pequeñas y específicas por caso de uso.
- **D**ependency Inversion: depender de abstracciones, no de detalles concretos.

### Naming Convention
- Usar nombres descriptivos y consistentes para variables, funciones, clases, componentes, archivos y carpetas.
- Mantener la convención del stack por tecnología (por ejemplo: `camelCase` en variables/funciones, `PascalCase` en componentes/clases, y `kebab-case` en nombres de archivos cuando aplique).
- Evitar abreviaturas ambiguas y nombres genéricos (`data`, `temp`, `value`) salvo en contextos acotados.

## Reglas de Cambios
- Siempre justificar claramente el motivo y el impacto de cada cambio propuesto.
- No modificar archivos ajenos al alcance solicitado.
- Antes de cambiar cualquier cosa no explícitamente pedida, pedir confirmación.

## Reglas de Monorepo
- Backend y frontend deben convivir en el mismo monorepo.
- Backend y frontend no deben mezclarse: responsabilidades, dependencias y capas separadas.
- Compartir únicamente contratos/tipos/esquemas comunes mediante paquetes compartidos.

