# Revisión general de Melange (8.6.0), 15 nov 2026

Esta revisión cubre lógica, flujos y persistencia; el rediseño visual queda para después. Al final se incluyen las zonas donde el diseño actual hace fallar el flujo.

**Método.** Ejecuté `npm run check` (93 pruebas de dominio y DOM, todas en verde) y `npm run test:ui` (12 suites en Chromium, todas en verde). Además hice pruebas manuales fuera del camino feliz en la vista previa, con un viewport móvil de 375 y 320 px y datos ficticios. Tres revisiones independientes ejecutaron scripts adversariales contra el dominio, la persistencia y los formularios; los scripts están en el scratchpad de la sesión.

**Límites.** No toqué el dispositivo Android conectado. Todo lo que depende del runtime de Android está marcado como **sospechado**. Lo demás se reprodujo, salvo que se indique otra cosa.

Prioridades:

- **P1:** dinero incorrecto, pérdida de datos o flujo bloqueado.
- **P2:** resultado incorrecto pero visible, o fricción fuerte.
- **P3:** detalle menor.

---

## 1. P1: corregir primero

| #   | Problema                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Dónde                                                    | Estado                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 1   | **Un libro mediano puede dejar la app inservible.** Cada guardado escribe una sola fila TEXT con el estado más 15 copias completas para Deshacer, y se lee con `getString` sobre un cursor. El `CursorWindow` de Android mide 2 MB. Con unos 600 movimientos el sobre ocupa unos 2.6 MB. A partir de ahí fallan el arranque, todos los guardados (`write()` llama a `read()`) e incluso `writeRecovery()`, y la única salida es borrar los datos de la app. | `LedgerStore.java:29-31,76,103`, `state/ledger.js:35-38` | Aritmética confirmada; el fallo en Android, sospechado |
| 2   | **Una entrada inválida en Deshacer impide abrir un libro sano.** `migrateEnvelope` valida todo el historial; si una sola entrada falla, el arranque no termina. Basta con que una versión nueva endurezca la validación.                                                                                                                                                                                                                                    | `finance.js:162`, `bootstrap.js:202`                     | Confirmado                                             |
| 3   | **Las transferencias se bloquean por el disponible global.** `requireFunds` usa `min(disponible de la cuenta, disponible global)` también en transferencias, aunque una transferencia no cambia el total. Con efectivo en $5,000 y el banco en -$3,000, transferir $3,000 para cubrir el sobregiro falla con «Faltan $900».                                                                                                                                 | `domain/funds.js:93`                                     | Confirmado en la UI                                    |
| 4   | **«Ajustar saldo» acepta dejar la cuenta por debajo de sus reservas.** Ejemplo: cuenta Ahorro con saldo de $1,000, $8,900 reservados y $4,000 congelados. La meta sigue en 45 % con dinero que no existe, y el disponible de Inicio pasa a -$3,950.                                                                                                                                                                                                         | Cuentas → Ajustar saldo                                  | Confirmado en la UI                                    |
| 5   | **El abono adicional no reduce la deuda si no se llena un segundo campo.** «Reducción del saldo» empieza en 0. Al abonar $100, el dinero sale de la cuenta pero la deuda sigue en $12,000, sin ningún aviso.                                                                                                                                                                                                                                                | `ui/forms.js:651-686`                                    | Confirmado en la UI                                    |
| 6   | **Una cuota de MSI queda marcada como pagada tras revertir un pago de tarjeta que se corrigió.** `syncCardInstallment` deja `legacyPaid=true`, y `reverseTransaction` devuelve el dinero pero no limpia esa marca. La deuda deja de aparecer en pendientes y en recordatorios.                                                                                                                                                                              | `finance.js:1332-1340` frente a `573-597`                | Confirmado (script)                                    |
| 7   | **Los vencimientos de meses anteriores sin pagar desaparecen.** Esto afecta a gastos fijos y estados de cuenta de tarjeta. `obligations()` solo mira el mes actual y el aviso de atraso solo existe para deudas. Inicio infla «Tras cubrir esos pagos».                                                                                                                                                                                                     | `finance.js:365`, `screens/home.js`, `choosePayment`     | Confirmado                                             |
| 8   | **Una deuda eliminada o archivada deja compromisos fantasma en otros meses.** Solo se refresca el presupuesto del mes actual. Si se intenta pagar uno de esos fantasmas, la validación lo rechaza, así que tampoco se puede quitar.                                                                                                                                                                                                                         | `ui/forms.js:534-535`                                    | Confirmado (script)                                    |

