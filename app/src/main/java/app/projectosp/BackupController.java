package app.projectosp;

import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.provider.Settings;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Android document picker and installer results. Never owns ledger state. */
final class BackupController {
  static final int IMPORT = 1, EXPORT = 2, APK = 3, INSTALL_PERMISSION = 4;
  private final MainActivity activity;
  private String pendingExport;
  private Uri pendingApk;

  BackupController(MainActivity activity) {
    this.activity = activity;
  }

  void exportBackup(String json) {
    pendingExport = json;
    Intent intent =
        new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .setType("application/json")
            .addCategory(Intent.CATEGORY_OPENABLE);
    intent.putExtra(Intent.EXTRA_TITLE, "Melange-" + java.time.LocalDate.now() + ".json");
    activity.startActivityForResult(intent, EXPORT);
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
    if (result != Activity.RESULT_OK || data == null || data.getData() == null) return;
    Uri uri = data.getData();
    if (request == IMPORT)
      new Thread(
              () -> {
                try (InputStream in = activity.getContentResolver().openInputStream(uri)) {
                  String json =
                      new String(readLimited(in, 20 * 1024 * 1024), StandardCharsets.UTF_8);
                  activity.evaluate("window.receiveImport(" + JSONObject.quote(json) + ")");
                } catch (Exception e) {
                  activity.message("No se pudo abrir el respaldo: " + e.getMessage());
                }
              },
              "backup-import")
          .start();
    else if (request == EXPORT) {
      final String json = pendingExport;
      pendingExport = null;
      new Thread(
              () -> {
                try (OutputStream out = activity.getContentResolver().openOutputStream(uri, "wt")) {
                  if (json == null) throw new IOException("Vuelve a exportar el respaldo");
                  out.write(json.getBytes(StandardCharsets.UTF_8));
                  activity.message("Respaldo guardado.");
                } catch (Exception e) {
                  activity.message("No se guardó el respaldo: " + e.getMessage());
                }
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
