# Revisión de errores humanos y flujos de tarjeta (Melange 8.6.1), 15 nov 2026

**Pregunta:** si una persona se equivoca (dedazo, cuenta equivocada, algo creado de más, un MSI mal capturado), ¿puede corregirlo o eliminarlo sin inventar movimientos ni deshacer cosas que estaban bien?

**Respuesta corta:**

- **Bien resuelto:** corregir movimientos sueltos (gastos, pagos de fijo, pagos de tarjeta y movimientos de préstamos), eliminar duplicados y metas.
- **Mal resuelto:**
  1. Casi nada creado por error se puede **eliminar**. Cuentas, tarjetas, deudas, fijos, cajitas y préstamos solo se archivan o se quedan como «liquidados».
  2. Las **correcciones se validan como operaciones nuevas**, así que exigen saldo disponible y obligan a inventar ajustes.
  3. Todo lo **vinculado a pagos se bloquea completo**, aunque el campo que se quiere corregir no afecte al dinero.
  4. **Deshacer** solo revierte el último cambio.

**Método.** Recorrido manual en la vista previa a 375 px como usuario nuevo, scripts contra el dominio con un escenario por cada error, y lectura de la UI para saber qué botones existen de verdad. Todo lo que se marca como confirmado se reprodujo.

---

## 1. Publicación de 8.6.1

