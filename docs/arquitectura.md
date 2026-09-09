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

El paquete `app.projectosp`, el esquema v7, el historial de 15 cambios y la identidad de firma se conservan. Ninguna reorganización requiere migrar los datos financieros.

## Pruebas

Las pruebas del dominio importan directamente sus módulos. Las pruebas DOM empaquetan temporalmente el mismo punto de entrada con esbuild para ejecutarlo dentro de Happy DOM. Playwright usa los módulos nativos, un servidor efímero propio y datos ficticios. Los archivos generados quedan fuera de Git.
