# Melange

Finanzas personales para Android 8 o posterior, con Android System WebView actualizado. Datos locales, sin cuenta ni servidor financiero. Java y una interfaz WebView escrita con módulos JavaScript.

## Desarrollo

Con Node.js 24 disponible, ejecuta `npm run setup` para instalar dependencias y Chromium y comprobar el entorno. Las herramientas existentes en `.tools/` se detectan automáticamente; no necesitas repetir `export` ni modificar tu PATH global.

```bash
npm run doctor         # Diagnosticar herramientas
npm run dev            # Previsualizar sin APK
npm run check          # Formato y pruebas web
npm run test:ui        # Pruebas en Chromium
npm run android:check  # Pruebas nativas y lint
npm run build:debug    # APK de desarrollo
npm run build:release  # APK con la firma original
```

- [Preparar el entorno de desarrollo](docs/entorno.md)
- [Editar y previsualizar el diseño sin APK](docs/desarrollo-visual.md)
- [Arquitectura](docs/arquitectura.md)
- [Guía de uso y datos](docs/uso.md)
- [Compilación y publicación](docs/publicacion.md)

No se deben versionar claves de firma, contraseñas ni respaldos personales.
