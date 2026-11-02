# Auditoría de usabilidad y diseño

## Diagnóstico

Melange tiene una identidad cálida y consistente, pero su sencillez visual no siempre corresponde a sencillez operativa. El principal riesgo para personas no expertas es registrar una operación razonable, interpretar mal el resultado y no encontrar cómo corregirla. La corrección y recuperación deben tener tanta prioridad como el alta.

La revisión inicial combinó lectura del código, interacciones en Chromium móvil con datos ficticios y revisión independiente de dinero/persistencia. No equivale a un estudio con usuarios ni a una validación completa de la APK en un teléfono.

La prueba exploratoria posterior, con 16 tareas ficticias y recomprobación por UI de las correcciones, está en [Prueba de usuario simulado](prueba-usuario-simulado.md). No es evidencia de un estudio con personas reales.

## Comentarios incorporados de usuarios

### R01. Crear y editar no ofrecen los mismos datos

Hay campos de creación que desaparecen al editar, por ejemplo el saldo anterior de una tarjeta. Los MSI vinculados tampoco tenían acceso visible a su edición. Esto impide corregir capturas y obliga a compensar errores con operaciones ficticias.

**Integración:** formulario compartido de tarjeta, saldo inclusivo editable y MSI dentro del mismo recorrido; edición de cuentas con saldo actual; acceso a cada MSI desde la tarjeta y la Ruta. Los campos financieros que tienen pagos reales se muestran con su protección explicada, no desaparecen. Queda pendiente extender una corrección guiada a todos los tipos de pago y préstamos por cobrar.

### R02. Fijos y suscripciones bloqueados por vínculos

Cambiar un servicio o dejar de usarlo no debería requerir revertir pagos de meses anteriores o de tarjeta. Un compromiso, sus vencimientos y el dinero ya pagado son conceptos diferentes.

**Integración:** edición conserva pagos y aplica el calendario después de vencimientos pagados por adelantado; archivar detiene nuevos cobros desde hoy conservando incluso pagos futuros. El detalle incluye vencimientos y pagos con acceso a corregir. La corrección compatible de un pago fijo conserva su identidad y vínculo, sin reversión manual ni doble movimiento.

**Límite deliberado:** eliminar un cargo ya cubierto por pagos de tarjeta no puede borrar también esos pagos silenciosamente. Se mantienen las protecciones de integridad. Una corrección que implicaría saldo a favor o redistribuir pagos requiere un recorrido específico; no se debe resolver desactivando la validación.

### R03. Desglose de tarjeta saturado de cargos en cero

Los periodos liquidados distraen de lo pendiente. Mostrar compras antiguas con $0 no ayuda a decidir cuánto y qué pagar ahora.

**Integración:** pendientes por defecto; periodos liquidados en historial plegado y cargos cubiertos de un periodo mixto en otro desplegable. El historial sigue existiendo, con sus importes, pero no domina el desglose ni el formulario de pago.

### R04. Alta de TDC y MSI fragmentada

Pedir «saldo anterior sin MSI» fuerza a consultar el banco, sumar los pendientes de MSI y restarlos manualmente. El usuario puede omitir una compra o duplicar deuda al incorporarla después.

**Integración:** se copia el saldo total del banco, incluidos los MSI, y se añaden varias compras a meses en el mismo formulario. La app calcula el saldo restante sin MSI y guarda todo atómicamente. Si los MSI superan el saldo total o hay datos inválidos, no guarda parte del alta. No crea gastos ni descuenta cuentas de dinero.

## Registro de la auditoría inicial

Prioridades: P1 = dinero registrado o bloqueo de flujo importante; P2 = confusión o fricción significativa. «Parcial» no significa resuelto ni validado completamente. La tabla siguiente conserva el corte del primer bloque; las actualizaciones posteriores prevalecen sobre ese estado inicial y el bloque con número mayor es el más reciente.

