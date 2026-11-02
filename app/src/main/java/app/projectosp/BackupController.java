package app.projectosp;

import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.provider.Settings;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Android document picker and installer results. Never owns ledger state. */
final class BackupController {
  static final int IMPORT = 1, EXPORT = 2, APK = 3, INSTALL_PERMISSION = 4;
  // Keep this equal to MAX_BACKUP_BYTES in js/platform/backups.js. The check
  // covers the UTF-8 file bytes, the same measure used by the browser.
  static final int MAX_BACKUP_BYTES = 20 * 1024 * 1024;
  private final MainActivity activity;
  private String pendingExport;
  private volatile boolean exporting;
  private String exportToken;
  private Uri pendingApk;

  BackupController(MainActivity activity) {
    this.activity = activity;
  }

  static int backupBytes(String json) {
    return json == null ? 0 : json.getBytes(StandardCharsets.UTF_8).length;
  }

  static String decodeBackup(byte[] bytes) throws CharacterCodingException {
    String decoded =
        StandardCharsets.UTF_8
            .newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes))
            .toString();
    return decoded.startsWith("\ufeff") ? decoded.substring(1) : decoded;
  }

  private void sendExportResult(boolean ok, String message, long bytes, String token) {
    if (java.util.Objects.equals(exportToken, token)) {
      exporting = false;
      exportToken = null;
    }
    activity.evaluate(
        "window.nativeBackupResult && window.nativeBackupResult("
            + ok
            + ","
            + JSONObject.quote(message)
            + ","
            + bytes
            + ","
            + System.currentTimeMillis()
            + ","
            + JSONObject.quote(token)
            + ")");
  }

  void exportBackup(String json, String requestToken) {
    if (exporting) {
      if (java.util.Objects.equals(exportToken, requestToken)) {
        activity.message("Esa exportación ya está en curso.");
        return;
      }
      sendExportResult(
          false, "Ya hay una exportación en curso. Espera a que termine.", 0, requestToken);
      return;
    }
    int bytes = backupBytes(json);
    if (bytes == 0) {
      sendExportResult(
          false, "No se exportó el respaldo: el archivo quedaría vacío.", 0, requestToken);
      return;
    }
    if (bytes > MAX_BACKUP_BYTES) {
      sendExportResult(
          false,
          "No se exportó el respaldo: supera el límite de "
              + (MAX_BACKUP_BYTES / (1024 * 1024))
              + " MB y no podría volver a importarse.",
          0,
          requestToken);
      return;
    }
    pendingExport = json;
    exporting = true;
    exportToken = requestToken;
    Intent intent =
        new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .setType("application/json")
            .addCategory(Intent.CATEGORY_OPENABLE);
    intent.putExtra(Intent.EXTRA_TITLE, "Melange-" + java.time.LocalDate.now() + ".json");
    try {
      activity.startActivityForResult(intent, EXPORT);
    } catch (Exception error) {
      pendingExport = null;
      sendExportResult(false, "No se pudo abrir el selector de respaldos.", 0, requestToken);
    }
  }

  void importBackup() {
    activity.startActivityForResult(
        new Intent(Intent.ACTION_OPEN_DOCUMENT)
            .setType("*/*")
            .addCategory(Intent.CATEGORY_OPENABLE),
        IMPORT);
  }

  void pickApk() {
    activity.startActivityForResult(
        new Intent(Intent.ACTION_OPEN_DOCUMENT)
            .setType("application/vnd.android.package-archive")
            .addCategory(Intent.CATEGORY_OPENABLE),
        APK);
  }

  void install(Uri uri) {
    pendingApk = uri;
    if (!activity.getPackageManager().canRequestPackageInstalls())
      activity.startActivityForResult(
          new Intent(
              Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
              Uri.parse("package:" + activity.getPackageName())),
          INSTALL_PERMISSION);
    else launchInstaller();
  }

  private void launchInstaller() {
    try {
      activity.startActivity(
          new Intent(Intent.ACTION_VIEW)
              .setDataAndType(pendingApk, "application/vnd.android.package-archive")
              .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
    } catch (Exception e) {
      activity.message("No se pudo abrir el instalador. Vuelve a intentarlo.");
    }
  }

  void onActivityResult(int request, int result, Intent data) {
    if (request == INSTALL_PERMISSION) {
      if (activity.getPackageManager().canRequestPackageInstalls() && pendingApk != null)
        launchInstaller();
      else
        activity.message(
            "Falta permitir la instalación de actualizaciones. Puedes volver a intentarlo.");
      return;
    }
    if (result != Activity.RESULT_OK || data == null || data.getData() == null) {
      if (request == EXPORT) {
        pendingExport = null;
        sendExportResult(false, "Exportación cancelada. No se guardó un respaldo.", 0, exportToken);
      }
      return;
    }
    Uri uri = data.getData();
    if (request == IMPORT)
      new Thread(
              () -> {
                try (InputStream in = activity.getContentResolver().openInputStream(uri)) {
                  String json = decodeBackup(readLimited(in, MAX_BACKUP_BYTES));
                  activity.evaluate("window.receiveImport(" + JSONObject.quote(json) + ")");
                } catch (Exception e) {
                  activity.message("No se pudo abrir el respaldo: " + e.getMessage());
                }
              },
              "backup-import")
          .start();
    else if (request == EXPORT) {
      final String json = pendingExport;
      final String token = exportToken;
      pendingExport = null;
      new Thread(
              () -> {
                if (json == null) {
                  sendExportResult(false, "Vuelve a exportar el respaldo.", 0, token);
                  return;
                }
                byte[] backup = json.getBytes(StandardCharsets.UTF_8);
                if (backup.length > MAX_BACKUP_BYTES) {
                  sendExportResult(
                      false,
                      "El respaldo supera el límite y no podría volver a importarse.",
                      0,
                      token);
                  return;
                }
                try (OutputStream out = activity.getContentResolver().openOutputStream(uri, "wt")) {
                  out.write(backup);
                  out.flush();
                } catch (Exception e) {
                  sendExportResult(false, "No se guardó el respaldo: " + e.getMessage(), 0, token);
                  return;
                }
                // Only claim success after the stream has closed without error.
                sendExportResult(true, "Respaldo guardado.", backup.length, token);
              },
              "backup-export")
          .start();
    } else if (request == APK) {
      try {
        activity
            .getContentResolver()
            .takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
      } catch (Exception ignored) {
      }
      new Thread(
              () -> {
                File directory = new File(activity.getCacheDir(), "updates");
                directory.mkdirs();
                File file = new File(directory, "manual.apk");
                try (InputStream in = activity.getContentResolver().openInputStream(uri);
                    OutputStream out = new FileOutputStream(file)) {
                  if (in == null) throw new IOException("APK no disponible");
                  byte[] buffer = new byte[65536];
                  long size = 0;
                  int count;
                  while ((count = in.read(buffer)) != -1) {
                    size += count;
                    if (size > UpdateDescriptor.MAX_APK_BYTES)
                      throw new IOException("APK demasiado grande");
                    out.write(buffer, 0, count);
                  }
                  out.flush();
                  ApkVerifier.verify(activity, file, null);
                  activity.runOnUiThread(
                      () ->
                          install(
                              androidx.core.content.FileProvider.getUriForFile(
                                  activity, activity.getPackageName() + ".updates", file)));
                } catch (Exception error) {
                  file.delete();
                  activity.message("No se pudo instalar: " + error.getMessage());
                }
              },
              "manual-update")
          .start();
    }
  }

  static byte[] readLimited(InputStream in, int limit) throws IOException {
    if (in == null) throw new IOException("Archivo no disponible");
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] buffer = new byte[8192];
    int count;
    while ((count = in.read(buffer)) != -1) {
      if (out.size() + count > limit)
        throw new IOException("El archivo supera el tamaño permitido");
      out.write(buffer, 0, count);
    }
    return out.toByteArray();
  }
}
