# Integración de la revisión de usabilidad

## Objetivo

Que una persona pueda registrar, entender y corregir sus finanzas sin aprender el modelo contable. Los cambios no deben borrar pagos, inventar salidas ni duplicar MSI. Toda modificación financiera debe guardarse como una operación atómica y admitir Deshacer.

## Comentarios adicionales de usuarios

1. **Creación y edición inconsistentes:** faltan campos en edición que sí aparecen en el alta. Especialmente grave en saldo anterior de tarjeta y MSI vinculados.
2. **Fijos y suscripciones difíciles de corregir:** cambiar o dejar de usar una suscripción no debe obligar a revertir pagos de otros flujos. Hay que separar el compromiso, su calendario futuro y sus pagos reales.
3. **Desglose de crédito saturado:** los periodos liquidados y cargos en cero no deben competir con lo pendiente. Deben seguir disponibles en un historial plegado.
4. **Alta de TDC fragmentada:** se debe introducir el saldo total del banco y los MSI en el mismo formulario. La aplicación calcula el componente sin MSI; la persona no debe restarlo manualmente.

## Plan de integración

### A. Tarjetas y MSI

- Un formulario compartido para crear y editar tarjeta: nombre, límite, corte, pago, saldo actual total y vencimiento.
- Alta de varios MSI dentro del mismo formulario; desglose previo de saldo total, MSI y saldo restante.
- Guardado conjunto: si cualquier MSI es inválido, no se guarda parte de la tarjeta.
- Acceso a cada MSI desde su tarjeta para consultar y editar.
- Los pagos reales existentes se preservan. Un campo protegido debe explicarse; no debe desaparecer silenciosamente.
- Desglose centrado en cargos pendientes; cargos pagados y periodos liquidados en historial plegado, sin borrar antecedentes.

### B. Fijos y suscripciones

- Edición de datos y calendario sin modificar pagos anteriores.
- Aplicar cambios después de vencimientos ya pagados por adelantado, mostrando la fecha efectiva.
- Cancelar suscripción detiene nuevas obligaciones desde la fecha elegida y conserva pagos, incluso anticipados.
- Corrección de un pago desde su detalle sin exigir una reversión manual para los casos compatibles; las protecciones de pagos de tarjeta no se eliminan a ciegas.
- Detalle con próximos vencimientos, pagos y acceso a editar/cancelar.

### C. Correcciones transversales

- Importes sin conversiones silenciosas; ceros válidos y campos opcionales reales.
- Errores visibles y diálogos con nombre accesible.
- Calendario con fechas válidas y regreso al mes actual.
- Filtros activos visibles y acceso de Crédito que abre Crédito.
- Formularios de reserva adaptados a la acción elegida.
- Protección explícita frente a movimientos anteriores al saldo inicial de cuentas configuradas desde esta entrega.

### D. Evolución restante de la auditoría

No confundir esta integración con la resolución automática de toda la auditoría anterior. Mantener como trabajo separado y verificable:

- Onboarding por bancos y nueva jerarquía de Inicio: implementados en el segundo bloque, pendientes de estudio con usuarios reales.
- Asistente reducido de deudas por tipo y altas contextuales: implementados en el tercer bloque.
- Borradores persistentes y protección frente al descarte accidental: implementados en el segundo bloque.
- Corrección guiada de pagos distribuidos y préstamos por cobrar: implementada en el tercer bloque; se conservan restricciones para cargos que ya tienen pagos.
- Política unificada de respaldos, recuperación y límites en bytes: implementada la validación de 20 MiB UTF-8 compartida, el rechazo de exportaciones no reimportables, la recuperación de arranque con Reintentar/Importar y el estado de último respaldo confirmado. SQLite preserva el libro anterior antes del reemplazo confirmado.
- Revisión completa de accesibilidad: se mejoraron contraste de tokens, ayudas, etiquetas y controles principales; quedan revisión de todos los estados y pruebas de lector de pantalla real.
- Pruebas con usuarios y en Android real: teclado, TalkBack, permisos, notificaciones y muerte del proceso.
- Diagnóstico instrumentado de Deshacer: implementado; la causa del fallo intermitente histórico no está demostrada.
- Fecha de primera mensualidad en tarjeta: el alta advierte cuando su fecha queda después del día límite de pago del mismo mes; el cálculo no se cambia sin contrastar la regla con un estado de cuenta real.

## Verificación

