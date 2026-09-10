# Guía de uso de Melange

Aplicación instalable para Android 8.0 o posterior, con Android System WebView actualizado. Funciona sin internet, sin cuenta y sin servidor. El APK no contiene datos financieros del propietario ni datos de ejemplo.

## Actualizar ProjectOSP 7.0 a Melange 7.1

1. Exporta un respaldo por precaución; no tendrás que importarlo para actualizar.
2. Abre `Melange-7.1.0.apk` desde Descargas, o selecciónalo desde Ajustes → Instalar actualización.
3. Android debe ofrecer actualizar la app existente. No la desinstales ni borres sus datos.
4. Abre Melange y comprueba tus saldos, movimientos, metas y deudas.

Se conservan el paquete `app.projectosp`, la clave de firma original, SQLite y el formato de respaldo v7. Solo cambian la versión, la identidad visual y las funciones de esta entrega. Si Android no permite actualizar, detente y revisa el mensaje; no desinstales como solución.

Novedades: logo aprobado, paleta arena/café/ocre, gráfico antes de la lista de Gastos (dos columnas desde 900 px en horizontal), accesos al inicio de Calendario y timeline/proyección como pantallas completas con Volver. El botón Atrás de Android también regresa a Calendario.

## Reconstrucción histórica opcional

No necesitas reconstruir nada para conservar los datos al actualizar. Esta función sirve para comenzar un libro nuevo desde una fecha pasada, no para completar automáticamente ni fusionar el libro actual.

1. Abre Ajustes → Reconstrucción histórica, o elige Reconstruir meses anteriores en el primer inicio.
2. Indica fecha de inicio y saldos de efectivo/débito al comenzar ese día. Se admiten hasta diez años hacia atrás.
3. Agrega deudas con su saldo pendiente de entonces y gastos fijos. Las cuotas consecutivas anteriores al inicio se consideran antecedentes y no descuentan de nuevo. Los pagos dentro del periodo se registran individualmente.
4. Captura ingresos, gastos, transferencias y pagos con sus fechas reales. Puedes corregir el orden: el cálculo ordena cronológicamente; en el mismo día conserva el orden de captura. El ingreso previsto es presupuesto, no dinero recibido.
5. Sal y vuelve cuando quieras: el borrador se guarda separado. Sus movimientos y saldos aún no son los de tu libro activo.
6. Pulsa Comparar con hoy e introduce tus saldos reales. Si difieren, revisa movimientos o elige expresamente crear ajustes visibles por la diferencia.
7. Solo al confirmar se reemplaza el libro activo completo (incluidas deudas y metas) por el reconstruido. El estado anterior queda en Deshacer, hasta que salga del historial de 15 cambios.

El borrador copia categorías y acreedores, no las deudas, metas ni movimientos activos. Si cambias el libro activo después de iniciar, la confirmación del borrador se bloquea para no sobrescribir cambios nuevos. Puedes exportar su resultado, descartarlo o empezar otro; el archivo exportado contiene el libro calculado, no el asistente reanudable. Descartar un borrador requiere confirmación y no tiene deshacer.

La gráfica reconstruida muestra saldos calculados en las fechas de movimientos y el saldo de hoy, no observaciones bancarias. Corregir un movimiento vuelve a calcular los puntos posteriores. Los gastos importados de v6 mantienen su semántica original y no se convierten solos en movimientos que descuentan dinero.

## Instalar y migrar desde v6

1. Descarga `Melange-7.1.0.apk` en tu teléfono.
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

- Interfaz móvil cálida, navegación inferior, tarjetas diferenciadas, acciones con iconos y etiquetas accesibles.
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
- Calendario mensual, timeline anual y proyección de 12 meses.
- Recordatorios locales de Android, incluso sin una pestaña abierta.
- Base local SQLite y guardado en segundo plano con transacción atómica. No se utiliza localStorage.

## Cómo interpretar los números

**Liquidez** es efectivo + débito. Los gastos y pagos nuevos restan; los ingresos suman; las transferencias conservan el total. Si una operación deja una cuenta negativa, ese resultado se muestra: no se recorta a cero.