## 2. P2: lógica incorrecta

### Deudas y MSI

- **En las deudas sin plazo, la fecha final se adelanta un mes al pagar la cuota del mes.** Una deuda de $12,000 a $1,000 por mes muestra octubre de 2027; al pagar noviembre pasa a septiembre de 2027 (debería seguir en octubre). La estimación siempre arranca en el mes actual, aunque esa cuota ya esté pagada (`debt-plan.js:100-104`).
- **«Fecha de primera cuota» y «Día de vencimiento» se contradicen.** Primera cuota el 15 de noviembre con día 1 genera un vencimiento el 1 de noviembre, anterior a la fecha indicada, y la deuda nace como «Vencida» o «Revisar».
- **Se acepta un MSI sin plazo** (0 cuotas). En el resumen aparece como «1 préstamo».
- **Préstamos con plazo y sin tarjeta:** 3 cuotas de $333.33 sobre $1,000 dejan $0.01 que no se puede liquidar ni archivar. `validateInstallmentPlan` solo se aplica a MSI con tarjeta.
- **Hay tres cifras distintas para «pago de deuda del mes»:** `metrics.debt`, `metrics.pending` y `debtPlan.monthlyPayment`. Inicio y Deudas pueden mostrar números que no cuadran.
- **El pago de una cuota no admite un importe mayor.** Obliga a hacer dos operaciones (cuota más abono adicional). En los gastos fijos el mensaje habla de «Abono adicional», que no existe para fijos. Además, editar el pago sí permite subirlo, así que crear y editar se contradicen.
- **Las deudas no se pueden eliminar ni archivar desde la UI.** La papelera solo aparece cuando hay saldo, y con saldo el borrado siempre se rechaza. Hay código muerto en `forms.js:527-531`.

### Tarjetas

- **La «fecha límite de compras y saldo anterior» se precarga con la fecha de hoy**, sin importar el día de pago. Con pago el día 28, la tarjeta aparece vencida hoy.
- **`creditDueDate` falla en meses cortos.** Con corte el 28 y pago el 30, el corte de febrero y el de marzo vencen el mismo día (`credit.js:26-35`).
- **`applyCardCredit` no puede aplicar un abono sin asignar a la segunda mensualidad ni a las siguientes**, porque compara el total del MSI con el de una sola cuota. El flujo documentado «Indicar a qué cargos van los pagos» queda bloqueado (`finance.js:500-504`).
- **`editFixedPayment` conserva un `cardDueDate` obsoleto** al cambiar la fecha con la misma tarjeta, así que el cargo queda en el estado de cuenta equivocado (`finance.js:1421`).
- **Revertir un pago de tarjeta lanza un TypeError** si la deuda no tiene `historicalPaidPayments`, que es el caso de los libros v8 anteriores a 8.3 (`finance.js:1338`).
- **Pagar más de lo que se debe se rechaza con un mensaje genérico** («Revisa la fecha y el importe pendiente»). No existe el concepto de saldo a favor, y un reembolso después de pagar deja `used` negativo.

### Gastos fijos

- **Cambiar el día de un fijo después de pagar el mes duplica el cargo de ese mes**, por ejemplo uno el 5 (pagado) y otro el 20 (pendiente).
- **La categoría elegida al pagar un fijo se ignora** si el fijo ya tiene una.
- **«Dos veces al mes» con los días 30 y 31** genera dos cargos el 29 de febrero y el 30 de abril.

### Cuentas, metas y préstamos