- **PR y release.** [MardorTC/Melange#2](https://github.com/MardorTC/Melange/pull/2) se mezcló en `main`, y [v8.6.1](https://github.com/MardorTC/Melange/releases/tag/v8.6.1) está publicada como «Latest» con `Melange-8.6.1.apk` y `update.json` (sha256 `9a21beab…`).
- **CI en GitHub no se ejecutó.** GitHub Actions rechazó los jobs porque la cuenta está bloqueada por un problema de facturación («account is locked due to a billing issue»). Para compensar, se ejecutó todo en local:
  - `npm run check` y `npm run test:ui`;
  - pruebas JVM y lint;
  - la suite instrumentada completa (4 pruebas) en el emulador de Android 8 (API 26).
- **Actualización firmada 8.6.0 → 8.6.1 en el emulador**, con un libro de 2.86 MB (900 movimientos y 15 copias de Deshacer): Android aceptó la actualización y el libro quedó idéntico. El emulador de API 35 no está instalado.
- **Hallazgo nuevo, anterior a 8.6.1.** El WebView de esa imagen de Android 8 es la versión 69, que no entiende `?.`, así que la app queda **en pantalla blanca sin explicar nada**. La 8.6.0 tiene el mismo código. Un teléfono con Android 8 y WebView sin actualizar vería lo mismo. Recomendación: en `index.html`, un script clásico (sin sintaxis moderna) que detecte el fallo de carga y diga «Actualiza Android System WebView desde Play Store».

## 2. Tarjetas de crédito y MSI: de dónde viene la resistencia

### 2.1 Lo que pasa hoy (confirmado)

Caso de prueba: el banco dice que debes $12,000, de los cuales $6,000 son lo que falta de una laptop a 12 MSI de $1,000 con 6 pagadas.

| Camino                                                                               | Resultado                                                                                                                                     |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta de tarjeta con total **con** MSI y el MSI dentro del mismo formulario           | ✅ Usado $12,000                                                                                                                              |
| Alta con total **sin** MSI ($6,000) y el MSI en el formulario                        | ❌ Usado $6,000: **se pierden $6,000 en silencio**                                                                                            |
| Alta con total **con** MSI y el MSI vinculado después desde **Deudas → Nueva deuda** | ❌ Usado **$18,000: cuenta doble en silencio**                                                                                                |
| Alta con total **sin** MSI y el MSI después desde Deudas                             | ✅ $12,000. Es justo lo que describe el dueño: «poner lo que debes sin contar MSI»                                                            |
| Agregar un MSI después desde **Editar tarjeta**                                      | ⚠️ Rechaza con «El saldo total no puede ser menor que los MSI…» hasta que el usuario **recalcula y reescribe el total a mano** (540 + 12,000) |

**La causa raíz** es que hay dos caminos con reglas opuestas. El formulario de tarjeta **descuenta** el MSI del total, y Deudas lo **suma**. Según por dónde entres, la misma información produce tres saldos distintos y la app nunca avisa. Encima:

1. **«Saldo total que debes hoy» no coincide con ninguna cifra impresa del estado de cuenta.** El banco imprime «saldo al corte», «pago para no generar intereses» y «saldo deudor total».
2. **Pide datos calculados en lugar de los impresos.** El banco dice «Pago 4 de 12 · $500»; la app pide saldo pendiente, pagadas antes, fecha de la primera mensualidad y día de pago. Si «pagadas antes» se queda en 0 (en Deudas está escondido en «Más detalles»), aparecen **vencidos falsos** de meses que ya pasaron.
3. **Una compra nueva a meses no tiene lugar natural.** «Nuevo gasto» con tarjeta no tiene «¿a meses?» y manda a Deudas. Con los valores por omisión de Deudas (primera cuota hoy, día 1), la compra de hoy nace «vencida» y no cuenta como consumo.
4. **Valores y textos distintos para lo mismo** en los dos formularios de MSI: plazo 12 frente a 0, día 5 frente a 1, «Mensualidad» frente a «Cuota mensual». El «Día de pago de la mensualidad» se ignora en un MSI vinculado, porque manda el día de pago de la tarjeta.
5. **Un precio exacto, como $4,000 a 12 meses ($333.33), se rechaza** porque 12 × 333.33 no alcanza.
6. **Con un pago sin desglose por todo, el usado queda en $0 aunque el MSI siga vivo**, y entonces la tarjeta **se puede archivar** con MSI pendiente.

### 2.2 Flujos propuestos

**A. Una sola forma de capturar un MSI: «Asociar compra a meses».**

- Se abre desde la tarjeta; desde Deudas → MSI se abre el mismo formulario.
- Pide lo que imprime el banco: nombre, «Pago **4** de **12**», mensualidad $500 y «¿Ya pagaste el estado de cuenta que trae el pago 4?» (No por defecto).
- La app calcula pagadas, saldo pendiente y fecha de inicio. No hay día de pago propio: usa el de la tarjeta.
- Pregunta una sola cosa: **«¿Esta compra ya está incluida en el saldo que registraste de la tarjeta?»**
  - **Sí:** se descuenta del saldo anterior. Si no alcanza, ofrece «Actualizo el saldo total a $X».
  - **No:** se suma.
  - Nunca resta ni duplica en silencio.

**B. Alta de tarjeta en dos pasos sin restas.**

- **Paso 1:** nombre, límite, corte y pago.
- **Paso 2:** «¿Qué cifra tienes a la mano?»:
  - **Saldo deudor total**, la opción recomendada, con una nota de dónde aparece en el estado de cuenta;
  - **Saldo al corte o pago para no generar intereses**;
  - **Empiezo en $0**.
- La fecha límite del saldo anterior se **calcula** con corte y pago, en lugar de usar hoy.
- Si el total incluye MSI que aún no se capturan, la diferencia queda como **«MSI por asociar»**: ocupa crédito pero no genera pagos. La tarjeta muestra «$5,000 en compras a meses por asociar · Asociar» hasta que se completen con el flujo A.

**C. «Nuevo gasto» con tarjeta y casilla «¿A meses?».**

- Botones de plazo (3, 6, 9, 12, 18, 24), mensualidad calculada (redondeada hacia arriba) y «Primera mensualidad: en el próximo estado de cuenta / en el siguiente».
- Se crea el MSI vinculado con su primera fecha bien calculada, y **cuenta como consumo** en la fecha y categoría de la compra. Eso cierra la limitación documentada de que los MSI no aparecen en la dona.

**D. Quitar un MSI desde la tarjeta.**

- Pregunta «¿Lo liquidaste por fuera o fue un error?».
  - **Error:** desaparece sin tocar el saldo de compras.
  - **Liquidado:** baja el usado.
- **Archivar** la tarjeta exige usado en 0 **y** ningún MSI con saldo.

**E. Pago sin desglose.**

- Opción por defecto «Aplicar en el orden del estado de cuenta».
- «Indicar a qué cargos van los pagos» queda solo para excepciones.

### 2.3 Plan por fases

| Fase | Contenido                                                                                                                                                                                                                                                                                                                                                                                  | Impacto en datos                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 0    | Mismos textos y valores por omisión en los dos formularios de MSI. «Pagadas antes» siempre visible si hay tarjeta. Fecha del saldo anterior calculada. Ocultar el día de pago del MSI vinculado. Aceptar mensualidades redondeadas. Bloquear archivar con MSI vivos. Avisar cuando un MSI vinculado desde Deudas ya parece incluido en el total («¿Ya estaba en el saldo de la tarjeta?»). | Ninguno                                                                        |
| 1    | Función de dominio única `linkCardInstallment(card, {nombre, número actual, plazo, mensualidad, ¿pagado el periodo?, ¿incluido en el saldo?})` que usen tarjeta y Deudas. Es el flujo A.                                                                                                                                                                                                   | Ninguno (reusa campos actuales)                                                |
| 2    | «MSI por asociar» en la tarjeta (flujo B).                                                                                                                                                                                                                                                                                                                                                 | Campo nuevo opcional en la tarjeta; conviene esquema v11 con migración trivial |
| 3    | «¿A meses?» en Nuevo gasto (flujo C), con consumo por fecha de compra.                                                                                                                                                                                                                                                                                                                     | Campos opcionales `purchaseDate` y `categoryId` en la deuda                    |
| 4    | Quitar MSI y el pago sin desglose por defecto (flujos D y E).                                                                                                                                                                                                                                                                                                                              | Ninguno                                                                        |

## 3. Corregir y eliminar: matriz

✅ se puede · ⚠️ se puede pero duele · ❌ no se puede. Las referencias a archivos son de `app/src/main/assets/js/`.

| Entidad                | Editar                                                                             | Cambiar tipo                                       | Eliminar si fue error                                               | Archivar                            |
| ---------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| Cuenta                 | ✅ nombre (permite repetidos). ⚠️ el saldo solo cambia con un ajuste fechado hoy   | ❌ si el saldo inicial no es 0                     | ❌                                                                  | ✅ con saldo 0                      |
| Saldo inicial del alta | ⚠️ solo con un ajuste que queda en Movimientos y en la gráfica                     | —                                                  | —                                                                   | —                                   |
| Tarjeta                | ✅ nombre y límite. ⚠️ el corte y el día de pago no recalculan compras registradas | —                                                  | ❌                                                                  | ✅ (también con MSI vivos: defecto) |
| MSI vinculado          | ✅ sin pagos. ⚠️ con un pago, **solo el nombre**                                   | ⚠️                                                 | ❌ («Quitar» solo existe para filas nuevas)                         | ❌                                  |
| Deuda                  | ✅ nombre, saldo y cuota. ⚠️ plazo e inicio bloqueados con pagos                   | ⚠️                                                 | ❌ la papelera exige saldo 0, y con 0 desaparece: queda «Liquidada» | ❌                                  |
| Fijo / suscripción     | ✅ con «aplicar desde»                                                             | ✅ fijo ↔ suscripción                             | ❌ solo «Dejar de usar», y deja su vencimiento del mes pendiente    | ⚠️                                  |
| Pago de fijo           | ✅                                                                                 | ⚠️ moverlo a otro vencimiento = revertir y repagar | ✅                                                                  | —                                   |
| Pago de cuota / abono  | ❌ solo revertir y registrar de nuevo                                              | ❌                                                 | ✅                                                                  | —                                   |
| Pago de tarjeta        | ✅ importe, fecha, cuenta y reasignar. ❌ cambiar de tarjeta                       | —                                                  | ✅                                                                  | —                                   |
| Compra con tarjeta     | ✅ si ningún pago la cubre. ❌ **si está cubierta, ni el nombre ni la categoría**  | ⚠️ pasarla a MSI: 4–6 pasos                        | ⚠️                                                                  | —                                   |
| Gasto                  | ✅ incluso pasarlo a tarjeta                                                       | ❌ (el formulario fija el tipo)                    | ✅                                                                  | —                                   |
| Ingreso                | ⚠️ bajar el importe se bloquea si ya se gastó                                      | ❌                                                 | ⚠️ mismo bloqueo                                                    | —                                   |
| Ajuste                 | ❌                                                                                 | ❌                                                 | ⚠️ un ajuste positivo exige fondos                                  | —                                   |
| Meta y reserva         | ✅                                                                                 | —                                                  | ✅                                                                  | —                                   |
| Cajita                 | ❌ ni nombre, ni importe, ni fecha                                                 | —                                                  | ❌ solo «liberar»; queda «Liberada $0» para siempre                 | ❌                                  |
| Préstamo que me deben  | ✅                                                                                 | ⚠️                                                 | ❌ queda «Recuperado $0»                                            | ❌                                  |
| Categoría              | ✅                                                                                 | —                                                  | ⚠️ sin fusionar; con 12 gastos hay que hacer 12 ediciones           | —                                   |
| Deshacer               | ⚠️ solo el último cambio, máximo 15, con etiquetas genéricas                       |                                                    |                                                                     |                                     |

## 4. Problemas más probables por error humano (confirmados)

Ordenados por probabilidad × gravedad.

1. **Un ingreso con un cero de más no se puede arreglar si ya gastaste parte.**
   - Ingreso de $10,000 (eran $1,000) y después un gasto de $5,000.
   - Editarlo a $1,000 da «El cambio utilizaría dinero reservado…».
   - Eliminarlo da «Faltan $5,000».
   - Ni siquiera un ajuste previo lo desbloquea. Lo agrava el «0» precargado que se concatena al escribir.
2. **El saldo inicial con un dedazo** ($15,000 en vez de $1,500) solo se «corrige» con un ajuste de -$13,500 que queda en Movimientos y en la gráfica de liquidez. El saldo inicial real no se puede editar.
3. **Una compra con tarjeta ya cubierta por un pago no deja cambiar ni la categoría ni el nombre** («Revierte primero los pagos que cubren esta compra»). Un pago de fijo con tarjeta sí lo permite.
4. **Un MSI mal capturado con un pago ya hecho** (12 × $1,000 en vez de 18 × $800) solo deja cambiar el nombre. La salida no destructiva existe pero nadie la anuncia: reasignar cada pago a «sin asignar», editar y volver a aplicar. Con 2 pagos son 5 operaciones.
5. **Una deuda o un MSI creado por error nunca desaparece.** Para usar la papelera hay que poner el saldo en 0, y entonces la papelera desaparece y la deuda queda en «Liquidadas», como si se hubiera pagado.
6. **Deshacer solo revierte el último cambio.** Si el error fue hace 3 cambios, se pierden los 2 buenos de después, y el historial («Movimiento registrado» ×N) no dice qué fue cada uno.
7. **Un fijo creado por error y archivado** con «Dejar de usar» sigue dejando su vencimiento del mes como pendiente, en Inicio, en el margen y en los recordatorios. La salida está escondida en Editar → Estado + «Aplicar cambios desde».
8. **Una cuenta creada por error no se elimina:** queda «Cuentas archivadas (1)» para siempre. Si después creas otra con el mismo nombre, el filtro muestra «Banamex / Banamex».
9. **Una cajita con el monto o la fecha equivocados** no se puede editar ni eliminar. Una liberación hecha por error no se puede revertir, salvo con Deshacer si fue lo último.
10. **El tipo de un movimiento no se puede cambiar** (gasto ↔ ingreso, gasto suelto ↔ pago de fijo). Siempre hay que borrar y registrar de nuevo, y borrar un ingreso puede estar bloqueado (punto 1).
11. **Los pagos de cuota, los abonos y los ajustes no se editan.** Un ajuste de +$50,000 con un cero de más, ya gastado en parte, solo se compensa con otro ajuste de -$45,000.
12. **Corregir el día de corte no reubica las compras ya registradas.** Hay que editarlas una a una, y las cubiertas están bloqueadas (punto 3).
13. **Pasar a MSI una compra que se registró como normal** choca con tres errores distintos según el orden en que se intente, el primero «Saldo de tarjeta inválido.» sin pista.
14. **El tipo de cuenta no se puede cambiar si el saldo inicial no es 0**, aunque la cuenta tenga un minuto de creada. Una cuenta bancaria creada como vales exige dos ajustes falsos.
15. **Un préstamo por cobrar creado por error** queda «Recuperado $0»; no hay eliminar.
16. **Las opciones de la tarjeta** («Registrar pago sin desglose», «Indicar a qué cargos», «Archivar») **solo existen en Cuentas → Crédito.** Desde Deudas, la misma tarjeta solo ofrece Pagar y el desglose.
17. **Mensajes sin siguiente paso:** «Saldo de tarjeta inválido.», «…dejaría un saldo insuficiente.» (sin cuenta ni importe), «Revierte primero los cobros asociados» (engañoso cuando la salida es otra) y «El saldo total no puede ser menor que los MSI…» (no dice qué cifra poner).
18. **Detalles:** «1 compras a meses»; la edición de cuentas permite dos «Efectivo».

## 5. Modelo propuesto para corregir y eliminar

1. **Dos verbos en toda la app.**
   - **«Eliminar (fue un error)»** para cualquier cosa. Calcula la cascada (movimientos, aplicaciones de pago, cuotas y presupuestos) y la muestra antes de confirmar, por ejemplo: «Se quitarán 2 pagos · BBVA +$2,000 · se reabre la cuota 3». Se guarda como un solo cambio que se puede deshacer.
   - **«Ya no aplica / Archivar»**: detiene lo futuro y pregunta qué hacer con lo vencido sin pagar.
2. **Corregir no es registrar de nuevo.** Al editar o eliminar algo del pasado no se aplica la regla de «necesitas disponible». Se muestra un aviso con el efecto («BBVA quedará en -$4,000. ¿Corregir de todos modos?»). Los bloqueos quedan solo para lo imposible: reservas mayores que el saldo, o pagos mayores que el cargo.
3. **Editar cualquier movimiento en su lugar**, incluido cambiar el tipo y volver a vincular a un vencimiento. Los pagos de cuota, abonos y ajustes se editan igual que hoy un pago de fijo.
4. **Bloquear por campo, no por movimiento.** En una compra cubierta, nombre, categoría y fecha dentro del mismo periodo se editan libremente. Si cambian el importe o la tarjeta, el excedente pasa a «sin asignar» con aviso.
5. **Corregir planes con historia.** MSI y deudas con pagos: «aplicar desde la cuota N», recalculando lo pagado con los pagos reales. Tarjeta: «recalcular las compras sin pagar con el nuevo corte», con vista previa.
6. **Saldo inicial editable de verdad**, con la fecha de apertura, mostrando el efecto en el saldo de hoy y sin ajustes artificiales. Aplica a cuentas y a la tarjeta.
7. **Historial útil.**
   - Etiquetas con contenido: «Gasto “Renta” $8,000 eliminado».
   - Deshacer un cambio concreto cuando no choque con cambios posteriores; si choca, decir con cuáles.
   - Papelera de 30 días.
   - Guardar el historial como operaciones y no como 15 copias completas del libro, lo que también reduce el problema de tamaño corregido en 8.6.1.
8. **Cada error con su siguiente paso como botón**, por ejemplo: «Cubierta por el pago del 5 nov · [Mover a sin asignar y editar]».

## 6. Orden sugerido

| #   | Trabajo                                                                                                                 | Por qué primero                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | **Fase 0 de tarjeta + MSI** y bloquear el doble conteo en Deudas                                                        | Hoy produce saldos incorrectos en silencio; es barato               |
| 2   | **«Corregir no es registrar»** (punto 5.2) para ingresos, transferencias y ajustes, e importes sin «0» precargado       | Error humano más común y sin salida limpia                          |
| 3   | **«Eliminar (fue un error)»** con vista previa para cuenta, tarjeta, deuda/MSI, fijo, cajita y préstamo                 | Cierra la mayoría de los ❌ de la matriz                            |
| 4   | **Flujo A** (asociar MSI con «Pago X de N») y **flujo C** («¿A meses?» en Nuevo gasto)                                  | Es la resistencia que nota el dueño                                 |
| 5   | **Editar pagos de cuota, abonos y ajustes**, cambiar tipo de movimiento, bloquear por campo en compras cubiertas        | Quita los «revierte y vuelve a registrar»                           |
| 6   | **Planes con historia** (MSI/deuda «desde la cuota N», recalcular compras al cambiar el corte) y saldo inicial editable | Más trabajo de dominio                                              |
| 7   | **Historial por operaciones** con deshacer puntual y papelera                                                           | Cambio de arquitectura; conviene después de estabilizar lo anterior |
| —   | **Aviso de WebView desactualizado** en `index.html`                                                                     | Pequeño, independiente; evita la pantalla en blanco en Android 8    |

## 7. Estado: fase 0 de tarjeta + MSI (rama `feat/tdc-msi-fase0`)

- **Doble conteo resuelto.** Deudas → Nueva deuda con tarjeta pregunta si la compra ya estaba en el saldo de la tarjeta. Con «Sí», `C.absorbIntoCardBalance` la descuenta del saldo anterior; si no alcanza, el mensaje explica las dos opciones. El caso del §2.1 queda en $12,000, no en $18,000.
- **Agregar un MSI después sin restas.** En Editar tarjeta, cada fila nueva pregunta «¿Ya está incluida en el saldo total?». Con «No», `saveCreditCard` suma su saldo al total.
- **Formularios unificados.** Mismas etiquetas para MSI en los dos formularios, «ya pagadas» siempre visible y sin día de pago propio en un MSI vinculado (usa el de la tarjeta). Una compra a meses exige plazo, y el plazo ya no viene precargado en 12.
- **Fechas.** La primera mensualidad por omisión es el próximo pago de la tarjeta, recorrida hacia atrás por las ya pagadas. Un resumen («Siguiente: mensualidad X de N…») muestra el resultado antes de guardar. La fecha del saldo anterior se calcula con `C.lastStatementDueDate`.
- **Redondeo bancario.** Se acepta hasta un centavo de diferencia por mensualidad y la última absorbe el resto (la deuda termina en cero). Si la mensualidad no alcanza, el error dice el mínimo necesario.
- **Archivar.** Una tarjeta con MSI con saldo no se puede archivar.
- **Detalles.** «Saldo anterior» en lugar de «Saldo anterior sin MSI» y «1 compra a meses» en singular.

Pruebas: `tests/card-msi.test.mjs` (6 casos, todos fallan con el código anterior). Se actualizaron las pruebas DOM y de UI que vinculan MSI desde Deudas, que ahora responden la pregunta nueva.

Siguen pendientes las fases 1 a 4: captura «Pago X de N», «MSI por asociar», «¿A meses?» en Nuevo gasto y quitar MSI desde la tarjeta.
