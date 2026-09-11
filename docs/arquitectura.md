# Arquitectura

## Interfaz web

Las fuentes están en `app/src/main/assets`. `index.html` carga `js/bootstrap.js` como módulo ES; no se requiere empaquetado para producción ni dependencias web en ejecución.

- `js/domain`: cálculo financiero y reconstrucción; funciones puras sin DOM, Android ni red.
- `js/state`: modelo de sesión y transacciones del libro. El estado compartido pertenece a un objeto importado explícitamente, sin variables globales entre scripts.
- `js/platform`: adaptación de SQLite mediante NativeOSP y de IndexedDB para previsualización, y respaldos.
- `js/screens`: vistas por función del producto.
- `js/ui`: navegación, acciones, formularios y componentes comunes.
- `css`: base, componentes, gráficos/listas, diálogos/formularios, reglas adaptables y tema. El orden de carga conserva la cascada original.

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

`legacy-v7.js` conserva la conversión v6/v7. `migrateEnvelope` convierte libro, historial y borrador sin mutarlos. El arranque valida también la reconstrucción antes de escribir. SQLite guarda el original v7 una sola vez en `migration_backups`, dentro de la misma transacción que reemplaza `vault`; IndexedDB hace lo equivalente en `migration-v7`. El historial rotativo no elimina esta copia. Los respaldos exportados son v8.