**Disponible sin reservas** es liquidez menos el dinero asignado a metas. Reservar o liberar dinero no crea un gasto ni altera la liquidez. Las aportaciones no pueden asignar más dinero del disponible sin reservar.

**Libre antes de variables** es ingreso mensual previsto menos compromisos de fijos y deudas del mes. Incluye cuotas pagadas y pendientes. No es un pronóstico del saldo bancario de fin de mes y no incorpora gastos variables futuros que no se han presupuestado.

**Deuda / ingreso previsto** usa los compromisos del mes, no solo lo pendiente. Si no existe un ingreso previsto, se muestra sin dato, no como 0 %.

Los **pagos de deuda** aparecen en los movimientos y en las salidas de dinero. Se excluyen de la dona de consumo para no contar dos veces una compra y la posterior liquidación de su deuda. Las compras de crédito no tienen todavía un registro separado por tarjeta; el registro directo de gasto utiliza efectivo o débito.

La **variación de liquidez** compara observaciones existentes. No se presenta como ahorro mensual. Los días sin observaciones no se reconstruyen.

El monto de **ingreso previsto** no aumenta el saldo: el ingreso recibido se registra desde Inicio.

## Deudas y financiamiento

Cada deuda permite indicar si su saldo representa el total pendiente (incluye financiamiento) o solo capital. Cuando es solo capital, cada pago pide qué parte reduce ese capital. La tasa anual es informativa: no se generan intereses ni tablas de amortización automáticamente.

Los datos de v6 conservan sus saldos y su comportamiento de total pendiente. Revisa el significado del saldo en las deudas con intereses antes de hacer pagos nuevos. La migración no inventa una separación capital/interés.

Un abono adicional puede reducir saldo sin marcar una cuota concreta ni recalcular el contrato. Los cambios futuros del calendario se realizan explícitamente. El inicio y el número de cuotas se protegen al existir pagos asociados.

Eliminar una deuda con antecedentes la archiva para conservar sus movimientos. Los gastos fijos también se archivan. Deshacer revierte el cambio completo; revertir un movimiento vinculado devuelve el dinero y reabre el compromiso correspondiente.

## Conservación del respaldo v6

Los saldos importados se usan como punto de partida. Los gastos históricos se conservan como antecedentes y no vuelven a restar dinero. Las cuotas pagadas se mantienen como marcas históricas: v6 no guardaba su fecha real ni el origen del pago. No se crean movimientos falsos para completarlas.

Una importación válida reemplaza el conjunto actual, después de mostrar una vista previa, y conserva el estado previo en Deshacer. Una importación inválida no reemplaza los datos. No se fusionan dos respaldos: esto no es sincronización.

## Recordatorios

Son notificaciones locales, alrededor de las 9:00 según la zona horaria del teléfono. La anticipación se configura entre el mismo día y siete días antes. Android puede retrasar los avisos por ahorro de batería; no se solicita permiso de alarma exacta. Debes conceder permiso de notificaciones en Android 13 o posterior. Forzar la detención de una app puede impedir sus tareas hasta volver a abrirla.

Se prepara una lista de los siguientes 12 meses y se actualiza al abrir o modificar datos. La programación se recupera después de reiniciar o actualizar el teléfono. Las notificaciones muestran un conteo de compromisos, sin importes ni nombres de acreedores.

## Pendiente / límites de esta entrega

- No hay sincronización automática con Google Drive ni Proton Drive. El selector de documentos de Android puede permitir guardar respaldos en proveedores instalados; eso es un respaldo manual.
- La descarga requiere una acción del usuario; no hay instalación silenciosa.
- No hay múltiples saldos bancarios independientes: se conserva la separación de v6 entre efectivo, débito y catálogo de acreedores.
- No hay recálculo automático de intereses ni forecast de variables no registradas.
- La base utiliza SQLite para guardar versiones del estado JSON; las consultas y filtros se calculan en memoria. No es todavía un libro mayor con tablas SQL indexadas por movimiento. Se mantienen hasta 15 estados para deshacer; no es almacenamiento ilimitado.
- Las comprobaciones de desarrollo y sus límites se describen en [Verificación](verificacion.md).
