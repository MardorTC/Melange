# Guía de uso de Melange

Aplicación instalable para Android 8.0 o posterior, con Android System WebView actualizado. Funciona sin internet, sin cuenta y sin servidor. El APK no contiene datos financieros del propietario ni datos de ejemplo.

## Actualizar ProjectOSP 7.0 a Melange 8.4

1. Exporta un respaldo por precaución; no tendrás que importarlo para actualizar.
2. Abre `Melange-8.4.0.apk` desde Descargas, o selecciónalo desde Ajustes → Instalar actualización.
3. Android debe ofrecer actualizar la app existente. No la desinstales ni borres sus datos.
4. Abre Melange y comprueba tus saldos, movimientos, metas y deudas.

Se conservan el paquete `app.projectosp`, la clave de firma original, SQLite y el formato de respaldo v10. Solo cambian la versión, la identidad visual y las funciones de esta entrega. Si Android no permite actualizar, detente y revisa el mensaje; no desinstales como solución.

Novedades: interfaz móvil rediseñada con cabecera compacta al desplazar, tipografía editorial, iconos de línea, tarjetas de crédito con presencia propia, filtros en hoja inferior, Movimientos agrupados por fecha, Calendario con rejilla de días y Ruta de deudas/Proyección como pantallas de detalle con Volver. El botón Atrás de Android también regresa a la pantalla anterior.

## Inicio desde cero o importación

En una instalación nueva solo hay dos caminos:

1. **Importar respaldo**: elige un archivo de Melange / ProjectOSP y revisa la vista previa antes de reemplazar los datos.
2. **Empezar desde cero**: indica tu efectivo y débito actuales y, si quieres, tu ingreso mensual previsto. Son los saldos de hoy, no un historial. Puedes omitir este paso y corregir los saldos después desde Ajustes.

La app no reconstruye meses anteriores ni crea movimientos históricos automáticamente. Si necesitas conservar lo que ya ocurrió, importa un respaldo. Los datos permanecen en el dispositivo; no se crea una cuenta ni se envía información a un servidor.

Los borradores de reconstrucción de versiones anteriores no forman parte del libro activo y se descartan al abrir esta versión. Exporta un respaldo antes de actualizar si ese borrador todavía te importa.

La gráfica de liquidez muestra las observaciones y los saldos calculados que ya existen en tu libro. No inventa historia para los días sin registros.

## Instalar y migrar desde v6

1. Descarga `Melange-8.4.0.apk` en tu teléfono.
2. Ábrelo desde Archivos / Descargas. Si Android lo solicita, permite instalar aplicaciones desde esa aplicación de archivos o navegador.
3. Abre Melange y elige **Importar respaldo de Melange / ProjectOSP**.
4. Selecciona tu `projectosp-backup.json`. Revisa los saldos y cantidades de registros que muestra la vista previa y pulsa **Importar estos datos**.
5. Comprueba el efectivo, débito y las deudas. No vuelvas a registrar como nuevos los pagos históricos importados.
6. En Ajustes puedes habilitar los recordatorios y conceder el permiso de notificaciones.

La importación es necesaria una sola vez para pasar del navegador a la aplicación Android. El navegador y la aplicación tienen almacenes separados.

## Actualizar después

Obtén el nuevo APK de quien mantiene Melange. En **Ajustes → Instalar actualización → Seleccionar APK**, elígelo y sigue el instalador de Android. También puedes abrir el APK directamente desde Archivos.

El paquete debe conservar `app.projectosp`, tener una versión superior y estar firmado con la **misma clave original**. Android actualiza el programa y mantiene su base de datos. No desinstales para actualizar: desinstalar elimina los datos locales. Exportar un respaldo sigue siendo útil como protección ante pérdida o cambio de teléfono.

En Ajustes → Buscar actualizaciones puedes consultar GitHub Releases y descargar la versión estable. También se consulta al abrir, como máximo una vez al día. Tú decides cuándo descargar e instalar.

## Cambios incluidos

