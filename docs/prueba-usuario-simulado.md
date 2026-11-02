# Prueba exploratoria de usuario simulado — Melange

**Fecha de la prueba:** 2 de noviembre de 2026
**Informe:** `docs/prueba-usuario-simulado.md`
**Naturaleza:** prueba de rol, no estudio con personas reales. Simulé a una usuaria novata que quiere llevar sus finanzas personales sin leer documentación.

---

## 1. Resumen ejecutivo

Recorrí la aplicación como una usuaria primeriza, usando únicamente etiquetas y controles visibles, en Chromium móvil. Registré 16 tareas reales con datos ficticios: cuentas, sueldo, compras, transferencia, renta, suscripción, deuda, tarjeta con MSI, compra a crédito, pago de tarjeta, préstamo a un tercero, cobro parcial, meta con reserva, calendario, borrador recuperado, errores de importe/saldo, exportación y persistencia.

**Resultado general:** la app es funcional y la aritmética principal cuadró en todos los cortes que revisé. No encontré pérdida de dinero, doble descuento ni corrupción de datos. Sí encontré fricción real de descubrimiento y varios defectos de texto/estado.

- **Tareas completadas:** 16 de 16, aunque 3 requirieron explorar y una tuve que corregirla por la ruta de reversión.
- **Defectos de producto reproducidos:** 5 (2 de estado/aviso, 2 de pluralización y 1 de formato monetario).
- **Fricciones de usabilidad reproducidas:** 4 (tarjeta escondida, resumen de deuda ambiguo, categoría no visible en el detalle, mensaje genérico de importe cero).
- **Errores JavaScript de la app:** ninguno. Tampoco aparecieron diálogos nativos ni excepciones de consola.
- **Conclusión honesta:** sí pude terminar los flujos principales sin guía, pero no porque todo fuera evidente. La tarjeta de crédito después de tener otra deuda, la reserva de una meta y la corrección de un pago no se encuentran de forma natural en el primer intento.

---

## 2. Entorno y método

- **Aplicación:** build local de Melange servida desde `app/src/main/assets` con `scripts/preview.mjs`.
- **Servidor:** efímero en `http://127.0.0.1:8899/` (puerto aislado).
- **Navegador:** Chromium de Playwright 1.55.1, emulación móvil **Pixel 5** (393 × 851), `locale=es-MX`, zona `America/Mexico_City`.
- **Perfil:** perfil de navegador nuevo y vacío en `/tmp/opencode/melange-user-test/profile`, sin teléfono físico, sin otras sesiones, sin datos reales.
- **Persistencia:** la app guarda en IndexedDB. Por eso usé un contexto persistente aislado para continuar entre pasos; no se usó almacenamiento de un perfil real.
- **Datos:** todos ficticios. La fecha de trabajo de la app fue **2 nov 2026**.
- **Restricciones respetadas:** no modifiqué código de app, tests ni `package.json`; no hice commits; no usé el teléfono conectado; no consulté documentación de uso, tests ni fuentes para orientarme. Leí solo `scripts/preview.mjs`, `package.json`, `scripts/run.sh` y `scripts/dev-env.sh` para arrancar. Después de registrar la experiencia leí dos fragmentos puntuales para confirmar la causa de un bug (se indica abajo).
- **Evidencia:** 96 capturas y scripts en `/tmp/opencode/melange-user-test/shots/` y `/tmp/opencode/melange-user-test/`. El respaldo final está en `/tmp/opencode/melange-user-test/final-Melange-2026-11-02.json` (10,557 bytes). Es evidencia temporal, no forma parte del repositorio.
- **Nota sobre errores de automatización:** hubo timeouts de mi script al confundir `role=tab` con `button` y al usar etiquetas duplicadas (`Mensualidad`). No fueron errores JavaScript de la app; los corregí cambiando el selector.

---

## 3. Persona y datos inventados

**Lucía Ramos**, 29 años, asistente administrativa en CDMX. Vive con una compañera, quiere ordenar su quincena y ahorrar para un viaje. No sabe qué es “MSI”, “crédito revolvente” ni “conciliar abonos”; usa el celular con una mano.

