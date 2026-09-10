# Compilación y publicación

## Requisitos

Node.js 24, JDK 17, Android Platform 35 y Build Tools 35.0.0. Gradle Wrapper fija Gradle 8.11.1 y el plugin Android 8.9.2. El primer build descarga dependencias.

```bash
npm ci
npm run check
npm run test:ui
./gradlew :app:testDebugUnitTest :app:lintDebug
./build.sh debug
./build.sh release
```

Los APK se generan en `app/build/outputs/apk/`. La versión se define exclusivamente en `app/build.gradle`; aumenta nombre y código juntos. Los datos mostrados en Android provienen de BuildConfig.

## Firma

La firma original usa `firma/signing/projectosp.jks`, alias `projectosp`, y `firma/signing/password.txt`. Para guardarla fuera del proyecto define `OSP_SIGNING_DIR`. Nunca se genera otra clave automáticamente. Git ignora toda la carpeta `firma/` y los archivos de claves y contraseñas.

La compilación debug utiliza la clave de desarrollo del SDK. No puede actualizar una instalación release. La compilación release necesita la firma original; GitHub Actions solo compila debug.

## Publicar una versión estable

1. Aumenta `releaseName` y `releaseCode` en `app/build.gradle`; escribe `docs/releases/<versión>.md`.
2. Comprueba en Android la actualización sobre una versión anterior firmada con la misma clave y confirma que conserva los datos.
3. Guarda los cambios en `main` y ejecuta `npm run release`, con `gh` autenticado y acceso SSH al repositorio.

El comando exige un árbol limpio, ejecuta formato, pruebas web y nativas, lint y compilación. Verifica la firma, genera `build/releases/v<versión>/Melange-<versión>.apk` y `update.json`, sube `main` y la etiqueta, crea una release en borrador, carga ambos archivos y la publica tras comprobar sus tamaños. No reemplaza tags ni releases existentes. Si falla después de crear la etiqueta o el borrador, inspecciona el estado remoto y termina la publicación manualmente; no borres ni sobreescribas una versión publicada.

`update.json` contiene `version`, `versionCode`, `minSdk`, `apk`, `size` y `sha256`. El nombre y código deben coincidir con el APK y la etiqueta `v<versión>`. Los archivos se firman localmente; GitHub no recibe claves ni contraseñas. El APK contiene el certificado público de firma, necesario para que Android verifique las actualizaciones.

## Canal de actualizaciones

Se consulta la última release estable de `MardorTC/Melange`. La app acepta únicamente sus assets a través de HTTPS y las redirecciones de descarga de GitHub. No se incluyen credenciales en el APK. Los borradores y prereleases quedan fuera del canal estable.

La comprobación automática ocurre al iniciar y como máximo una vez cada 24 horas; la manual siempre puede reintentarse. Las descargas requieren pulsar Descargar y se cancelan al terminar el proceso. La instalación necesita la confirmación del sistema y, si corresponde, habilitar la instalación desde Melange. La consulta no envía datos del libro financiero.