- Interfaz móvil cálida, navegación inferior, tarjetas diferenciadas, acciones con iconos y etiquetas accesibles. **Ajustes** se abre con el engrane de Inicio; al desplazar aparece una barra compacta con el nombre de la pantalla.
- Dona de consumo por categoría y línea de observaciones reales de liquidez; sin generar historia inexistente.
- Pagos completos y parciales de deudas y gastos fijos vinculados a movimientos y al origen del dinero.
- Protección frente al doble registro de una cuota liquidada y guardados simultáneos.
- Separación entre compromiso mensual, pagado y pendiente. Pagar no infla el presupuesto ni reduce artificialmente el indicador deuda/ingreso.
- Registro de ingresos reales, transferencias efectivo/débito y ajustes documentados de saldo.
- Gastos fijos y suscripciones dentro de Gastos; categorías y acreedores en Ajustes.
- Filtros de movimientos por fechas, texto, categoría, origen, tipo e importe.
- Metas de ahorro y fondo de emergencia como reservas del dinero existente.
- Deshacer de los últimos 15 cambios, conservado al cerrar la aplicación.
- Mensajes breves y modales propios, en lugar de `alert()` y `confirm()`.
- Animaciones breves de métricas y navegación, con respeto por la preferencia de movimiento reducido.
- Calendario mensual con rejilla de días, ruta de deudas y proyección de 12 meses.
- Recordatorios locales de Android, incluso sin una pestaña abierta.
- Base local SQLite y guardado en segundo plano con transacción atómica. No se utiliza localStorage.

## Cómo interpretar los números

**Liquidez** es efectivo + débito. Los gastos y pagos nuevos restan; los ingresos suman; las transferencias conservan el total. Si una operación deja una cuenta negativa, ese resultado se muestra: no se recorta a cero.

**Disponible sin reservas** es liquidez menos el dinero asignado a metas. Reservar o liberar dinero no crea un gasto ni altera la liquidez. Las aportaciones no pueden asignar más dinero del disponible sin reservar.

**Libre antes de variables** es ingreso mensual previsto menos compromisos de fijos y deudas del mes. Incluye cuotas pagadas y pendientes. No es un pronóstico del saldo bancario de fin de mes y no incorpora gastos variables futuros que no se han presupuestado.

**Deuda / ingreso previsto** usa los compromisos del mes, no solo lo pendiente. Si no existe un ingreso previsto, se muestra sin dato, no como 0 %.

Los **pagos de deuda** y de tarjeta aparecen en los movimientos y en las salidas de dinero. Se excluyen de la dona de consumo para no contar dos veces una compra y su liquidación. Las compras normales con tarjeta se registran con su tarjeta y cuentan como consumo una vez. Los MSI creados como deuda no se suman a la dona de consumo para evitar duplicados; esa es una limitación conocida de esta versión.

La **variación de liquidez** compara observaciones existentes. No se presenta como ahorro mensual. Los días sin observaciones no se reconstruyen.

El monto de **ingreso previsto** no aumenta el saldo: el ingreso recibido se registra desde Inicio.

## Deudas y financiamiento

Cada deuda permite indicar si su saldo representa el total pendiente (incluye financiamiento) o solo capital. Cuando es solo capital, cada pago pide qué parte reduce ese capital. La tasa anual es informativa: no se generan intereses ni tablas de amortización automáticamente.

Los datos de v6 conservan sus saldos y su comportamiento de total pendiente. Revisa el significado del saldo en las deudas con intereses antes de hacer pagos nuevos. La migración no inventa una separación capital/interés.

Un abono adicional puede reducir saldo sin marcar una cuota concreta ni recalcular el contrato. Los cambios futuros del calendario se realizan explícitamente. El inicio y el número de cuotas se protegen al existir pagos asociados.

Para eliminar o archivar una deuda primero debe quedar en saldo cero; así una obligación pendiente no desaparece de los totales. Si tiene antecedentes, se archiva para conservar sus movimientos. Los gastos fijos también se archivan. Deshacer revierte el cambio completo; revertir un movimiento vinculado devuelve el dinero y reabre el compromiso correspondiente.

## Conservación del respaldo v6

Los saldos importados se usan como punto de partida. Los gastos históricos se conservan como antecedentes y no vuelven a restar dinero. Las cuotas pagadas se mantienen como marcas históricas: v6 no guardaba su fecha real ni el origen del pago. No se crean movimientos falsos para completarlas.