| Dato                              | Valor                                                              |
| --------------------------------- | ------------------------------------------------------------------ |
| Ingreso mensual previsto          | $18,500.00 MXN                                                     |
| Efectivo en cartera               | $1,850.25                                                          |
| BBVA nómina                       | $12,400.50                                                         |
| Nu cuenta                         | $3,250.75                                                          |
| Cuenta creada sobre la marcha     | “Hey débito”, saldo inicial $1,200.00                              |
| Sueldo registrado                 | $18,432.75 en BBVA                                                 |
| Compra con nueva cuenta/categoría | “Súper de la semana”, $487.35, categoría “Súper”, desde Hey débito |
| Transferencia                     | $2,000.00 de BBVA a Nu                                             |
| Renta                             | $8,500.00 mensual, categoría Hogar                                 |
| Suscripción                       | Netflix, $219.00 → corregida a $249.00                             |
| Deuda sin cuota                   | “Préstamo de mamá”, $4,000.00, sin plazo fijo                      |
| Tarjeta                           | “Nu tarjeta”, límite $15,000.00, saldo inicial $8,500.00           |
| MSI en la misma alta              | “Pantalla nueva”, $6,000.00 en 6 mensualidades de $1,000.00        |
| Compra a crédito                  | “Audífonos”, $1,299.90                                             |
| Pago de tarjeta                   | $1,000.00; primero desde BBVA, revertido y recapturado desde Nu    |
| Préstamo a tercero                | “Diego / Préstamo para llantas”, $1,500.00 desde BBVA              |
| Cobro parcial                     | $500.00 en efectivo → corregido a $600.00 en Nu                    |
| Meta                              | “Viaje a Oaxaca”, objetivo $12,000.00; reserva $1,500.00 desde Nu  |
| Pago de suscripción               | Netflix $249.00 desde efectivo                                     |

**Estado final comprobado:** disponible $32,997.90; deuda total $12,799.90; por cobrar $900.00; reservado $1,500.00; efectivo $1,601.25; BBVA $27,333.25; Nu $4,850.75; Hey $712.65.

---

## 4. Tareas realizadas y resultado

| #   | Tarea                                                                    | Resultado       | Evidencia             | Lo que costó / observación                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------ | --------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Arrancar desde cero con efectivo y dos bancos, más ingreso previsto      | ✅              | `02a`, `03`, `04`     | Claro. El botón “Agregar otra cuenta bancaria” y el aviso de que el saldo inicial no es ingreso ayudan.                                                                                                                                       |
| T2  | Registrar sueldo con centavos                                            | ✅              | `05`–`08`             | Formulario corto. El saldo subió exactamente $18,432.75.                                                                                                                                                                                      |
| T3  | Registrar compra con centavos creando cuenta y categoría sobre la marcha | ✅              | `09`–`14`, `94`       | La creación inline funciona, pero el detalle del gasto no muestra la categoría; no pude verificar visualmente la asignación, solo que “Súper” quedó disponible después.                                                                       |
| T4  | Transferir entre cuentas                                                 | ✅              | `15`–`17`             | Claro. El total disponible no cambió y las dos cuentas se movieron correctamente.                                                                                                                                                             |
| T5  | Crear renta fija y suscripción, y cambiar el importe de la suscripción   | ✅              | `18`–`25`             | El formulario de gasto fijo tiene muchos campos y textos; “Cada cuántos”, “Dos veces al mes” y “Primer vencimiento” requieren leer. El cambio de $219 a $249 se guardó y se reflejó.                                                          |
| T6  | Pagar la suscripción desde el calendario                                 | ✅              | `86`–`88`             | La ruta Calendario → “Pagar Netflix” no era obvia desde el inicio, pero el formulario explica que se puede pagar parcial. El pago de $249 descontó efectivo.                                                                                  |
| T7  | Registrar deuda sin saber la cuota                                       | ✅              | `26`–`29`             | Elegí “Deuda sin plazo fijo”; el campo de cuota se deshabilita y el resumen dice “Sin cuota / Sin plazo fijo”.                                                                                                                                |
| T8  | Dar de alta tarjeta con saldo y MSI en el mismo formulario               | ✅ con fricción | `30`–`41`             | No encontré “Agregar tarjeta” en Deudas después de tener un préstamo; tuve que ir a **Cuentas → pestaña Crédito → Agregar tarjeta**. El resumen “Saldo total: $8,500 · MSI pendientes: $6,000” fue claro y no hubo doble conteo.              |
| T9  | Comprar a crédito                                                        | ✅              | `42`–`45`             | La tarjeta aparece como medio de pago (“Nu tarjeta · Crédito · $6,500 disponible”). El dinero propio no bajó, que es lo correcto.                                                                                                             |
| T10 | Pagar tarjeta y corregir el pago                                         | ✅              | `46`–`54`             | El detalle del pago tiene “Editar”, pero al abrirlo solo permite **Revertir movimiento**; hay que revertir y volver a capturar. El mensaje lo explica, aunque es un paso inesperado.                                                          |
| T11 | Prestar, cobrar parcialmente y corregir la captura                       | ✅              | `55`–`63`             | La corrección sí permite editar importe y cuenta. La ruta “Corregir” del cobro está dentro de la fila de la entrada, no en un menú global.                                                                                                    |
| T12 | Crear meta y reservar dinero                                             | ✅ con fricción | `64`–`69`             | El formulario de reserva mostró “Selección anterior · no disponible; elige una opción activa” en una meta nueva, sin reserva previa. Confunde.                                                                                                |
| T13 | Ir a otro mes del calendario y volver                                    | ✅              | `70`–`74`             | “Mes siguiente”, “Mes anterior” y “Volver a este mes” funcionaron. Diciembre mostró el pago de tarjeta de $4,799.90 (compra sin MSI + cuota MSI), lo que al principio me pareció un error hasta revisar el desglose.                          |
| T14 | Cerrar un formulario medio escrito y recuperarlo tras recarga            | ✅              | `75`–`81`             | El aviso “Borrador guardado solo en este dispositivo” y “Recuperar borrador” funcionaron tras recargar. Sí conservó concepto e importe.                                                                                                       |
| T15 | Intentar importe cero, texto no numérico y saldo insuficiente            | ✅              | `82`, `90`, `91`      | Los tres se bloquearon sin crear movimiento. El mensaje de saldo insuficiente fue útil; el de importe cero fue genérico.                                                                                                                      |
| T16 | Exportar respaldo, recargar y comprobar persistencia                     | ✅              | `83`–`85`, `95`, `96` | La descarga del navegador produjo `Melange-2026-11-02.json`. Tras recargar, los datos seguían. El aviso “Sin respaldo confirmado” es coherente con la nota de que en navegador solo se solicita la descarga, pero puede asustar a una novata. |

