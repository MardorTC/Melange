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

- `app/src/main/assets/css/theme.css`: paleta, tipografía, radios, sombras y movimiento. Es la primera hoja que se carga.
- `app/src/main/assets/css/base.css`: shell, titulares de pantalla, barra compacta al desplazar y animaciones de entrada.
- `app/src/main/assets/css/screens.css`: composición de Inicio, Deudas, Cuentas, Calendario, Ruta de deudas, Proyección, Metas y Ajustes.
- `app/src/main/assets/css/components.css`, `charts-and-lists.css` y `dialogs-and-forms.css`: componentes, navegación inferior, gráficos/listas y hojas/formularios.
- `app/src/main/assets/index.html`: estructura general y orden de las hojas de estilo.
- `app/src/main/assets/js/screens/`: contenido de Inicio, Cuentas, Movimientos y demás pantallas.
- `app/src/main/assets/js/ui/icons.js`: iconos de línea Lucide en SVG, sin red.
- `app/src/main/assets/fonts/`: Instrument Serif para titulares y cifras editoriales, con su licencia OFL.
- `app/src/main/assets/js/ui/`: navegación, componentes y formularios.

Ejemplo: cambia `--brand` en `theme.css`, guarda y recarga. Para experimentar temporalmente, usa **Inspeccionar** en el navegador; copia al archivo los cambios que quieras conservar, porque lo editado solo en el inspector se pierde al recargar.

Activa el modo de dispositivos de las herramientas del navegador y revisa anchos de 360, 390 y 430 píxeles, además de horizontal. Comprueba también formularios, hojas inferiores, textos largos, la preferencia de movimiento reducido y que la Ruta de deudas no tenga scroll horizontal.

## Decisiones de interfaz móvil

- Cada pestaña abre con un título grande sin barra de marca duplicada. Al desplazar aparece una barra compacta con el nombre de la pantalla; en pantallas de detalle incluye Atrás.
- La navegación inferior es flotante, con fondo translúcido y una píldora de estado. Las pantallas de detalle (Ruta, Proyección y Ajustes) la ocultan y usan una cabecera con Volver.
- La tipografía serif se reserva para la marca, las cifras principales y las fechas de libertad. Los títulos de pantalla, listas y formularios usan la sans del sistema.
- Los importes ocultan los centavos cuando son cero y las fechas se muestran como “5 oct 2026”, no como ISO.
- Las listas largas se agrupan por fecha, los formularios se abren en hojas inferiores con asa y botón fijo, y los filtros viven en una hoja en lugar de empujar la página.
- Las tarjetas de crédito usan una pieza visual oscura con saldo, límite, corte y pago; el detalle y los MSI quedan debajo.
- Los carruseles horizontales usan `scroll-snap` y muestran el siguiente elemento para invitar a deslizar.
- Todo el movimiento respeta `prefers-reduced-motion`.

## Qué hace cada comando

```bash
npm run dev       # Abre el servidor para revisar el diseño manualmente
npm run check     # Comprueba formato y ejecuta pruebas financieras y DOM
npm run test:ui   # Pruebas automáticas en Chromium, sin ventana interactiva
```

`npm run test:ui` guarda capturas con datos ficticios en `build/previews/`. Son capturas de las pruebas, no un editor en vivo.

Si `check` informa de formato, ejecuta `npm run format` y repite `npm run check`. Si falla una prueba, revisa el mensaje: dar formato no arregla errores funcionales.

En una instalación nueva, ejecuta `npm run setup`: instala las dependencias fijadas y Chromium, y comprueba el entorno. Después, `npm run test:ui` encuentra automáticamente el navegador local, sin variables manuales.

## Comprobaciones Android opcionales para cambios de diseño

No necesitas Gradle para ver CSS o HTML. Para ejecutar las comprobaciones nativas:

```bash
npm run android:check
```

Este comando no genera una APK. `./gradlew :app:testDebugUnitTest :app:lintDebug` también funciona directamente: ambos detectan las herramientas locales. Consulta [Entorno de desarrollo](entorno.md) para preparar otro equipo o diagnosticar requisitos faltantes.

El navegador permite revisar el diseño y los flujos web. SQLite nativo, notificaciones, selector de archivos e instalación de actualizaciones necesitan comprobarse finalmente en Android.

## Revisar cambios de diseño

```bash
git status --short
git diff
npm run check
npm run test:ui
```

Revisa también los archivos nuevos que aparecen con `??` en `git status`: no aparecen en `git diff` hasta que se añaden al índice. No hace falta crear un commit ni publicar una release para previsualizar cambios.
