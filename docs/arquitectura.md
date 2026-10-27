# Arquitectura

## Interfaz web

Las fuentes están en `app/src/main/assets`. `index.html` carga `js/bootstrap.js` como módulo ES; no se requiere empaquetado para producción ni dependencias web en ejecución.

- `js/domain`: cálculo financiero, crédito y plan de deudas; funciones puras sin DOM, Android ni red.
- `js/state`: modelo de sesión y transacciones del libro. El estado compartido pertenece a un objeto importado explícitamente, sin variables globales entre scripts.
- `js/platform`: adaptación de SQLite mediante NativeOSP y de IndexedDB para previsualización, y respaldos.
- `js/screens`: vistas por función del producto.
- `js/ui`: navegación, acciones, formularios, iconos de línea y componentes comunes. `navigation.js` también mantiene la barra compacta que aparece al desplazar.
- `css`: tokens y tema, base, componentes, gráficos/listas, pantallas, diálogos/formularios y reglas adaptables. `theme.css` se carga primero y concentra la paleta, la tipografía y el movimiento.

Los módulos de presentación tienen algunas dependencias cíclicas entre funciones de navegación y acciones; no ejecutan esas funciones durante su inicialización. El dominio no depende de la presentación. Los únicos callbacks globales son el contrato explícito con Android.

## Android

`MainActivity` gestiona la actividad y crea los servicios. `WebViewHost` permite únicamente assets del origen local. `NativeBridge` es la frontera con JavaScript. `LedgerStore` conserva `projectosp.db`, la tabla `vault` y las transacciones originales. `BackupController` controla selectores e instalador. `ReminderReceiver` mantiene los avisos locales.

Se conservan el paquete `app.projectosp`, la base SQLite, el historial de 15 cambios y la identidad de firma. Melange 8 introduce la migración de datos descrita abajo.

## Pruebas

Las pruebas del dominio importan directamente sus módulos. Las pruebas DOM empaquetan temporalmente el mismo punto de entrada con esbuild para ejecutarlo dentro de Happy DOM. Playwright usa los módulos nativos, un servidor efímero propio y datos ficticios. Los archivos generados quedan fuera de Git.

## Actualizaciones

`GitHubReleaseClient` resuelve únicamente la última release estable y sus assets; `UpdateDescriptor` valida metadatos; `ApkVerifier` comprueba bytes e identidad Android; `UpdateController` serializa consultas y descargas. Los datos de actualización viven en SharedPreferences `updates` y caché `updates/`, fuera del libro y sus respaldos. `platform/updates.js` presenta estados sin iniciar conexiones web.

Para Java se utiliza google-java-format 1.24.0: define `JAVA_FORMAT_JAR` con el jar all-deps y ejecuta `scripts/java-format.sh check` o `write`.

## Modelo v8

`walletAccounts` contiene cuentas propias y `creditors` el antiguo catálogo `accounts` de acreedores. Cada cuenta tiene un saldo inicial entero; los movimientos referencian `accountId` y las transferencias `toAccountId`. `funds.js` calcula saldos, disponibilidad, asignaciones, cajitas y capital por recuperar. Los ingresos y gastos excluyen el principal de préstamos y cobros.

Las metas mantienen asignaciones por cuenta. Una asignación vinculada a cajita se solapa con el importe congelado: se resta la unión, no la suma. Las asignaciones antiguas sin cuenta reducen el disponible global. Las liberaciones de cajitas conservan la asignación de meta.

`recurrence.js` genera vencimientos desde reglas con ancla y vigencia. Las identidades incluyen regla y fecha; dos fechas mensuales que se ajusten al mismo último día mantienen identidades distintas. Los presupuestos conservan vencimientos con pagos y reglas anteriores a la nueva vigencia.

`legacy-v7.js` conserva la conversión v6/v7. `migrateEnvelope` convierte libro e historial sin mutarlos e ignora borradores de versiones anteriores. El arranque valida el libro antes de escribir. SQLite guarda el original v7 una sola vez en `migration_backups`, dentro de la misma transacción que reemplaza `vault`; IndexedDB hace lo equivalente en `migration-v7`. El historial rotativo no elimina esta copia. Los respaldos exportados son v10.

## Crédito y libro v9

`domain/credit.js` mantiene las tarjetas separadas de `walletAccounts`, calcula crédito utilizado y vencimientos y valida los desgloses de pago. Las compras siguen siendo `expense` o `fixed`, con `creditCardId` y `cardDueDate`, sin cuenta de dinero propio. `funds.balances` las excluye. `card_payment` sí descuenta de una cuenta propia y guarda aplicaciones a compras, saldo anterior o cuotas MSI. Las aplicaciones permiten calcular lo pagado y revertir la operación completa sin crear salidas por cada mensualidad.

`finance.obligations` agrupa MSI y cargos por tarjeta y mes; `baseObligations` conserva los vencimientos individuales para la asignación del pago. El consumo reconoce compras; las salidas de efectivo reconocen pagos, excluyendo compras a crédito. El calendario de cada compra queda guardado, de modo que cambiar los días de una tarjeta no reescribe cargos anteriores.

`domain/debt-plan.js` es la fuente única de la Ruta de deudas y del saldo total. `debtBreakdown` separa préstamos de tarjetas y cuenta cada MSI una sola vez. `debtPlan` calcula una fila por MSI o préstamo, su mes final, si es estimada, si está vencida y la fecha de libertad de deudas. `debtCellState` clasifica cada mes para el Gantt. Excluye gastos fijos y compras revolventes por diseño. Inicio, Deudas y la Ruta consumen las mismas funciones, de modo que un cambio de definición no se duplica en las pantallas.

La migración v8 → v9 agrega el catálogo vacío a libro y deshacer. SQLite y la previsualización conservan el sobre original por versión en una operación de guardado atómica. El número de esquema no equivale al número de versión Android.

## Libro v10 y abonos sin asignar

El esquema v10 admite aplicaciones `unassigned` en `card_payment`. El pago sigue siendo una transacción única que descuenta efectivo. El crédito utilizado resta esas aplicaciones sin alterar saldos de MSI ni marcar obligaciones pagadas. `applyCardCredit` traslada aplicaciones del mismo pago a líneas existentes, conservando el importe y la fecha originales; al completar una cuota se actualiza la deuda. La validación comprueba referencias, suma de aplicaciones y saldo no negativo. Deshacer el pago revierte también cualquier aplicación conciliada. La migración v9 → v10 transforma libro e historial sin tocar sus importes; las reglas de gastos fijos pueden guardar `creditCardId` como origen previsto por vigencia.

## Shell móvil

`navigation.js` separa la cabecera grande de cada pantalla de la barra compacta que aparece al desplazar. La barra se reconstruye solo cuando cambia la pantalla o su visibilidad y no duplica acciones del contenido. Las pantallas de detalle (`timeline`, `projection`, `settings`) ocultan la navegación inferior y ofrecen Volver; Inicio y las cuatro pestañas principales conservan la barra flotante.

`components.js` centraliza `screenHead`, `sectionHead`, `money` y `dlabel`. `money` omite los centavos cuando el importe es entero; `dlabel` presenta fechas legibles. Los iconos proceden de Lucide y se guardan como SVG local en `ui/icons.js`; no se descargan en tiempo de ejecución. Las hojas de formulario usan el mismo `dialog` con asa, cuerpo desplazable y acciones fijas.