---

## 5. Verificación de dinero

Revisé los saldos después de cada operación. Los cortes principales:

| Corte                 | Cálculo esperado                      | Resultado en UI                                                             |
| --------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| Inicio                | 1,850.25 + 12,400.50 + 3,250.75       | **$17,501.50** ✅                                                           |
| Sueldo                | 17,501.50 + 18,432.75                 | **$35,934.25** ✅                                                           |
| Nueva cuenta + compra | 35,934.25 + 1,200.00 − 487.35         | **$36,646.90** ✅                                                           |
| Transferencia         | Sin cambio de total                   | **$36,646.90** ✅                                                           |
| Compra a crédito      | No baja dinero propio; sube deuda     | Disponible igual; deuda **$13,799.90** ✅                                   |
| Pago de tarjeta       | −1,000 de dinero propio; deuda −1,000 | Deuda **$12,799.90**; disponible **$34,746.90** tras el préstamo y cobro ✅ |
| Préstamo a Diego      | −1,500 de BBVA; +1,500 por cobrar     | BBVA **$27,333.25**; por cobrar **$1,500** ✅                               |
| Cobro corregido       | 500 en efectivo → 600 en Nu           | Efectivo **$1,850.25**; Nu **$4,850.75**; por cobrar **$900** ✅            |
| Reserva de meta       | −1,500 del disponible, sin gasto      | Disponible **$33,246.90**; reservado **$1,500** ✅                          |
| Pago Netflix          | −249 de efectivo                      | Disponible **$32,997.90**; efectivo **$1,601.25** ✅                        |

**No encontré doble descuento.** La compra a crédito no redujo el dinero propio; el pago de tarjeta sí lo redujo; la transferencia fue neutra; la reserva redujo el disponible sin crear gasto. El saldo de la tarjeta y los MSI se separaron correctamente: saldo inicial $8,500 con $6,000 de MSI, compra adicional de $1,299.90 y deuda total $12,799.90 después del pago de $1,000.

---

## 6. Hallazgos

### 6.1 Bug confirmado — el aviso de reservas está invertido (severidad media)

**Ruta:** Metas → crear “Viaje a Oaxaca” → Reservar / liberar → reservar $1,500 desde Nu → Inicio.

**Esperado:** que el inicio reconozca que hay $1,500 reservados o congelados.
**Actual:** el inicio muestra **“Sin reservas ni dinero congelado.”** justo debajo de “Tu dinero disponible $32,997.90”, mientras la misma pantalla muestra “METAS DE AHORRO $1,500” y “Reservado entre tus 1 metas.”

**Impacto:** el número disponible sí está neto de la reserva, pero el texto contradice el estado y puede hacer que la usuaria crea que su reserva no existe. No hay error aritmético, pero sí un aviso financiero engañoso.