Una importación válida reemplaza el conjunto actual, después de mostrar una vista previa, y conserva el estado previo en Deshacer. Una importación inválida no reemplaza los datos. No se fusionan dos respaldos: esto no es sincronización.

## Recordatorios

Son notificaciones locales, alrededor de las 9:00 según la zona horaria del teléfono. La anticipación se configura entre el mismo día y siete días antes. Android puede retrasar los avisos por ahorro de batería; no se solicita permiso de alarma exacta. Debes conceder permiso de notificaciones en Android 13 o posterior. Forzar la detención de una app puede impedir sus tareas hasta volver a abrirla.

Se prepara una lista de los siguientes 12 meses y se actualiza al abrir o modificar datos. La programación se recupera después de reiniciar o actualizar el teléfono. Las notificaciones muestran un conteo de compromisos, sin importes ni nombres de acreedores.

## Pendiente / límites de esta entrega

- No hay sincronización automática con Google Drive ni Proton Drive. El selector de documentos de Android puede permitir guardar respaldos en proveedores instalados; eso es un respaldo manual.
- La descarga requiere una acción del usuario; no hay instalación silenciosa.
- Puedes tener varias cuentas de efectivo y débito, pero las tarjetas de crédito no son cuentas de dinero: su crédito disponible no forma parte de la liquidez.
- No hay recálculo automático de intereses ni forecast de variables no registradas.
- La base utiliza SQLite para guardar versiones del estado JSON; las consultas y filtros se calculan en memoria. No es todavía un libro mayor con tablas SQL indexadas por movimiento. Se mantienen hasta 15 estados para deshacer; no es almacenamiento ilimitado.
- Las comprobaciones de desarrollo y sus límites se describen en [Verificación](verificacion.md).

## Melange 8: cuentas y disponibilidad

Abre **Cuentas** desde Inicio. Crea cuentas con nombres como BBVA o Banamex, distribuye saldos mediante transferencias y selecciona la cuenta concreta al registrar cada movimiento. Los ajustes corrigen un saldo real sin contarlo como ingreso o gasto. Archivar conserva los antecedentes y requiere dejar saldo y reservas en cero.

Las cuentas normales solo necesitan nombre y tipo. Los vales usan despensa como categoría predeterminada; puedes personalizar las categorías en las opciones avanzadas. Admiten ingresos, gastos compatibles y transferencias desde cuentas libres para distribuir un saldo que ya tenías registrado, sin contarlo como ingreso. No permiten transferencias de salida, préstamos ni pagos de deudas. Un gasto fijo también necesita una categoría compatible.

En **Las huellas de tu dinero**, toca un punto o mueve el selector para consultar su fecha, saldo y variación respecto al registro anterior. **Tu balance del mes** muestra ingresos recibidos, salidas registradas y compromisos pendientes; el margen restante no incluye ingresos futuros.

Una cajita congela dinero sin crear un gasto. Su fecha prevista genera un aviso; pulsa **Confirmar liberación** cuando realmente puedas disponer del importe. Puedes liberar una parte. Si tiene una meta vinculada, la reserva sigue vigente después de descongelar; libérala desde Metas si deseas gastarla. Registrar rendimiento exige que ya se haya recibido.

Si una salida supera el disponible, primero libera reservas, confirma una liberación o corrige el saldo desde Cuentas. Las metas antiguas sin cuenta ya reducen el disponible global; asignarlas no vuelve a descontar dinero ni cambia su avance.

## Compromisos y préstamos

**Movimientos** agrupa ingresos, gastos, transferencias, préstamos, cobros y ajustes, con filtros por cuenta y operación. **Debo** muestra obligaciones propias; **Me deben** registra préstamos nuevos o históricos y cobros parciales. Los préstamos históricos no descuentan dinero de nuevo. Los cobros pueden entrar en otra cuenta libre y el capital no cuenta como ingreso.

Al registrar una deuda con plazo, indica el saldo pendiente actual y las cuotas liquidadas antes del registro. Cinco antecedentes de doce muestran 5/12; la siguiente cuota es la sexta. Editar esos antecedentes no crea movimientos ni reduce otra vez el saldo. Las cuotas que tienen pagos reales no pueden convertirse en antecedentes.