| ID  | Hallazgo                                                      | Estado de esta integración                                                                                                                                                          |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01 | Ingreso opcional obligatorio y ceros tratados como vacío      | Corregido en campos y configuración                                                                                                                                                 |
| U02 | Primer uso agrupa bancos en Débito                            | Pendiente de rediseño del onboarding                                                                                                                                                |
| U03 | Estados vacíos sin siguiente paso contextual                  | Pendiente                                                                                                                                                                           |
| U04 | Disponible libre puede parecer dinero sin compromisos         | Pendiente de nueva jerarquía de Inicio                                                                                                                                              |
| U05 | Crédito parece dinero propio junto a efectivo y débito        | Parcial: etiqueta Crédito disponible; separación visual pendiente                                                                                                                   |
| U06 | Acceso Crédito abre efectivo/débito                           | Corregido                                                                                                                                                                           |
| U07 | Inicio excesivamente largo                                    | Pendiente                                                                                                                                                                           |
| U08 | Importes se transforman silenciosamente                       | Corregido: formatos explícitos, sin eliminar signos ni truncar decimales                                                                                                            |
| U09 | Cerrar descarta formulario sin avisar                         | Pendiente: borradores y protección de descarte                                                                                                                                      |
| U10 | Selector de cuentas no muestra disponible                     | Pendiente                                                                                                                                                                           |
| U11 | Crear categoría/cuenta exige abandonar registro               | Pendiente                                                                                                                                                                           |
| U12 | Transferencia no muestra destino                              | Parcial: destino en detalle; mejorar lista                                                                                                                                          |
| U13 | Filtros activos invisibles                                    | Corregido: indicadores y Quitar filtros                                                                                                                                             |
| U14 | Periodo y año poco claros                                     | Corregido: periodo visible, Todo el historial y año de fechas antiguas. Aclaración: el valor inicial del filtro ya era el mes actual; todo el historial se obtiene al quitar fechas |
| U15 | Salidas no explica qué tipos de operación incluye             | Pendiente                                                                                                                                                                           |
| U16 | Cuenta nace en cero y necesita otra operación                 | Corregido: saldo en alta y edición                                                                                                                                                  |
| U17 | Saldo cero vacío bloquea corrección                           | Corregido; ajustes admiten también saldos negativos                                                                                                                                 |
| U18 | Saldo anterior de tarjeta no editable                         | Corregido mediante saldo actual inclusivo, conservando pagos                                                                                                                        |
| U19 | MSI vinculado sin edición visible                             | Corregido                                                                                                                                                                           |
| U20 | Nueva deuda presenta unos quince campos sin adaptación        | Parcial: MSI integrado en tarjeta; asistente general pendiente                                                                                                                      |
| U21 | MSI exige escribir costo de financiamiento cero               | Corregido: cero explícito; el alta integrada no pide ese campo                                                                                                                      |
| U22 | No se puede crear una deuda sin conocer cuota                 | Pendiente                                                                                                                                                                           |
| U23 | Pago de tarjeta requiere entender conciliación                | Pendiente de asistente unificado                                                                                                                                                    |
| U24 | Abono sin asignar aparece sin concepto                        | Corregido                                                                                                                                                                           |
| U25 | Editar pago obliga a revertir y repetir                       | Parcial: pagos fijos compatibles se corrigen directamente                                                                                                                           |
| U26 | Periodicidad usa lenguaje interno                             | Parcial: Primer vencimiento y explicación del calendario; vista previa pendiente                                                                                                    |
| U27 | Detalle fijo no deja verificar calendario/pagos               | Corregido: vencimientos, vigencia y pagos con acciones                                                                                                                              |
| U28 | Préstamo por cobrar sin edición adecuada                      | Pendiente                                                                                                                                                                           |
| U29 | Cobros sin dirección visual de entrada                        | Pendiente                                                                                                                                                                           |
| U30 | Reservar/liberar/asignar comparten campos irrelevantes        | Corregido: campos por acción y asignación solo cuando existe reserva antigua                                                                                                        |
| U31 | Liberar cajita vinculada no siempre deja dinero gastable      | Pendiente                                                                                                                                                                           |
| U32 | Días 1–9 muestran Invalid Date                                | Corregido                                                                                                                                                                           |
| U33 | Calendario sin regreso directo al presente                    | Parcial: Volver a este mes; selector de mes/año pendiente                                                                                                                           |
| U34 | Proyección usa lenguaje experto y explicación plegada         | Pendiente                                                                                                                                                                           |
| U35 | Datos locales sin explicar pérdida/desinstalación claramente  | Parcial: aviso de pérdida y estado del último respaldo confirmado; falta validarlo en APK                                                                                           |
| U36 | Error de arranque solo propone reiniciar                      | Parcial: Reintentar e importar sin escribir un libro vacío; el reemplazo de datos corruptos en Android requiere el método nativo `writeRecovery`, pendiente de coordinar            |
| U37 | Error de Guardar fuera de pantalla                            | Corregido: desplazar y enfocar mensaje                                                                                                                                              |
| F01 | Gastos anteriores al saldo de hoy pueden descontarse otra vez | Parcial: cuentas nuevas configuradas por UI guardan fecha inicial y rechazan operaciones anteriores; no se inventa fecha para libros antiguos                                       |
| F02 | Pendiente de cuota final supera saldo de deuda                | Corregido en el restante pagadero; se conserva la cuota contractual                                                                                                                 |
| F03 | Exportación e importación con límites distintos               | Corregido: límite único de 20 MB en bytes UTF-8; se rechaza cualquier exportación que no pudiera reimportarse. Falta probarlo con un libro grande en APK                            |
| F04 | Fallo intermitente de Deshacer en prueba UI                   | No confirmado como defecto de producción; no se declara solucionado por pasar una ejecución                                                                                         |

## Crítica de diseño conservada

### Actualización del tercer bloque

