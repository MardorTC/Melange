package app.projectosp;

import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.content.FileProvider;
import java.io.*;
import java.net.HttpURLConnection;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.*;

/** Serial update state machine; its preferences and files never enter ledger backups. */
final class UpdateController implements AutoCloseable {
  private final MainActivity activity;
  private final BackupController installer;
  private final GitHubReleaseClient client = new GitHubReleaseClient();
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final AtomicBoolean busy = new AtomicBoolean();
  private volatile boolean cancelled, closed;
  private volatile JSONObject status = new JSONObject();
  private volatile GitHubReleaseClient.Release release;
  private volatile File ready;
  private final File directory;

  UpdateController(MainActivity activity, BackupController installer) {
    this.activity = activity;
    this.installer = installer;
    directory = new File(activity.getCacheDir(), "updates");
    directory.mkdirs();
    File[] partials = directory.listFiles((dir, name) -> name.endsWith(".part"));
    if (partials != null) for (File file : partials) file.delete();
    emit("idle", "", false, 0);
  }

  String state() {
    return status.toString();
  }

  void check(boolean manual) {
    if (closed || !busy.compareAndSet(false, true)) return;
    SharedPreferences prefs = activity.getSharedPreferences("updates", 0);
    long now = System.currentTimeMillis(), last = prefs.getLong("lastCheck", 0);
    if (!manual && now >= last && now - last < 24 * 60 * 60 * 1000L) {
      busy.set(false);
      return;
    }
    prefs.edit().putLong("lastCheck", now).apply();
    emit("checking", "Buscando actualizaciones…", manual, 0);
    worker.execute(
        () -> {
          try {
            GitHubReleaseClient.Release next = client.latest();
            release = next;
            ready = null;
            if (next == null || !next.descriptor.isNewer(BuildConfig.VERSION_CODE))
              emit("current", "Tienes la versión más reciente disponible.", manual, 0);
            else if (next.descriptor.minSdk > Build.VERSION.SDK_INT)
              emit(
                  "incompatible",
                  "La nueva versión requiere Android API "
                      + next.descriptor.minSdk
                      + " o posterior.",
                  manual,
                  0);
            else emit("available", "Hay una nueva versión de Melange.", manual, 0);
          } catch (Exception error) {
            emit("error", friendly(error), manual, 0);
          } finally {
            busy.set(false);
          }
        });
  }

  void download() {
    GitHubReleaseClient.Release selected = release;
    if (closed
        || selected == null
        || !selected.descriptor.isNewer(BuildConfig.VERSION_CODE)
        || selected.descriptor.minSdk > Build.VERSION.SDK_INT
        || !busy.compareAndSet(false, true)) return;
    cancelled = false;
    ready = null;
    emit("downloading", "Descargando…", true, 0);
    worker.execute(
        () -> {
          File partial = new File(directory, "update.part"),
              complete = new File(directory, "update.apk");
          HttpURLConnection connection = null;
          try {
            if (directory.getUsableSpace() < selected.descriptor.size + 5 * 1024 * 1024L)
              throw new IOException("No hay espacio suficiente para descargar el APK");
            connection = GitHubReleaseClient.open(selected.url);
            GitHubReleaseClient.requireSuccess(connection);
            long total = 0;
            int lastPercent = -1;
            try (InputStream in = connection.getInputStream();
                OutputStream out = new FileOutputStream(partial)) {
              byte[] buffer = new byte[65536];
              int n;
              while ((n = in.read(buffer)) != -1) {
                if (cancelled || closed) throw new InterruptedIOException("Descarga cancelada");
                total += n;
                if (total > selected.descriptor.size)
                  throw new IOException("El APK supera el tamaño indicado");
                out.write(buffer, 0, n);
                int percent = (int) (total * 100 / selected.descriptor.size);
                if (percent != lastPercent) {
                  lastPercent = percent;
                  emit("downloading", "Descargando…", true, percent);
                }
              }
            }
            if (cancelled || closed) throw new InterruptedIOException("Descarga cancelada");
            emit("verifying", "Verificando el APK…", true, 100);
            ApkVerifier.verify(activity, partial, selected.descriptor);
            if (cancelled || closed) throw new InterruptedIOException("Descarga cancelada");
            if (complete.exists() && !complete.delete())
              throw new IOException("No se pudo reemplazar la descarga anterior");
            if (!partial.renameTo(complete)) throw new IOException("No se pudo guardar el APK");
            ready = complete;
            emit("ready", "Actualización verificada. Ya puedes instalarla.", true, 100);
          } catch (Exception error) {
            partial.delete();
            emit(
                cancelled ? "cancelled" : "error",
                cancelled ? "Descarga cancelada." : friendly(error),
                true,
                0);
          } finally {
            if (connection != null) connection.disconnect();
            busy.set(false);
          }
        });
  }

  void cancel() {
    cancelled = true;
  }

  void install() {
    File apk = ready;
    GitHubReleaseClient.Release selected = release;
    if (closed || apk == null || selected == null || !busy.compareAndSet(false, true)) return;
    worker.execute(
        () -> {
          try {
            ApkVerifier.verify(activity, apk, selected.descriptor);
            activity.runOnUiThread(
                () -> {
                  if (!closed)
                    installer.install(
                        FileProvider.getUriForFile(
                            activity, activity.getPackageName() + ".updates", apk));
                });
          } catch (Exception error) {
            ready = null;
            emit("error", friendly(error), true, 0);
          } finally {
            busy.set(false);
          }
        });
  }

  private void emit(String phase, String message, boolean manual, int progress) {
    if (closed) return;
    try {
      JSONObject value =
          new JSONObject()
              .put("phase", phase)
              .put("message", message)
              .put("manual", manual)
              .put("progress", progress)
              .put("installedVersion", BuildConfig.VERSION_NAME);
      GitHubReleaseClient.Release selected = release;
      if (selected != null)
        value.put("release", selected.descriptor.toJson()).put("notes", selected.notes);
      status = value;
      activity.evaluate("window.nativeUpdate && window.nativeUpdate(" + value + ")");
    } catch (JSONException ignored) {
    }
  }

  private static String friendly(Exception error) {
    if (error instanceof java.net.UnknownHostException
        || error instanceof java.net.SocketTimeoutException)
      return "No se pudo conectar con GitHub. Revisa tu conexión e inténtalo de nuevo.";
    return error.getMessage() == null
        ? "No se pudo completar la actualización."
        : error.getMessage();
  }

  @Override
  public void close() {
    closed = true;
    cancelled = true;
    worker.shutdownNow();
  }
}