- **No se puede eliminar un ingreso registrado por error** si eso deja la cuenta en negativo. En cambio, el alta inicial y el ajuste de saldo sí permiten saldos negativos.
- **El mensaje «Faltan $X» es incorrecto con cuentas en negativo.** Con la cuenta en -$250.50, al gastar $10 dice «Faltan $10» en lugar de $260.50.
- **Cajita vinculada a meta:** la tarjeta de la cuenta muestra «$8,900 reservado · $4,000 congelado» sobre un saldo de $9,000. Los $4,000 se cuentan en ambas cifras y parece que hay $12,900 bloqueados.
- **Préstamos por cobrar:**
  - Se acepta un vencimiento anterior a la fecha del préstamo.
  - Un préstamo cobrado por completo muestra «Recuperado $0», que se lee como «no se recuperó nada».
  - No se puede archivar.
  - Revertir una entrega no revisa la cronología.
- **La cuenta «debit» está fija como origen por omisión** en unos 10 formularios. Suele ser una cuenta en negativo o archivada, y en ese caso todo formulario nuevo nace con «Selección anterior · no disponible».
- **Un movimiento de una cuenta archivada no se puede corregir**, ni siquiera su nombre.

### Recordatorios y rendimiento

- **`reminders()` recorre todos los vencimientos desde el inicio más antiguo**, hasta 1200 meses atrás. Una renta que empezó en 2020 produce 83 avisos vencidos, y la notificación cuenta todos como «próximos». La documentación habla de 12 meses.
- **Hay funciones O(n²)** (`allocated()` recorre todas las transacciones por cada compra). Con 5,000 movimientos, `reminders` tarda 6 s en escritorio y corre en cada guardado. `cardPaymentTargets` tarda 4 s.

### Persistencia e importación

- **Se aceptan respaldos que después no se pueden guardar.** Un respaldo de hasta 20 MB, multiplicado por el historial de Deshacer, supera el límite de Java al tercer cambio, con el mensaje engañoso «Respaldo demasiado grande».
- **Un `__proto__` en el respaldo cambia el prototipo del libro en memoria** (`actions.js:262`, `Object.assign`). Se demostró la pérdida del historial de liquidez observado.
- **Inyección de HTML en etiquetas.** El nombre de una cuenta va como etiqueta de `input()`/`signedField` sin escapar (`actions.js:222`), y lo mismo pasa con `btn(g.name)` en `accounts.js:68`. La CSP bloquea scripts, pero un `<button data-action>` inyectado desde un respaldo manipulado ejecutaría acciones reales.
- **Exportar con `openOutputStream(uri,"wt")`** vacía el archivo antes de escribir; si la escritura falla, el respaldo anterior se pierde (sospechado).
- **Recreación de la actividad** (modo oscuro, idioma, multiventana): se crea un `LedgerStore` nuevo sin cerrar el anterior, y los guardados pueden competir entre sí. El resultado de un selector puede perderse (sospechado).
- **La recuperación no marca el libro como iniciado.** La pantalla de bienvenida aparece encima de los datos recuperados, y «Empezar» puede sobrescribir los saldos.
- **El filtro de Movimientos se calcula al cargar el módulo.** Si la app queda abierta de un día para otro, lo registrado hoy no aparece.

## 3. Experiencias poco intuitivas

1. **Los importes vienen con un «0» de valor, no de placeholder.** Al escribir, el texto se concatena: «01.234,56», «0abc». Es la fricción más frecuente.
2. **Los errores son genéricos y no dicen qué campo falla:**
   - «Revisa el límite y las fechas de la tarjeta.» (límite 0)
   - «Periodicidad inválida.» (cuando el problema es la fecha final)
   - «Escribe un importe válido…», el mismo texto en formularios con varios importes
   - «Escribe un nombre distinto y un saldo válido para cada cuenta.»

   Además, la validación es secuencial (se corrige un error y aparece otro). El mensaje anterior se queda en pantalla junto a la burbuja nativa del navegador, y el foco va al texto del error, no al campo.

