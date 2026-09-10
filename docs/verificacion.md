# Verificación de la entrega 7.2

## Comprobaciones automatizadas

- `npm run check`: formato, reglas financieras e históricas, integración DOM y estados de actualización.
- `npm run test:ui`: bienvenida, saldos, pagos, deshacer y recarga, gastos fijos, metas, filtros e importación inválida. Anchos 360, 390, 430 y 1000 px, sin desbordamiento horizontal ni errores JavaScript.
- Gradle: diez pruebas unitarias de versiones, metadatos, origen de assets, red, límites HTTP e integridad; compilación debug/release y lint sin errores.
- GitHub Actions: pruebas de almacenamiento y certificados en Android API 26 y 35; carga de módulos, bienvenida y puente nativo con un WebView moderno. La imagen API 26 incluye WebView 69 y omite explícitamente esa prueba de interfaz, que requiere WebView 92 o posterior.

## Actualización firmada

Se compiló la base original 7.1 con la firma original y se instaló en un emulador Android 8. Se preparó una base ficticia con saldos, un movimiento, historial de deshacer, borrador de reconstrucción y revisión; también preferencias de recordatorios. La instalación sobre ella del APK 7.2 firmado con la misma clave conservó exactamente el JSON de SQLite y las preferencias. Android confirmó `versionCode=70200` y `versionName=7.2.0`.

Esta comprobación utilizó el gestor de paquetes de Android mediante ADB. No sustituye una revisión manual en un teléfono del selector de documentos, permiso de instalación, notificaciones y comportamiento de teclado/insets. No se utilizaron datos personales ni se publicaron claves privadas.

## Repetir

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:ui
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleRelease
# Con un emulador o dispositivo de pruebas conectado:
./gradlew :app:connectedDebugAndroidTest
```

Los informes nativos y las capturas de Playwright se guardan en directorios `build/`, excluidos de Git. Los informes de emuladores de CI se adjuntan a cada ejecución de GitHub Actions.