**Causa confirmada (lectura puntual posterior):** `app/src/main/assets/js/screens/home.js:55` usa la condición `saved ? "Sin reservas ni dinero congelado." : "Dinero propio, no crédito."`; la cadena está invertida.

**Evidencia:** `shots/89-home-reserva-discrepancia.png`.

---

### 6.2 Bug confirmado — “Reservado entre tus 1 metas” (severidad baja)

**Ruta:** Inicio con una sola meta y reserva.

**Actual:** “Reservado entre tus **1 metas**.”
**Esperado:** “Reservado en tu meta” o “Reservado entre tus metas” / “1 meta”.

**Causa probable:** `home.js:93` interpola el número sin pluralizar. No afecta dinero.

**Evidencia:** `shots/89-home-reserva-discrepancia.png`.

---

### 6.3 Bug confirmado — “1 movimientos” (severidad baja)

**Ruta:** Movimientos después de registrar un único ingreso/gasto.

**Actual:** “**1 movimientos**” en el resumen.
**Esperado:** “1 movimiento”.

**Evidencia:** `shots/08-movimientos-tras-ingreso.png` y `shots/14-movimientos-gasto.png`.

---

### 6.4 Bug confirmado — “Selección anterior” en una meta nueva (severidad baja/media)

**Ruta:** Metas → crear meta → “Reservar / liberar”.

**Actual:** en el selector “Reserva existente” aparece **“Selección anterior · no disponible; elige una opción activa”**, aunque la meta acaba de crearse y no existe ninguna reserva anterior.
**Esperado:** no mostrar ese selector, o mostrar “Sin reserva existente”.

**Impacto:** parece que la app perdió una selección o que hay un dato inválido. Una novata puede abandonar la reserva por miedo a romper algo. La reserva finalmente funcionó al elegir cuenta e importe.

**Causa probable:** el selector recibe el valor por defecto `"0"` y el componente de selección lo trata como una selección guardada no disponible (`ui/components.js:202`).

**Evidencia:** `shots/68-form-reserva.png`.

---

### 6.5 Fricción — “Agregar tarjeta” desaparece de Deudas cuando ya hay una deuda (severidad media)

**Ruta reproducida:** Deudas vacía → “Agregar tarjeta” visible. Luego registrar “Préstamo de mamá”. Volver a Deudas: ya no hay “Agregar tarjeta”; solo el botón “+” con `aria-label="Agregar deuda"`. La tarjeta se puede crear desde **Cuentas → pestaña Crédito → Agregar tarjeta**.

**Impacto:** una novata que ya tiene un préstamo y quiere agregar su tarjeta no encuentra el camino donde lo vio por primera vez. Es un problema de descubrimiento, no un bloqueo: la función existe en otra pantalla.

**Evidencia:** `shots/31-deudas-con-prestamo.png`, `shots/32-deudas-botones.png`, `shots/36-credito-vacio.png`, `shots/37-form-tarjeta.png`.

---

### 6.6 Fricción — resumen de deuda ambiguo (severidad media)

**Ruta:** Deudas con el préstamo de $4,000 y la tarjeta con saldo $8,799.90.

**Actual:** “1 préstamo · 1 tarjeta · **$3,799.90 en compras** · 1 sin cuota”. El total mostrado es $12,799.90, pero los elementos visibles no explican que $3,799.90 es solo el saldo sin MSI de la tarjeta, no una deuda adicional.

**Impacto:** una usuaria puede pensar que le están sumando dos veces la tarjeta o que falta dinero. El desglose de la tarjeta sí aclara “Saldo anterior sin MSI $2,500 + Audífonos $1,299.90 + MSI $1,000”, pero hay que abrirlo.

**Evidencia:** `shots/45-deudas-tras-compra.png`, `shots/93-detalle-tarjeta2.png`.

---

### 6.7 Observación no confirmada — fechas de MSI vs. día de pago de tarjeta (severidad a revisar)

Al crear la tarjeta indiqué:

- Vencimiento del saldo sin MSI: **5 dic 2026**
- Primera mensualidad MSI: **20 nov 2026**
- Día de pago de la mensualidad: **5**

Después del alta, Deudas mostró **“próximo 5 nov”** para la cuota MSI. Tras pagar la cuota 1, el siguiente periodo apareció el **5 dic** y el desglose mostró cuota 2 el 5 dic, cuota 3 el 5 ene, etc. La app explica que “los MSI conservan su calendario”, pero no pude determinar si el 5 nov fue una estimación correcta del ciclo de la tarjeta o si se ignoró la fecha de primera mensualidad del 20 nov.

