# Cambiar y probar el diseño sin generar una APK

## Abrir la app en el navegador

Desde una terminal:

```bash
cd /home/mardor/projects/melange
npm run dev
```

Deja esa terminal abierta y visita **http://127.0.0.1:8765**. Para detener el servidor pulsa **Ctrl+C**. Si el puerto está ocupado, usa `PORT=8766 npm run dev` y abre el puerto indicado.

La previsualización utiliza los mismos HTML, CSS y módulos JavaScript que Android. Guarda los archivos y recarga la página para ver los cambios; no hay recarga automática. No abras `index.html` directamente como archivo: los módulos necesitan el servidor local.

La información del navegador se guarda en IndexedDB y es independiente de la del teléfono. Puedes comenzar desde cero y crear datos ficticios. Usa siempre la misma dirección y puerto para conservar esos datos. Las pruebas automatizadas usan su propia sesión y no llenan tu previsualización con los datos de sus capturas.

## Dónde editar

- `app/src/main/assets/css/visual-refresh.css`: colores, espacios, tamaños y reglas del parche. Se carga al final, por lo que sus reglas pueden sobrescribir los estilos anteriores.
- `app/src/main/assets/index.html`: estructura general y orden de las hojas de estilo.
- `app/src/main/assets/js/screens/`: contenido de Inicio, Cuentas, Movimientos y demás pantallas.
- `app/src/main/assets/js/ui/`: navegación, componentes y formularios.

Ejemplo: cambia `--ui-brand` en `visual-refresh.css`, guarda y recarga. Para experimentar temporalmente, usa **Inspeccionar** en el navegador; copia al archivo los cambios que quieras conservar, porque lo editado solo en el inspector se pierde al recargar.

Activa el modo de dispositivos de las herramientas del navegador y revisa anchos de 360, 390 y 430 píxeles, además de horizontal. Comprueba también formularios, ventanas de diálogo y textos largos.

## Qué hace cada comando

```bash
npm run dev       # Abre el servidor para revisar el diseño manualmente
npm run check     # Comprueba formato y ejecuta pruebas financieras y DOM
npm run test:ui   # Pruebas automáticas en Chromium, sin ventana interactiva
```

`npm run test:ui` guarda capturas con datos ficticios en `build/previews/`. Son capturas de las pruebas, no un editor en vivo.

Si `check` informa de formato, ejecuta `npm run format` y repite `npm run check`. Si falla una prueba, revisa el mensaje: dar formato no arregla errores funcionales.

En una instalación nueva, ejecuta `npm ci`. Si Playwright informa que falta su navegador, ejecuta `npx playwright install chromium`. En este equipo también existe una instalación local que puedes seleccionar así:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.tools/browsers" npm run test:ui
```

## Comprobaciones Android opcionales para cambios de diseño

No necesitas Gradle para ver CSS o HTML. Para ejecutar las comprobaciones nativas con las herramientas ya instaladas en este proyecto:

```bash
cd /home/mardor/projects/melange
export JAVA_HOME="$PWD/.tools/jdk"
export ANDROID_HOME="$PWD/.tools/android"
export GRADLE_USER_HOME="$PWD/.tools/gradle-home"
export PATH="$JAVA_HOME/bin:$PATH"
./gradlew :app:testDebugUnitTest :app:lintDebug
```

Estos comandos no generan una APK. Las variables duran mientras esa terminal siga abierta; en otra terminal debes configurarlas de nuevo. Las carpetas `.tools/` son locales y no están en Git: otro equipo necesita instalar JDK 17 y SDK Android 35, y usar sus rutas correspondientes.

El navegador permite revisar el diseño y los flujos web. SQLite nativo, notificaciones, selector de archivos e instalación de actualizaciones necesitan comprobarse finalmente en Android.

## Aplicar y revisar otro parche

Tu parche visual actual ya está aplicado; no lo apliques otra vez. Para uno nuevo:

```bash
git status --short
git apply --check /ruta/al/nuevo.patch
git apply /ruta/al/nuevo.patch
git diff
npm run check
npm run test:ui
```

`git apply --check` comprueba si puede aplicarse sin modificar archivos. Revisa también los archivos nuevos que aparecen con `??` en `git status`: no aparecen en `git diff` hasta que se añaden al índice. No hace falta crear un commit ni publicar una release para previsualizar cambios.