3. **Las fechas aparecen en ISO dentro de los mensajes** («(2026-11-15)»). Los importes tienen dos formatos: «$500.00 MXN» en los errores y «$500» en pantalla.
4. **El mensaje de fecha anterior al saldo inicial** dice «no vuelvas a descontarlo» incluso para cobros, que son entradas de dinero. Las cuentas nuevas no admiten registrar el gasto de ayer.
5. **Los borradores se pierden con cualquier cambio posterior.** El toast promete que se puede recuperar el borrador, pero si se registra otra cosa entre medio solo se puede consultar. Para un alta nueva no hay riesgo de duplicar, así que no hace falta tanta rigidez.
6. **Botones que descartan o ignoran lo escrito sin avisar:**
   - «Omitir» en el alta inicial descarta lo capturado sin confirmar.
   - Escribir el nombre de una «+ Nueva cuenta/categoría» sin pulsar «Agregar» se ignora y el movimiento se registra en la cuenta preseleccionada.
7. **Campos u opciones que no tienen sentido en ese momento:**
   - «Estado: Archivado» al crear un gasto fijo.
   - «Acción» con una sola opción en una meta.
   - «Vincular a meta» cuando no hay metas.
   - Cuenta y fecha en un préstamo «anterior» que se ignoran.
   - «a crédito se agregará al pago de la tarjeta» en el pago de una deuda que no ofrece crédito.
8. **Datos no capturados que se muestran como ceros reales** en el detalle de deuda: «Monto original $0», «Tasa 0 %», «Financiamiento $0».
9. **Movimientos:**
   - Los ajustes no tienen signo y los cobros no llevan «+».
   - Dentro de un día, lo más antiguo aparece primero.
   - El detalle de un ingreso dice «Origen».
   - El borrado se llama «Eliminar», pero confirma «Revertir movimiento… se devolverá el importe a su origen».
   - El historial de cambios muestra «Movimiento registrado» ×N, sin nombre ni importe.
10. **Navegación:**
    - La sub-pestaña «Me deben» se queda fija, así que «Ver deudas» desde Inicio puede caer ahí.
    - Volver sin historial lleva a Calendario (`navigation.js:64`).
    - Cancelar un sub-formulario cierra todo en lugar de volver al detalle.
    - «Volver a este mes» se muestra estando ya en el mes actual.
11. **Lo mismo aparece repetido o en distinto orden en varias pantallas:**
    - Deudas muestra «Agregar tarjeta» y «Agregar», más el «+».
    - «Sin fecha planificada» en Inicio frente a «Sin fecha» en Deudas.
    - «Crédito disponible: $0» aunque no haya tarjetas.
    - «Pagar» y Calendario ordenan los mismos compromisos de forma distinta.
12. **El MSI tiene dos altas incoherentes** (desde Deudas y desde la tarjeta): etiquetas, valores iniciales (día 1 frente a 5, plazo 0 frente a 12), detección de duplicados y errores distintos.
13. **Borrar una categoría que usa un fijo o una cuenta de vales** falla después de confirmar, con un error técnico. Archivar una cuenta o tarjeta también pide confirmar primero y falla después.
14. **El detalle de una cuenta no muestra sus movimientos.**

## 4. Terminología a unificar

| Concepto           | Variantes actuales                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Dinero disponible  | Tu dinero disponible, Disponible libre, Disponible, Disponible para otros usos, liquidez total                 |
| Reserva / cajita   | Reservado, Reservas, Metas de ahorro, Congelado, Cajitas, Dinero congelado                                     |
| Cuota              | Cuota mensual, Mensualidad, Pago habitual, Cuota normal; Número de cuotas / Mensualidades en total             |
| Gasto fijo         | Gasto fijo, Pagos fijos, Fijos y suscripciones, compromiso; Dejar de usar / Dejar de generar cobros / Archivar |
| Eliminar           | Eliminar, Eliminar pago, Revertir, Revertir movimiento                                                         |
| Ajuste             | Ajuste de saldo, Corrección de saldo, Ajustar saldo(s), Corregir saldo                                         |
| Origen             | Pagar desde (incluso en transferencias y préstamos otorgados), Cuenta de origen, Origen                        |
| Abono sin desglose | Abono pendiente de asignar, pagos sin desglose, Importe del abono, Abono aplicado                              |