- **U03:** estados vacíos de movimientos, fijos, deudas, metas y calendario tienen acciones contextuales; sin resultados por filtros se distingue de un libro vacío.
- **U11:** cuentas y categorías se agregan dentro del registro y se materializan en su mismo guardado atómico; los pagos de tarjeta y préstamos incluyen alta de cuentas.
- **U12, U15:** transferencias indican origen y destino en lista y las salidas explican qué movimientos suman.
- **U20–U22:** asistente por tipo, opcionales plegados y deuda sin cuota conocida. Se conserva el calendario protegido de deudas con pagos.
- **U23/U25:** corrección de pagos de tarjeta distribuidos y reasignación entre cargos; no se borran otros pagos ni se inventa una segunda salida. Un cargo cubierto sigue protegido hasta corregir sus pagos explícitamente.
- **U26/U33/U34:** vista previa recurrente, selector de mes/año y proyección con explicación visible y lenguaje cotidiano.
- **U28/U29:** edición del préstamo por cobrar y de cada movimiento, con dirección y cuenta explícitas.
- **Observación MSI de la prueba simulada:** el formulario avisa si la primera fecha de mensualidad queda después del día límite de pago del mismo mes. No mueve fechas automáticamente; queda pendiente contrastar el ciclo con un estado de cuenta real.
- **U35/U36/F03:** límite común de respaldos en bytes UTF-8, confirmación real, vigencia conservadora y recuperación de arranque confirmada conservando el original. No se garantiza que el usuario mantenga el archivo en su proveedor.
- **F04:** diagnóstico instrumentado y regresiones repetidas, con errores antes/después de guardar. Se corrigió el aviso incorrecto tras un Deshacer persistido cuyo recordatorio falló; no se atribuye a esto el fallo intermitente histórico sin evidencia.
- **Diseño 7:** acceso permanente a Cuentas en la barra inferior, con objetivos táctiles comprobados a 320 px.
- **Copy tras prueba exploratoria:** pago sin desglose, compras a meses sin intereses, crédito sin plazo fijo y persona/empresa a quien se debe se explican con palabras más directas; Inicio aclara el margen pendiente y el detalle de deuda ya no deja parecer las compras de tarjeta una deuda adicional. Queda pendiente un glosario coherente de toda la app.
- **Validación pendiente:** estudios con personas reales, TalkBack, teclado/permisos/proveedores de documentos y muerte del proceso en Android real. Las pruebas del emulador no sustituyen estos recorridos.

### Actualización del segundo bloque

- **U02, U04 y U05 corregidos:** inicio por bancos, dinero/pendientes/margen juntos y crédito separado. Si faltan aplicaciones de abonos, Inicio no muestra un margen numérico contradictorio en el análisis.
- **U09 corregido:** borradores persistentes en formularios principales y protección de cierre en los demás. Restaurar no modifica dinero; los borradores anteriores a otros cambios solo se consultan.
- **U10 corregido:** disponible y uso restringido en selectores.
- **U31 corregido el mensaje:** descongelar una cajita ligada a meta explica que todavía hay una reserva y dónde liberarla.
- **U03 y U07 parciales:** primera tarea contextual, menos espacio editorial, sin resumen mensual duplicado, sin carrusel y análisis plegado. Falta validar con usuarios y ampliar estados vacíos.
- **U35 parcial:** aviso de pérdida/desinstalación en el inicio y estado del último respaldo confirmado en Ajustes. Solo se marca como guardado después de que Android confirma la escritura; la vista previa del navegador no lo afirma.
- **Diseño 4–6 mejorados:** ayudas y etiquetas mayores, controles principales de 44 px y cinco pares de contraste por encima de 5.2:1. Continúa pendiente una revisión completa de accesibilidad y TalkBack real.

**Conservar:** paleta cálida, identidad reconocible, acciones rápidas con texto e icono, jerarquía de cifras, movimiento reducido y advertencias honestas sobre límites de intereses/proyección.

**Mejorar:**

1. Menos espacio editorial en Inicio, más prioridad a próximos pagos y margen real.
2. Menos tarjetas para información mínima y menos información financiera oculta en carruseles.
3. Botones textuales para altas en estados vacíos, no depender solo de +.
4. Ayudas esenciales de 13–14 px y lenguaje cotidiano antes que letra pequeña.
5. Contraste: algunas combinaciones de tokens rondan 4.25–4.38:1, por debajo de 4.5:1 para texto pequeño; advertencia sobre fondo suave ronda 3.21:1.
6. Controles cómodos de 44–48 px; algunas flechas eran de 36 px.
7. Lugar estable de Cuentas en la navegación.
8. Diálogos con nombre accesible: corregido en esta integración; falta validar TalkBack real.

## Plan y límites

El plan, las dependencias y la verificación están en [Integración de usabilidad](integracion-usabilidad.md). Las prioridades restantes no deben presentarse como implementadas. Las modificaciones financieras conservan historial y Deshacer, y no intentan resolver la saturación visual borrando datos.