**No lo marco como bug confirmado** porque no repetí el alta en un libro limpio ni comparé con el estado de cuenta real. Lo dejo como caso a revisar con una prueba específica de fechas.

**Evidencia:** `shots/40-tarjeta-guardada.png`, `shots/46-form-pago-tarjeta.png`, `shots/93-detalle-tarjeta2.png`.

---

### 6.8 Bug menor — formato inconsistente en el aviso de saldo insuficiente (severidad baja)

**Ruta:** Nuevo gasto → “Intento saldo insuficiente”, $5,000.00 desde Hey débito ($712.65).

**Actual:** “Faltan **4287.35 MXN** disponibles. Abre Cuentas para liberar reservas o cajitas, o corregir el saldo.”
**Esperado:** usar el mismo formato monetario del resto de la app, por ejemplo “Faltan $4,287.35 MXN disponibles”.

**Impacto:** no impide entender el error, pero rompe la consistencia y se siente más técnico. El bloqueo sí funciona: no se creó el gasto y el formulario conservó el borrador.

**Evidencia:** `shots/82-saldo-insuficiente.png`.

---

### 6.9 Fricción menor — el detalle de un gasto no muestra la categoría (severidad baja)

**Ruta:** Movimientos → “Súper de la semana”.

**Actual:** el detalle muestra importe, tipo, fecha y origen, pero no la categoría “Súper”.
**Impacto:** una novata no puede confirmar desde el detalle si clasificó bien el gasto. La categoría sí se creó y quedó disponible en formularios posteriores.

**Evidencia:** `shots/94-detalle-gasto-categoria.png`.

---

### 6.10 Fricción menor — mensaje genérico para importe cero (severidad baja)

Con importe `0`, el aviso fue “Revisa concepto, importe y fecha real.”; con `abc`, el aviso fue específico: “Escribe un importe válido con hasta dos decimales…”. El mensaje de cero es correcto pero poco accionable; conviene decir “El importe debe ser mayor que cero”.

**Evidencia:** `shots/90-importe-cero.png`, `shots/91-importe-abc.png`.

---

## 7. Dificultades de navegación y lenguaje

### 7.1 Rutas que costaron

1. **Agregar tarjeta después de una deuda:** Deudas no lo muestra; está en Cuentas → Crédito. Es la fricción más importante de la prueba.
2. **Corregir un pago de tarjeta:** Movimientos → pago → Editar solo ofrece “Revertir movimiento”; hay que confirmar la reversión y volver a pagar. El texto lo explica, pero no es el “editar” que una espera.
3. **Corregir un cobro:** el botón “Corregir” está en la fila de la entrada de dinero, no en un menú de la deuda.
4. **Reservar en una meta:** el botón se llama “Reservar / liberar” y el formulario muestra un selector de “Reserva existente” que parece roto en una meta nueva.
5. **Pagar una suscripción:** desde Inicio se ve “Pagar” en la fila de pagos, pero para una suscripción concreta tuve que ir al Calendario y usar el botón de la fila.
6. **Entender el pago de tarjeta de diciembre:** $4,799.90 no coincide con la cuota MSI de $1,000; incluye el saldo sin MSI del periodo. El desglose lo aclara, pero el número grande asusta.

### 7.2 Palabras técnicas que una novata probablemente no domina

- **MSI / meses sin intereses** (se usa mucho y se explica solo en algunos lugares).
- **Saldo sin MSI** (especialmente “Vencimiento del saldo sin MSI”).
- **Crédito revolvente**.
- **Diferimiento / pago diferido**.
- **Conciliar / cargos pendientes de asignar**.
- **Acreedores**.
- **Abonar sin asignar**.
- **Cajitas** (aparece en el aviso de saldo insuficiente sin haber visto antes ese concepto).
- **“Libro”** (“Libro iniciado” en el toast de arranque).

No es que estén mal, pero para el rol probado varias etiquetas requieren inferir su significado. La app suele dar buenas notas explicativas; el problema es que algunas aparecen después de que ya tomaste una decisión.

---

## 8. Cosas que funcionaron bien

