package app.projectosp;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import org.json.*;

/** Public stable channel. No account tokens, financial data, or remote HTML. */
final class GitHubReleaseClient {
  static final String REPOSITORY = "MardorTC/Melange";
  static final String API = "https://api.github.com/repos/" + REPOSITORY + "/releases/latest";

  interface JsonReader {
    String read(String url, boolean allowNotFound) throws IOException;
  }

  private final JsonReader reader;

  GitHubReleaseClient() {
    reader = this::readJson;
  }

  GitHubReleaseClient(JsonReader reader) {
    this.reader = reader;
  }

  static final class Release {
    final UpdateDescriptor descriptor;
    final String url, notes;

    Release(UpdateDescriptor descriptor, String url, String notes) {
      this.descriptor = descriptor;
      this.url = url;
      this.notes = notes;
    }
  }

  Release latest() throws Exception {
    String body = reader.read(API, true);
    if (body == null) return null;
    JSONObject release = new JSONObject(body);
    if (release.optBoolean("draft") || release.optBoolean("prerelease")) return null;
    JSONArray assets = release.getJSONArray("assets");
    JSONObject metadata = findAsset(assets, "update.json");
    if (metadata == null) throw new IOException("La release todavía no incluye update.json");
    UpdateDescriptor descriptor =
        new UpdateDescriptor(new JSONObject(reader.read(assetUrl(metadata), false)));
    if (!release.getString("tag_name").equals("v" + descriptor.version))
      throw new IOException("La versión no coincide con la release");
    JSONObject apk = findAsset(assets, descriptor.apk);
    if (apk == null || apk.getLong("size") != descriptor.size)
      throw new IOException("El APK de la release no coincide con los metadatos");
    return new Release(descriptor, assetUrl(apk), release.optString("body", ""));
  }

  private static JSONObject findAsset(JSONArray assets, String name) throws Exception {
    JSONObject found = null;
    for (int i = 0; i < assets.length(); i++) {
      JSONObject asset = assets.getJSONObject(i);
      if (name.equals(asset.optString("name"))) {
        if (found != null) throw new IOException("Archivo duplicado en la release");
        found = asset;
      }
    }
    return found;
  }

  private static String assetUrl(JSONObject asset) throws Exception {
    String url = asset.getString("browser_download_url");
    if (!url.startsWith("https://github.com/" + REPOSITORY + "/releases/download/"))
      throw new IOException("Origen de actualización inválido");
    return url;
  }

  static boolean allowed(URL url) {
    String host = url.getHost();
    return "https".equals(url.getProtocol())
        && (url.getPort() == -1 || url.getPort() == 443)
        && url.getUserInfo() == null
        && (host.equals("api.github.com")
            || host.equals("github.com")
            || host.equals("release-assets.githubusercontent.com")
            || host.equals("objects.githubusercontent.com"));
  }

  static HttpURLConnection open(String address) throws IOException {
    URL url = new URL(address);
    for (int redirects = 0; redirects <= 5; redirects++) {
      if (!allowed(url)) throw new IOException("Destino de descarga no permitido");
      HttpURLConnection connection = (HttpURLConnection) url.openConnection();
      connection.setConnectTimeout(15000);
      connection.setReadTimeout(20000);
      connection.setInstanceFollowRedirects(false);
      connection.setRequestProperty("User-Agent", "Melange-Android");
      connection.setRequestProperty("Accept", "application/vnd.github+json");
      int code = connection.getResponseCode();
      if (code >= 300 && code < 400) {
        String location = connection.getHeaderField("Location");
        connection.disconnect();
        if (location == null) throw new IOException("Redirección inválida");
        url = new URL(url, location);
        continue;
      }
      return connection;
    }
    throw new IOException("Demasiadas redirecciones");
  }

  private String readJson(String url, boolean allowNotFound) throws IOException {
    HttpURLConnection connection = open(url);
    try {
      if (allowNotFound && connection.getResponseCode() == 404) return null;
      requireSuccess(connection);
      try (InputStream in = connection.getInputStream()) {
        return new String(BackupController.readLimited(in, 1024 * 1024), StandardCharsets.UTF_8);
      }
    } finally {
      connection.disconnect();
    }
  }

  static void requireSuccess(HttpURLConnection connection) throws IOException {
    int code = connection.getResponseCode();
    if (code == 403 || code == 429)
      throw new IOException("GitHub limitó las consultas. Inténtalo más tarde");
    if (code != 200)
      throw new IOException("No se pudo descargar la actualización (HTTP " + code + ")");
  }
}