Recomiendo un glosario corto en `docs/` y una tabla de cadenas compartida.

## 5. Código repetido a consolidar

- **Regla de «cuota pagada».** Hoy hay cinco reglas distintas (`pay`, `payCard`, `applyCardCredit`, `syncCardInstallment`, `reverseTransaction`). Varios P1 y P2 vienen de esta divergencia. Conviene una sola función.
- **Totales de deuda.** `debtBreakdown.total`, `debtPlan.totalBalance`, `metrics.debt` y `plan.monthlyPayment` deberían salir de una sola fuente.
- **`legacy-v7.js` duplica funciones de `finance.js`:** `schedule`, `planned`, `ensureBudget`, `isPaid`, `snapshot`.
- **Fecha de vencimiento de tarjeta y MSI.** Se calcula en tres lugares.
- **Bloque de pago** (importe, origen, fecha y cuenta en línea). Está copiado unas 7 veces; también el selector de categoría con «+ Nueva» (4 veces) y la lógica «diferencia → ajuste» (3 veces).
- **Funciones idénticas o duplicadas:** `kindName`/`kindLabel`, `nameKey` (2 veces), `esc` (2 veces), `monthLong`/`shortMonth`, y `monthIndex`/`monthsBetween` (3 veces).
- **`commit()` y `undo()`** duplican el flujo de escritura. `storage.js` repite cuatro veces la plantilla de IndexedDB.
- **El número de esquema `10`** está fijo en cinco sitios, y `MAX_BACKUP_BYTES` está duplicado entre JS y Java.

## 6. Dónde se rompe el flujo con el diseño actual

- **Importes grandes a 320 px:** «Tras cubrir esos pagos» se parte a mitad del número («$123,463,40 / 0.49»). Conviene `white-space: nowrap` con reducción de tamaño, o un formato compacto.
- **Barra inferior de 6 pestañas a 320 px:** «Movimientos» y «Calendario» quedan apretadas. Considerar 5 pestañas, por ejemplo moviendo Metas dentro de Cuentas.
- **Selectores con «Nombre · $X disponible · uso restringido»:** se truncan con nombres largos (80 caracteres permitidos) y son difíciles de comparar en un `<select>` nativo. Conviene un selector propio con el saldo alineado.
- **El error se muestra al final de hojas largas,** junto a las acciones fijas. Conviene error en línea por campo, con `aria-invalid`.
- **Los diálogos no se apilan:** `modal()` reemplaza el contenido, así que cualquier sub-flujo pierde su contexto. Conviene una pila de hojas.
- **El banner de borrador ocupa mucho espacio** con tres acciones, en hojas que ya son largas.
- **Inicio muestra solo 3 pagos** sin decir cuántos faltan.
- **La tarjeta de cuenta con reservas y cajitas** necesita un desglose visual (barra saldo / reservado / congelado / libre) en lugar de texto que suma dos veces.
- **La Proyección** repite 12 tarjetas casi iguales. Una tabla o lista compacta con los meses que cambian sería más legible.
- **El buscador re-renderiza toda la pantalla en cada tecla** y reemplaza el `<input>`. Probablemente rompe el autocorrector de Gboard (sospechado).

## 7. Documentación desactualizada

- `docs/uso.md` sigue diciendo «Melange 8.5» en las instrucciones de actualización.
- `docs/uso.md` dice «No se utiliza localStorage», pero `backups.js:168,237` lo usa para el estado del último respaldo.
- `docs/uso.md` describe 6 pestañas; `arquitectura.md` habla de «Inicio y las cuatro pestañas principales».
- Recordatorios: la documentación dice «siguientes 12 meses»; el código recorre todo el pasado.

## 8. Lo que está bien (no tocar)