- El onboarding explica que el saldo inicial **no es un ingreso** y que el ingreso previsto **no aumenta el dinero**. Eso evita un error clásico.
- El botón “Deshacer” en los toasts y la confirmación al revertir un movimiento dan red de seguridad.
- El borrador se conserva al cerrar y se recupera tras recargar, con un aviso explícito de que no se ha guardado como movimiento.
- El bloqueo por saldo insuficiente no crea movimientos y conserva el formulario.
- La creación inline de cuenta y categoría funciona y advierte que se guardarán junto con el formulario.
- La tarjeta separa correctamente dinero propio, crédito disponible y MSI.
- El pago parcial de una deuda y la corrección de un cobro actualizan saldo, deuda y movimiento vinculado sin descuadrar.
- La exportación produce un JSON con formato/version/state y la recarga mantiene los datos.
- Los iconos importantes tienen `aria-label` (“Ajustes”, “Agregar cuenta”, “Agregar tarjeta”, etc.).

---

## 9. Errores JavaScript

**Ninguno de la aplicación.**

- `pageerror`: 0.
- `console.error`: 0.
- Diálogos nativos (`alert`/`confirm`/`prompt`): 0.
- Los únicos fallos fueron de mi automatización: un `selectOption` con expresión regular no soportada, un `getByRole("button")` que debía ser `role=tab` y una etiqueta `Mensualidad` que coincidía con cinco campos. Corregidos en los scripts; no son defectos del producto.

No vi pantallas en blanco, excepciones silenciosas ni datos que desaparecieran sin aviso.

---

## 10. Límites de la prueba

- No usé un teléfono Android físico ni la app instalada; probé la vista previa web en Chromium móvil. Los flujos de descarga, notificaciones y selector de archivos de Android pueden comportarse distinto.
- No probé **importar** un respaldo, solo exportarlo. Tampoco probé restauración tras desinstalar.
- No probé notificaciones/recordatorios, modo offline, multi-dispositivo, sincronización ni varios usuarios.
- No probé todos los tipos de deuda (solo “sin plazo fijo”), todas las periodicidades de gasto fijo ni todos los métodos de pago.
- La prueba se hizo en una sola sesión/perfil y con una sola moneda (MXN), en el contexto de noviembre de 2026.
- No hice una auditoría de accesibilidad con lector de pantalla; solo revisé nombres accesibles visibles y el DOM.
- No repetí el alta de tarjeta en un libro limpio para confirmar la observación de fechas MSI (6.7).
- El backup exportado es un artefacto temporal en `/tmp`; no se agregó al repositorio.

---

## 11. Recomendaciones priorizadas

1. **Corregir el aviso invertido del inicio** (`home.js:55`): cuando hay reservas debe decir que existen y cuánto; cuando no, “Dinero propio, no crédito”. Es el defecto más visible porque contradice una cifra de dinero.
2. **Hacer visible “Agregar tarjeta” en Deudas siempre**, no solo en el estado vacío. Si se quiere mantener en Cuentas → Crédito, agregar un enlace directo desde Deudas y desde el botón “+”.
3. **Aclarar el resumen de deuda**: separar explícitamente “tarjeta: saldo sin MSI” y “MSI pendientes”, y evitar que “$3,799.90 en compras” parezca una deuda adicional.
4. **Quitar el selector “Reserva existente” en metas nuevas** o mostrar “Sin reserva existente”. No usar el fallback de “Selección anterior” cuando el valor es el centinela `0`. (Corregido y comprobado en §13.)
5. **Revisar la relación entre primera mensualidad MSI, día de pago y vencimiento del saldo sin MSI** con un caso de fechas controlado.
6. **Unificar pluralización** (“1 movimiento”, “1 meta”, “1 deuda”) y el formato monetario de los avisos (“$4,287.35”). (Corregido y comprobado en §13.)
7. **Mostrar la categoría en el detalle del gasto** para que se pueda verificar la clasificación. (Corregido y comprobado en §13.)
8. **Mejorar el mensaje de importe cero**: “El importe debe ser mayor que cero” en lugar de “Revisa concepto, importe y fecha real”. (Corregido y comprobado en §13.)
9. **Agregar un glosario contextual breve** para MSI, revolvente, conciliar y “abonar sin asignar”, o usar una etiqueta más llana con la explicación en el mismo lugar. (Se aclararon etiquetas principales; aún queda vocabulario técnico en otras pantallas.)
10. **Añadir pruebas de regresión de textos/estado** para el aviso de reservas, pluralización y el selector de reserva nueva; son defectos fáciles de detectar con snapshots de UI. (Incluidas en `tests/user-feedback-ui.test.mjs`.)

---

## 12. Conclusión

La app **sí permite** completar un libro personal realista sin leer manuales: cuentas, sueldo, compras, transferencias, renta, suscripción, deuda, tarjeta con MSI, compra a crédito, pago, préstamo, cobro, meta, calendario, borrador, validaciones y respaldo. El dinero cuadró en todos los cortes y no encontré doble descuento.