Pruebas de dominio para altas atómicas de TDC/MSI, saldo inclusivo, edición con pagos, cancelación de fijos con pagos anticipados y correcciones. Pruebas de navegador para creación/edición, historial plegado, errores visibles, formularios móviles y persistencia tras recarga. Ejecutar suites existentes, lint Android y revisión adversarial antes de cerrar la entrega.

## Estado de la implementación

- **Implementado A:** tarjeta y MSI en una operación, saldo inclusivo, mismos campos de tarjeta en crear/editar, historial plegado y acceso a editar MSI.
- **Implementado B:** editar compromiso sin revertir pagos, archivar sin bloquear por pagos adelantados, detalle con vencimientos/pagos y corrección directa compatible de pagos fijos.
- **Implementado C:** importes, cero/opcionales, errores visibles, nombre accesible de diálogo, fechas y regreso al mes, filtros visibles, accesos de crédito, campos contextuales de reservas y fecha inicial para cuentas nuevas.
- **Implementado D en código:** asistente de deudas, altas contextuales, corrección/reasignación de pagos de tarjeta, corrección de préstamos/cobros, límites y recuperación de respaldos, mejoras de calendario/proyección/estados vacíos y diagnóstico de Deshacer. La validación humana y de accesibilidad/Android real sigue separada del estado del código.

### Segundo bloque implementado

- Configuración inicial con efectivo y varias cuentas bancarias. Una operación atómica conserva cada saldo una sola vez; no se crean ingresos ni transferencias para repartirlo.
- Inicio muestra dinero propio, pendientes del mes y margen estimado juntos. No promete cubrir compras futuras ni otros meses. Si hay pagos de tarjeta aún sin desglose, el margen numérico no se muestra en ninguna parte de Inicio; indica que hay que revisar esos pagos.
- Crédito separado del dinero propio, resúmenes sin carrusel, consumo/análisis plegados y una primera tarea contextual.
- Borradores locales para los principales formularios financieros, incluidos inicio multibanco y TDC con MSI dinámicos; recuperación explícita y aislamiento por libro, operación y revisión.
- Protección de cierre en formularios sin borrador o ante fallos de almacenamiento; navegación bloqueada durante un guardado financiero.
- Selectores de cuenta muestran disponible y restricciones; liberación de cajita ligada a meta explica que seguirá reservada.
- Contraste de cinco pares principales superior a 5.2:1; ayudas y etiquetas más legibles y controles principales de 44 px.

Se añadieron regresiones de borradores con fallos controlados: descarte mientras llega otro evento, cierre que ya esperaba un guardado cuando falla el descarte, fallo de limpieza después de confirmar una operación y rechazo de borradores anteriores a cambios del libro. Los hallazgos de la revisión adversarial se reprodujeron y corrigieron con pruebas específicas.

La fase del calendario se conserva a partir del primer vencimiento explícito: cambiar de mensual a cada dos meses no reinicia automáticamente esa fecha. Hay una regresión específica para fijar esta intención y el formulario explica cómo reiniciar el calendario.

`tests/usability.test.mjs` añade regresiones financieras; `tests/usability-ui.test.mjs` recorre el alta inclusiva, paridad de edición, historial plegado, MSI, corrección de pagos y cancelación de suscripción. Ambas se incluyen en los comandos normales de prueba.

La revisión adversarial detectó dos condiciones adicionales y se añadieron sus regresiones: conservar el vencimiento de pagos adelantados aunque su mes aún no tuviera un presupuesto guardado, y rechazar MSI cuyo saldo no puede cubrirse con las mensualidades restantes. También se prueba la conservación de vencimientos históricos importados.

`tests/backups.test.mjs` cubre el límite UTF-8 compartido, el rechazo de exportaciones que no podrían reimportarse, la confirmación nativa antes de afirmar que el último respaldo se guardó y la recuperación de arranque sin escribir un libro vacío. La prueba Java `BackupPolicyTest` fija el mismo límite y el corte de lectura en bytes.

### Comprobaciones realizadas

- `npm run check`: aprobado; formato, 93 pruebas de dominio/soporte y suites DOM/actualizaciones, incluidas correcciones, respaldos, cronología heredada y claridad de pantallas.
- `npm run test:ui`: 12 suites de navegador; incluye una regresión de las observaciones de la prueba exploratoria además de correcciones, altas contextuales, asistente de deudas, recuperación, cuentas archivadas, borradores, Deshacer y accesibilidad estructural.
- `npm run android:check`: pruebas unitarias/lint Android correctos; no es una prueba de interacción en teléfono.
- La prueba nueva de navegador verifica que un alta inválida no guarda parte de la tarjeta y que el error queda visible y enfocado. También comprueba que `12,50` se conserva al escribir y se guarda como 12.50, no como 1250.
- `npm run format:java:check` y `git diff --check`: correctos. Revisión adversarial cerró el margen duplicado y la carrera de cierre/descarte con sus pruebas específicas. El test DOM espera la finalización del arranque/guardados, no solo una pausa fija de 5 ms.

