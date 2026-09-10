package app.projectosp;

import java.io.IOException;
import org.json.*;

/** Validated release metadata. URLs are resolved from GitHub assets, never from JSON. */
final class UpdateDescriptor {
  static final long MAX_APK_BYTES = 200L * 1024 * 1024;
  final String version, apk, sha256;
  final int versionCode, minSdk;
  final long size;

  UpdateDescriptor(JSONObject json) throws IOException {
    try {
      version = json.getString("version");
      apk = json.getString("apk");
      sha256 = json.getString("sha256");
      versionCode = integer(json, "versionCode");
      minSdk = integer(json, "minSdk");
      size = json.getLong("size");
      if (!version.matches("[0-9]+\\.[0-9]+\\.[0-9]+")
          || !apk.equals("Melange-" + version + ".apk")
          || !sha256.matches("[a-f0-9]{64}")
          || versionCode <= 0
          || minSdk < 26
          || size <= 0
          || size > MAX_APK_BYTES
          || json.getDouble("size") != size)
        throw new IOException("Metadatos de actualización inválidos");
    } catch (JSONException e) {
      throw new IOException("Metadatos de actualización incompletos", e);
    }
  }

  private static int integer(JSONObject json, String key) throws JSONException, IOException {
    double value = json.getDouble(key);
    if (!Double.isFinite(value)
        || value != Math.rint(value)
        || value > Integer.MAX_VALUE
        || value < 0) throw new IOException("Versión inválida");
    return (int) value;
  }

  boolean isNewer(int installed) {
    return versionCode > installed;
  }

  JSONObject toJson() throws JSONException {
    return new JSONObject()
        .put("version", version)
        .put("versionCode", versionCode)
        .put("minSdk", minSdk)
        .put("apk", apk)
        .put("size", size)
        .put("sha256", sha256);
  }
}