Pero **no la describiría como “intuitiva” a partir de esta prueba**. La primera vez costó encontrar la tarjeta de crédito cuando ya existía otra deuda, entender que “Editar” un pago solo permite revertir, interpretar el resumen de la deuda y pasar el selector extraño de “Reserva existente”. Los defectos de texto/estado (especialmente “Sin reservas ni dinero congelado” con una reserva activa) son fáciles de corregir y tienen alto impacto percibido porque contradicen cifras de dinero.

**Lo que más me costó:** encontrar “Agregar tarjeta”; entender el pago de tarjeta de diciembre; corregir un pago (revertir y recapturar); y confiar en el formulario de reserva de una meta nueva.

**Lo que mejor funcionó:** el onboarding con advertencias de saldo inicial, el borrador recuperable, el bloqueo por saldo insuficiente, la reversión con confirmación y la separación entre dinero propio y crédito.

**Evidencia temporal:** `/tmp/opencode/melange-user-test/shots/` (96 capturas), `/tmp/opencode/melange-user-test/final-Melange-2026-11-02.json` y scripts en `/tmp/opencode/melange-user-test/`.

---

## 13. Recomprobación tras correcciones

**Fecha de recomprobación:** 2 de noviembre de 2026.
**Alcance:** verificación puntual por UI, no un recorrido completo. Mismo perfil aislado y mismo libro ficticio; servidor local reiniciado con los assets actualizados. No leí código de la app ni `tests/user-feedback-ui.test.mjs` durante esta fase. No modifiqué app, tests ni `package.json`.

**Método:** abrí la app en el mismo perfil de Chromium móvil, navegué por las rutas visibles y comprobé los textos, formularios y saldos. Guardé 18 capturas adicionales con prefijo `R` en `/tmp/opencode/melange-user-test/shots/`.

### 13.1 Resultado de los puntos reportados

| Punto original                   | Verificación actual por UI                                                                                                                                                                                                                                         | Estado                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| 6.1 Aviso de reservas invertido  | Inicio muestra “Ya excluye reservas y dinero congelado.” con $1,500 reservados, y la tarjeta de metas indica que están “Reservado en tu meta.”                                                                                                                     | ✅ Corregido           |
| 6.2 “1 metas”                    | Inicio ya no usa el plural incorrecto: “Reservado en tu meta.”                                                                                                                                                                                                     | ✅ Corregido           |
| 6.3 “1 movimientos”              | Al filtrar Movimientos por “Netflix” el resumen dice “1 movimiento”.                                                                                                                                                                                               | ✅ Corregido           |
| 6.4 Selector falso en meta nueva | Creé una meta nueva y abrí “Reservar / liberar”: no aparece selector `allocation` ni el texto “Selección anterior”. Solo se ven Acción, Cuenta e Importe.                                                                                                          | ✅ Corregido           |
| 6.5 “Agregar tarjeta” escondido  | Con el préstamo y la tarjeta ya existentes, Deudas muestra “Agregar tarjeta” de forma visible y abre el formulario “Nueva tarjeta de crédito”.                                                                                                                     | ✅ Corregido           |
| 6.6 Resumen de deuda ambiguo     | Deudas ahora dice qué saldos de compras y mensualidades de tarjeta ya están incluidos en la deuda total, resta pagos aún sin desglose y advierte que no se vuelvan a sumar. La regresión `user-feedback-ui` comprueba el texto actual.                             | ✅ Mejorado            |
| 6.7 Fechas MSI vs. día de pago   | El alta de tarjeta ahora avisa si la primera mensualidad cae después del día límite de pago del mismo mes y pide verificar si inicia el ciclo siguiente. La app no cambia la fecha ni inventa un calendario. Aún falta confirmarlo con un estado de cuenta real.   | ⚠️ Mitigado; confirmar |
| 6.8 Formato del aviso de saldo   | El aviso ahora dice “Faltan **$4,287.35 MXN** disponibles…”, con signo y separador de miles.                                                                                                                                                                       | ✅ Corregido           |
| 6.9 Categoría en el detalle      | El detalle de “Súper de la semana” muestra “Categoría: Súper”.                                                                                                                                                                                                     | ✅ Corregido           |
| 6.10 Mensaje de importe cero     | Con importe 0 el aviso ahora es “El importe debe ser mayor que cero.”                                                                                                                                                                                              | ✅ Corregido           |
| Editar pago de tarjeta           | Movimientos → “Pago de tarjeta: Nu tarjeta” → “Editar” abre directamente “Corregir pago de tarjeta”, con importe, cuenta y fecha editables; ya no muestra “Revertir movimiento”. Guardé una corrección sin cambios y la app respondió “Pago de tarjeta corregido”. | ✅ Corregido           |