Los gastos fijos tienen importe por vencimiento, fecha de inicio, final opcional y periodicidad. Cada 14 días es distinto de dos veces al mes. Los días inexistentes se ajustan al último día sin desplazar los siguientes meses. Un pago anual se cuenta completo en su mes de vencimiento. Para cambiar el calendario, indica desde qué fecha aplica; los vencimientos anteriores y sus pagos permanecen.

En Ajustes, elige la hora común y anticipación para pagos, cobros pendientes y cajitas por liberar. Android puede retrasar el aviso. Los respaldos v8 no pueden importarse en versiones antiguas.

## Ruta de deudas

La **Ruta de deudas** responde una sola pregunta: ¿cuándo termino de pagar? Muestra únicamente MSI, diferimientos y préstamos con saldo. No incluye gastos fijos ni compras revolventes de tarjeta.

- Cada deuda tiene su propia barra de 12 meses, no una fila agregada de “tarjeta de crédito”.
- Las cuotas pagadas se ven en verde, la cuota del mes en cobre y las pendientes en arena. Las barras rayadas son estimaciones.
- Arriba se muestra la **fecha de libertad de cuotas**, la deuda en cuotas, la cuota normal, lo que resta de este mes y cuántas deudas quedan. La fecha no promete cubrir compras revolventes ni saldo anterior.
- Un MSI vinculado a una tarjeta aparece con su nombre y el de la tarjeta, pero sigue siendo una deuda distinta dentro de la ruta.
- Las deudas sin plazo se estiman dividiendo el saldo entre la cuota actual. Si no hay cuota, la app muestra “Sin fecha planificada” y pide revisar la deuda; no inventa una fecha.
- Si hay cuotas de meses anteriores sin pagar, la app las marca como atrasadas y muestra su importe. La fecha de libertad supone ponerse al día.
- Si una deuda con plazo ya pasó su última cuota y sigue con saldo, se marca para revisión y se estima un final nuevo.

La **deuda total** de Inicio y Deudas incluye la deuda en cuotas más las compras revolventes y el saldo anterior, menos los abonos sin asignar. La **fecha de libertad de cuotas** solo cubre MSI, diferimientos y préstamos. Si hay compras revolventes sin plan, la app no promete una fecha para ellas.

En **Deudas**, las tarjetas se muestran una sola vez con su saldo usado, su límite y su próximo pago. Los MSI vinculados se listan dentro de esa tarjeta y no se suman otra vez al total. Los préstamos y otras deudas no ligadas a tarjeta se muestran en una lista aparte; las deudas liquidadas quedan en un bloque plegable. Una deuda con saldo no se puede archivar. Si un dato antiguo quedó archivado con saldo, se muestra con **Reactivar** y no se incluye en la fecha de libertad.

## Tarjetas de crédito y pagos agrupados

En **Cuentas → Agregar tarjeta** registra un nombre, límite, día de corte y día límite de pago. La cuenta **BBVA débito** y la tarjeta **BBVA crédito** son independientes: puedes tener cualquiera de las dos o ambas, y pagar la tarjeta desde otra cuenta libre.

El **saldo anterior sin MSI** sirve para incorporar compras que ya debías antes de comenzar el registro. No crea gastos ni retira dinero. No incluyas aquí el capital de tus MSI: se incorpora al vincular las deudas existentes.

En **Nuevo gasto → Pagar desde**, elige la opción terminada en **Crédito**. La compra aparece en consumo y reduce el crédito disponible, pero no el disponible libre. El vencimiento se estima con corte y pago; las compras del día de corte se incluyen en ese corte. Puedes indicar otra fecha de vencimiento al registrar o editar una compra si tu estado de cuenta difiere. Los días inexistentes se ajustan al último día del mes. Cambiar el calendario de la tarjeta afecta nuevas compras; las ya registradas conservan su vencimiento.

