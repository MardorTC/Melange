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

- `app/src/main/assets/css/theme.css`: paleta de Día y Noche, tipografía, radios, sombras y movimiento. Es la primera hoja que se carga.
- `app/src/main/assets/css/paisaje.css`: dirección Paisaje (escenas, navegación con el sol de Registrar, piedras, títulos serif, listas sin tarjetas y pantallas de detalle). Se carga al final.
- `app/src/main/assets/js/theme-init.js`: aplica Día o Noche antes de pintar, según Ajustes › Apariencia o el modo del teléfono.
- `app/src/main/assets/js/ui/scene.js`: escenas del desierto de cada pestaña y el horizonte del mes.
- `app/src/main/assets/css/base.css`: shell, titulares de pantalla, barra compacta al desplazar y animaciones de entrada.
- `app/src/main/assets/css/screens.css`: composición de Inicio, Deudas, Cuentas, Calendario, Ruta de deudas, Proyección, Metas y Ajustes.
- `app/src/main/assets/css/components.css`, `charts-and-lists.css` y `dialogs-and-forms.css`: componentes, navegación inferior, gráficos/listas y hojas/formularios.
- `app/src/main/assets/index.html`: estructura general y orden de las hojas de estilo.
- `app/src/main/assets/js/screens/`: contenido de Inicio, Cuentas, Movimientos y demás pantallas.
- `app/src/main/assets/js/ui/icons.js`: iconos de línea Lucide en SVG, sin red.
- `app/src/main/assets/fonts/`: Instrument Serif para titulares y cifras, y Manrope (variable, 400–800) para la interfaz, cada una con su licencia OFL.
- `app/src/main/assets/js/ui/`: navegación, componentes y formularios.

Ejemplo: cambia `--brand` en `theme.css`, guarda y recarga. Para experimentar temporalmente, usa **Inspeccionar** en el navegador; copia al archivo los cambios que quieras conservar, porque lo editado solo en el inspector se pierde al recargar.

Activa el modo de dispositivos de las herramientas del navegador y revisa anchos de 360, 390 y 430 píxeles, además de horizontal. Comprueba también formularios, hojas inferiores, textos largos, la preferencia de movimiento reducido y que la Ruta de deudas no tenga scroll horizontal.

## Decisiones de interfaz móvil

- Dirección **Paisaje**: el desierto es la interfaz. Cada pestaña abre con una escena que muestra un dato real: en Inicio el sol marca el día de hoy y los pagos del mes van sobre la duna; Actividad muestra huellas, Dinero un oasis y Deudas la ladera hacia la fecha de libertad.
- Dos temas, **Día** y **Noche** (cielo índigo, dos lunas, crestas con luz de especia). Automático sigue el modo del teléfono; la preferencia vive en el dispositivo, no en el libro.
- Navegación: Inicio · Actividad · Registrar · Dinero · Deudas. Calendario y Fijos viven en Actividad; Metas en Dinero. El botón central es el sol de Registrar.
- Cuenta, tarjeta, deuda y gasto fijo se abren como pantallas de detalle. Sus acciones abren hojas encima y al guardar se vuelve al detalle.
- Las listas van sobre la arena separadas por líneas finas; solo la tarjeta de crédito y las hojas tienen superficie propia. Los iconos van en «piedras» de forma orgánica.
- Serif (Instrument Serif) para cifras principales y títulos de sección; Manrope para el resto. Importes sin centavos cuando son cero y fechas como «5 oct 2026».
- Especia para actuar, agua para lo que tienes, óxido solo para lo vencido.
- Lo reversible (archivar, reactivar) se aplica sin confirmar y ofrece Deshacer; lo que elimina sí se confirma. Cerrar un formulario guarda un borrador.
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
