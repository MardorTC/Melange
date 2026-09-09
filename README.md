# Melange

Finanzas personales para Android 8 o posterior, con Android System WebView actualizado. Datos locales, sin cuenta ni servidor financiero. Java y una interfaz WebView escrita con módulos JavaScript.

## Desarrollo

Requiere Node.js 24, JDK 17 y SDK Android 35. Instala las dependencias con `npm ci`; ejecuta `npm test`, `npm run dev` o `npm run test:ui`.

Define `JAVA_HOME` y `ANDROID_HOME` según tu equipo. `./build.sh debug` compila sin la firma privada; `./build.sh release` utiliza `firma/signing/` o `OSP_SIGNING_DIR`.

- [Arquitectura](docs/arquitectura.md)
- [Guía de uso y datos](docs/uso.md)
- [Compilación y publicación](docs/publicacion.md)

No se deben versionar claves de firma, contraseñas ni respaldos personales.
