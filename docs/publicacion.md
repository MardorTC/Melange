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