En **Editar deuda**, vincula los MSI a su tarjeta. Deben tener plazo, saldo total pendiente, fecha de primera cuota y cuota mayor a cero. Conserva las cuotas ya pagadas y verifica la fecha de primera cuota. El capital pendiente completo ocupa crédito; solo la mensualidad de cada periodo se agrega al pago de la tarjeta. No registres además el importe de esa misma compra como gasto ordinario a crédito, porque duplicarías la deuda y el crédito usado. Las vinculaciones son manuales: no se deduce una tarjeta a partir del nombre de un acreedor. En **Deudas**, el detalle de cada tarjeta lista sus MSI con cuota, saldo y fecha final.

**Pagar tarjeta** registra una sola salida desde una cuenta con fondos disponibles. Su desglose cubre los cargos del periodo y las mensualidades MSI vinculadas. Puedes ver otros periodos desde **Ver desglose**. Los abonos parciales se distribuyen en el orden mostrado: por vencimiento, MSI primero en caso de empate y después compras. Es una distribución de tu registro local, no una consulta al banco; compárala con la aplicación real del pago. No se calculan intereses, comisiones, pago mínimo ni un importe certificado para evitar intereses.

El consumo reconoce una compra normal una vez. Los MSI creados como deuda no se suman a la dona de consumo para evitar duplicados; es una limitación conocida. El pago de la tarjeta aparece como salida de dinero y reduce el crédito utilizado, pero no vuelve a incrementar consumo. En **Movimientos** puedes filtrar por tarjeta o por **Pago de tarjeta**, y abrir el desglose del pago. **Deshacer** revierte el pago completo; también puedes revertirlo desde Movimientos. Para editar o eliminar una compra cubierta por un pago, primero revierte ese pago.

Los gastos fijos también se pueden cargar a crédito desde su formulario de pago. Su obligación de efectivo pasa al vencimiento de la tarjeta y no se suma dos veces en calendario y proyección. Las tarjetas con saldo pendiente no se pueden archivar.

### Compatibilidad del libro de crédito

El esquema del libro pasó a **v9** y después a **v10** (independiente del número de versión de la app). Los libros v8 se convierten automáticamente con un catálogo de tarjetas vacío, conservando saldos, movimientos, presupuestos y deshacer. No se atribuyen tarjetas ni créditos a datos antiguos. Antes de reemplazar el libro se conserva el estado original en una copia de migración fuera del historial de deshacer, tanto en SQLite como en la previsualización.

Los respaldos v9 necesitan esta versión del código; las versiones anteriores no los pueden importar. Sigue siendo posible importar respaldos v6, v7 y v8. Revisa los saldos de crédito y los MSI después de importar; la importación no inventa tarjetas ni vínculos que el respaldo no contenga.

### Cuentas y abonos desde 8.4

**Cuentas** separa efectivo/débito de tarjetas. El crédito disponible se muestra junto a las cifras de Inicio para consultarlo, pero no forma parte del dinero libre. En **Deudas**, cada tarjeta aparece una vez con su saldo usado, su límite y su próximo pago; **Ver desglose** abre sus cargos, MSI y vencimientos.

Si depositaste a la tarjeta sin saber cómo aplicó el banco el pago, usa **Abonar sin asignar**. El importe sale una sola vez de la cuenta elegida y reduce de inmediato el saldo usado de la tarjeta. Las compras y cuotas MSI continúan pendientes en el desglose. Cuando tengas el estado de cuenta, usa **Aplicar abonos** y elige el cargo concreto y el importe: esta acción no hace otra salida de dinero. Las cuotas MSI solo se marcan pagadas al completar su importe. Los cargos futuros que aún no existían en la fecha del depósito no se pueden conciliar con él; comprueba la fecha y el desglose del banco. Si ya sabes la aplicación, usa **Pagar tarjeta** para asignar el pago en el orden mostrado.

En **Nuevo gasto fijo**, selecciona cada cuántos días, semanas, meses o años vence; los dos días solo aparecen con **Dos veces al mes**. Puedes elegir una tarjeta como origen previsto. La tarjeta se carga únicamente cuando confirmas el pago del vencimiento; antes de eso permanece como compromiso pendiente. Los libros y respaldos nuevos usan esquema v10; la app convierte los v9 automáticamente junto con el historial. Las versiones anteriores no importan respaldos v10.