### 13.2 Evidencia de la recomprobación

- `R01-inicio-tras-correcciones.png`: Inicio con reserva y textos corregidos.
- `R02`–`R05`: creación de meta de prueba, formulario de reserva sin selector y eliminación de la meta de prueba.
- `R06`–`R07`: Deudas con deuda existente y “Agregar tarjeta” visible; formulario abierto desde ahí.
- `R08`–`R09`: Movimientos y detalle con categoría.
- `R10`–`R17`: corrección directa del pago, guardado sin cambios, avisos de saldo/importe y estado final sin alteraciones de dinero.
- `R18`: comprobación de que el selector de asignación de una meta existente queda dentro de un contenedor `[hidden]`, sin tamaño visible ni texto “Selección anterior”.

### 13.3 Qué sigue costando o merece revisión

1. **La observación de fechas de la primera mensualidad sigue abierta.** El formulario ahora advierte cuando la primera fecha elegida queda después del día límite de pago de ese mes, pero no cambia el cálculo. Requiere contrastar primera mensualidad, día de pago y vencimiento del saldo anterior con un estado de cuenta real.
2. **La reserva nueva ya no menciona asignar reservas antiguas**; el texto sobre reservas antiguas aparece solo cuando hay una pendiente de asignar. La regresión automatizada cubre la meta sin reserva previa.
3. **El lenguaje técnico sigue siendo la principal barrera**, aunque se ampliaron las etiquetas principales: todavía aparecen siglas y vocabulario financiero en pantallas de detalle. La prueba de rol inicial encontró que la explicación puede llegar después de que la usuaria ya tomó la decisión.
4. **El pago de tarjeta de diciembre sigue siendo un número grande que puede asustar** ($4,799.90: saldo de compras + mensualidad). El desglose de deuda ahora explica qué componentes ya están incluidos; interpretar el próximo pago todavía requiere abrir el estado de cuenta.
5. **El resumen cuenta tipos y deudas sin fecha final estimada**, más claro que “sin cuota”, pero sigue siendo una línea densa para una novata.

### 13.4 Estado actual

Los defectos confirmados en la prueba original que fueron corregidos ya no se reproducen por UI. El dinero se mantuvo igual después de la corrección directa del pago: disponible **$32,997.90**, deuda total **$12,799.90**, reservado **$1,500.00** y efectivo **$1,601.25**. No aparecieron errores JavaScript ni diálogos inesperados durante la recomprobación.

**Conclusión de la recomprobación:** las correcciones solicitadas se verificaron en la interfaz y mejoran de forma clara los puntos que más fricción generaban. La app sigue sin ser “intuitiva” para todo el recorrido, sobre todo por el vocabulario financiero y la fecha MSI pendiente de revisar, pero los bloqueos de descubrimiento y los textos contradictorios reportados ya no están presentes.

### 13.5 Copy contextual refinado después de la recomprobación

Tras el repaso se quitó del formulario de una meta nueva la frase sobre asignar reservas antiguas; ahora solo aparece si efectivamente existe una reserva antigua sin cuenta. El formulario explica en lenguaje directo que reservar reduce el disponible y liberar devuelve ese dinero. La tarjeta de Deudas separa compras/saldo anterior de compras a meses y dice que ambos importes ya están incluidos en el total. Inicio reemplaza “Por conciliar” por “Revisar pagos de tarjeta” y explica qué falta para calcular el margen. En la tarjeta se ampliaron las primeras menciones de MSI y se renombró el pago sin desglose para explicar qué hace. Deudas, la ruta de pagos a meses y Ajustes usan etiquetas más descriptivas para crédito sin plazo y acreedores. El alta de tarjeta advierte si la primera mensualidad seleccionada queda después del día límite de pago de ese mes. Los avisos de fondos ya no dependen de entender la palabra “cajitas”.

`tests/user-feedback-ui.test.mjs` comprueba estos textos y rutas: meta sin selección residual, aviso de reserva, plural, categoría, mensaje de importe cero y fondos insuficientes, desglose total, acceso a Agregar tarjeta, edición directa del pago y aviso de fecha MSI. Es una regresión automatizada de UI, no un segundo estudio con una persona ni una nueva revisión independiente.