- Los importes se guardan siempre en centavos enteros, sin deriva de punto flotante.
- No hay errores de zona horaria: se probaron 7 zonas con horario de verano y los años 1900–2100.
- El doble envío está protegido: tres clics producen un solo movimiento.
- Deshacer con límite de 15 funciona; un guardado fallido revierte la memoria.
- La importación rechaza ids duplicados, referencias rotas e importes no enteros antes de tocar los datos.
- El puente nativo es seguro: `JSONObject.quote`, origen restringido y CSP. La verificación de actualizaciones también: SHA-256, firmante y protección contra downgrade.
- El HTML de los nombres se escapa en casi todas las pantallas.

## 9. Orden sugerido de trabajo

1. **Almacenamiento:** guardar el historial de Deshacer en filas separadas o como diferencias, y tolerar entradas de historial inválidas (P1 1, 2 y el límite de importación).
2. **`requireFunds`:** no aplicar el disponible global a transferencias entre cuentas libres (P1 3).
3. **Ajustar saldo:** bloquear el ajuste o pedir liberar reservas y cajitas antes (P1 4).
4. **Abono adicional:** que la reducción del saldo sea igual al importe por omisión en el modo «total» (P1 5).
5. **Regla única de cuota pagada:** corrige P1 6, el abono a la mensualidad 2 y el TypeError.
6. **Arrastre de vencimientos atrasados** a Inicio, Pagar y recordatorios, y limpieza de presupuestos al borrar o archivar una deuda (P1 7, 8).
7. **Recordatorios:** limitar a una ventana (hoy − N … +12 meses) e indexar las aplicaciones (`allocated`) para quitar el O(n²).
8. **UX transversal:** campos vacíos con placeholder, errores por campo, fechas y montos localizados, y origen por omisión = última cuenta usada con saldo.

## 10. Estado de las correcciones (rama `fix/revision-p1`)

Los ocho P1 están corregidos, junto con tres P2 que compartían causa. Cada corrección tiene una prueba en `tests/review-fixes.test.mjs` que falla con el código anterior.

| P1  | Corrección                                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `LedgerStore.read()` lee el libro en bloques de 256K caracteres con `substr`. `writeStore` descarta primero las copias de Deshacer más antiguas si el sobre supera 32 MiB. `RecoveryStoreTest` usa una fila de ~5 MB: con el código anterior falla en Android 8 (API 26) con `Couldn't read row 0, col 0 from CursorWindow`, y con el nuevo pasa.                |
| 2   | `migrateEnvelope` descarta la copia inválida y las anteriores a ella, y el arranque lo avisa. El libro actual inválido se sigue rechazando.                                                                                                                                                                                                                      |
| 3   | `requireFunds` acepta `internal`: una transferencia entre cuentas libres solo se limita por la cuenta de origen. «Faltan $X» ahora calcula la diferencia real cuando la cuenta está en negativo.                                                                                                                                                                 |
| 4   | Un ajuste a la baja no puede dejar el saldo por debajo de reservas más cajitas (unión, sin contar dos veces). Sin reservas, el sobregiro sigue permitido.                                                                                                                                                                                                        |
| 5   | Nuevo `C.extraPayment`. Con saldo «total», todo el abono reduce la deuda. En modo «solo capital», el campo es opcional y, si queda vacío, cuenta el importe completo. El importe empieza vacío.                                                                                                                                                                  |
| 6   | `reverseTransaction` vuelve a calcular cada mensualidad con `syncCardInstallment`, lo que también elimina el TypeError. `applyCardCredit` lleva la cuenta de lo aplicado por línea y ya llega a la segunda mensualidad.                                                                                                                                          |
| 7   | `C.overdueObligations` devuelve los impagos de hasta 6 meses atrás, solo de meses con presupuesto y, para fijos nuevos, desde su `createdDate`. Inicio los resta del margen y los anuncia; «Pagar» los lista primero. Los recordatorios cubren esos atrasos y los siguientes 12 meses: en el script de rendimiento con 5,000 movimientos pasaron de 6 s a 0.7 s. |
| 8   | `baseObligations` ignora los compromisos impagos de deudas eliminadas o archivadas, y al borrar o archivar se refrescan todos los presupuestos.                                                                                                                                                                                                                  |

Sigue pendiente todo lo de las secciones 2 a 7 que no aparece arriba.
