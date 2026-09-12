# Entorno de desarrollo

El entorno de terminal está preparado para Linux y macOS con una shell POSIX. En este equipo, JDK y SDK ya están en `.tools/`. Los comandos del proyecto los detectan automáticamente, sin modificar `.zshrc`, `.bashrc` ni el PATH global. Windows puede usar WSL con herramientas Linux; `gradlew.bat` no incorpora esta detección.

## Preparación

Necesitas Node.js 24 y npm en tu terminal. Si usas nvm, ejecuta `nvm install` y `nvm use`: `.nvmrc` selecciona la versión principal del proyecto.

```bash
cd /home/mardor/projects/melange
npm run setup
```

`setup` ejecuta `npm ci` (reinstala dependencias según el lockfile), instala el Chromium compatible con Playwright y diagnostica las herramientas. No descarga JDK ni SDK, no cambia la firma y no publica nada. Si faltan requisitos Android, termina con un diagnóstico; la previsualización web puede usarse igualmente.

Si Chromium necesita bibliotecas del sistema en una instalación Linux nueva, ejecuta `sh scripts/run.sh ./node_modules/.bin/playwright install-deps chromium`. Este comando puede solicitar permisos de administrador.

## Uso diario

| Comando                       | Función                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `npm run doctor`              | Comprobar Node, JDK, SDK y navegador; mostrar rutas activas |
| `npm run dev`                 | Previsualizar en http://127.0.0.1:8765                      |
| `npm run check`               | Revisar formato y ejecutar pruebas web                      |
| `npm run test:ui`             | Probar la interfaz en Chromium                              |
| `npm run android:check`       | Pruebas unitarias Android y lint                            |
| `npm run build:debug`         | Generar APK debug                                           |
| `npm run build:release`       | Generar APK release con la firma original, sin publicar     |
| `npm run doctor -- --release` | Añadir comprobaciones de gh, sesión y presencia de la firma |
| `npm run release`             | Comprobar, compilar y publicar una versión nueva en GitHub  |

`./build.sh debug`, `./build.sh release` y `./gradlew ...` también detectan el entorno. Para herramientas sueltas: `sh scripts/run.sh adb devices` o `sh scripts/run.sh java -version`. El entorno dura solo durante ese comando y sus procesos hijos; no hace falta activar ni desactivar una sesión.

`npm run format:java:check` y `npm run format:java` usan el formateador local `.tools/google-java-format.jar`, si está instalado, o `JAVA_FORMAT_JAR`.

## Otro equipo

`.tools/` no está en Git. Instala JDK 17 y Android SDK (por ejemplo, mediante Android Studio), y configura `JAVA_HOME` y `ANDROID_HOME` para esas instalaciones una sola vez en tu shell. También puedes colocarlos en `.tools/jdk` y `.tools/android` para usar la detección automática. No hace falta instalar Gradle globalmente: el wrapper fija su versión.

El SDK necesita Android Platform 35, Build Tools 35.0.0 y Platform Tools. Si tienes las herramientas de línea de comandos en el SDK:

```bash
sh scripts/run.sh sdkmanager --licenses
sh scripts/run.sh sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"
npm run setup
```

Revisa y acepta las licencias de Android cuando lo solicite el gestor. La primera compilación puede descargar dependencias de Gradle.

## Rutas y prioridades

`scripts/dev-env.sh` es la configuración común de `gradlew` y `scripts/run.sh`:

- Respeta `JAVA_HOME`; si falta, utiliza `.tools/jdk` cuando existe y, en último caso, Java del PATH.
- Respeta `ANDROID_HOME`, admite `ANDROID_SDK_ROOT` como alternativa y después busca `.tools/android`. Unifica ambas variables con la ruta elegida.
- Añade Java, Platform Tools y las herramientas Android `cmdline-tools/latest` al PATH del comando.
- Usa `.tools/gradle-home` y `.tools/browsers` para las cachés locales, salvo que hayas definido sus variables. En CI conserva las cachés gestionadas por el entorno.

Si cambias la versión del wrapper y regeneras `gradlew`, conserva su pequeña llamada a `scripts/dev-env.sh`. Si modificas rutas en tu terminal, `npm run doctor` permite comprobar cuáles se están usando.

## Publicación

Necesitas GitHub CLI autenticado, acceso SSH al repositorio y la firma original en `firma/signing/` o `OSP_SIGNING_DIR`. El diagnóstico comprueba la presencia de los archivos sin leer ni mostrar contraseñas; el flujo de publicación comprueba el APK firmado.

Antes de publicar, aumenta versión y código, prepara notas y guarda todos los cambios en `main`. `npm run release` exige árbol limpio y no reemplaza versiones existentes. Consulta [Publicación](publicacion.md) para el flujo completo y la prueba de actualización en Android.
