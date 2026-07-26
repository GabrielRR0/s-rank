# components/ui

Componentes genéricos, sin dominio propio - el mismo sistema de diseño que el resto del portafolio (ver `../../../DESIGN.md` en la raíz), reescrito acá para que este proyecto sea un repositorio independiente y autocontenido (no un paquete compartido entre proyectos).

## Archivos

- **`BaseButton.vue`** / **`BaseCard.vue`** / **`BaseAlert.vue`**: primitivas visuales (botón primario/secundario, card, alerta de error) - idénticas en código a las de `contract-generator`, ya que son deliberadamente agnósticas de dominio.
- **`ThemeToggle.vue`**: modo claro/oscuro con barrido circular (View Transitions API nativa), a diferencia de `contract-generator` **sí** respeta `prefers-reduced-motion` (ver decisión de arquitectura en el README raíz de este proyecto).
- **`AppFooter.vue`** / **`LanguageToggle.vue`**: iguales a `contract-generator`.
- **`AppLogo.vue`**: ícono propio de este proyecto (tres nodos conectados, evocando un enlace compartido) - incluido en `--accent` violeta, distinto del azul de `contract-generator`, para diferenciarlo dentro del portafolio (`DESIGN.md` #1.5).

## Por qué se reescriben en vez de importarse desde `contract-generator`

Cada proyecto del portafolio es un repositorio independiente, con su propio deploy (ver README raíz del portafolio) - no hay un paquete `ui` compartido entre ellos. La consistencia visual entre proyectos se logra siguiendo la misma guía (`DESIGN.md`), no compartiendo código en tiempo de ejecución.