No se declara resuelto el fallo intermitente histórico de Deshacer solo porque las suites hayan pasado. Tampoco se declara validada la experiencia con teclado Android o TalkBack real.

### Tercer bloque: diagnóstico y accesibilidad transversal

- Deudas por tipo con datos opcionales plegados; una deuda sin cuota no obliga a inventarla. Cambiar el tipo no conserva un vínculo MSI oculto y editar no borra antecedentes.
- Alta de cuentas y categorías dentro del movimiento/pago, en el mismo guardado atómico. Los borradores conservan selecciones pendientes, validan su estructura y no crean opciones que finalmente no se usen.
- Corrección de importe, fecha y cuenta de un pago de tarjeta distribuido, conservando identidad y otros pagos. Reasignación entre cargos sin modificar dinero real.
- Corrección de préstamos por cobrar y sus movimientos individuales, con saldo pendiente, fondos, reservas y fecha validados. Entradas y salidas se indican con texto y cuenta.
- Transferencias muestran origen/destino en lista; Salidas explica sus componentes; el calendario permite elegir mes/año y las recurrencias muestran próximas fechas. La proyección usa lenguaje cotidiano y límites visibles. Estados vacíos ofrecen una siguiente acción.
- Respaldos UTF-8 estrictos, límite común de 20 MiB, exportaciones serializadas con token y confirmación nativa real. Tras reabrir/recuperar no se afirma «al día» solo por coincidir ID/revisión.
- Recuperación confirmada conserva el original dañado en una transacción tanto en SQLite como en IndexedDB. Regresión en navegador y prueba SQLite en una base aislada del emulador; nunca se usó el teléfono conectado.

- Acceso permanente a Cuentas en la navegación inferior; seis destinos con objetivos de al menos 44 px comprobados a 320 px de ancho.
- Controles de catálogo, segmentación, cobros y selector de gráfica ampliados; ayudas de Ajustes y notas contextuales más legibles.
- Diagnóstico de hasta 100 fases de operación en memoria, sin contenido financiero. Prueba de doce ciclos guardar/Deshacer con recargas y fallos controlados antes y después de persistir. Esto instrumenta F04, **no demuestra la causa del fallo histórico**.
- Se corrigió un riesgo verificado: fallar al actualizar recordatorios después de persistir no debe revertir el estado en memoria ni afirmar que Deshacer falló. La regresión comprueba el mensaje, una sola operación deshecha y la recarga.
- Prueba estructural de accesibilidad: controles y diálogos con nombre, foco de teclado dentro del diálogo y ausencia de desbordamiento de página a 320 px. No sustituye contraste en todos los estados, TalkBack o uso real en Android.
- La prueba de rol inicial y la recomprobación posterior se documentan en `prueba-usuario-simulado.md`. Los errores de dinero/texto y rutas de edición reportados se corrigieron; el vocabulario técnico y la fecha MSI observada siguen como áreas de validación/mejora, no como bugs financieros confirmados.
- Se refinaron etiquetas a partir de la prueba: pagos sin desglose, compras a meses sin intereses, crédito sin plazo fijo, quién debe y acceso a la corrección desde el detalle del movimiento. Se conserva como pendiente el glosario integral del vocabulario técnico.

La revisión adversarial reprodujo y cerró: decodificación UTF-8 silenciosa, correlación de exportaciones, estado de respaldo después de recuperación, restauración contextual no atómica, categorías no usadas, validación nativa de campos ocultos, calendario oculto al convertir deuda, selección silenciosa de cuenta archivada y cronología de cobros. Los libros antiguos con fechas inconsistentes se abren con aviso y pueden repararse por pasos, sin inventar fechas ni agravar ningún déficit histórico.

Pruebas instrumentadas del emulador `emulator-5554`: **3/3 aprobadas** en `RecoveryStoreTest` (preservación del original y rollback SQLite aislado) y `AndroidSmokeTest` (SQLite, migración y WebView). No se usó el teléfono físico conectado ni sus datos. La prueba exploratoria como usuario inexperto se documenta por separado: no equivale a un estudio con personas reales.
