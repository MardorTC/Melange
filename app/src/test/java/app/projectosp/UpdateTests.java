package app.projectosp;

import static org.junit.Assert.*;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import org.json.*;
import org.junit.Test;

public class UpdateTests {
  JSONObject descriptor() throws Exception {
    return new JSONObject()
        .put("version", "7.2.0")
        .put("versionCode", 70200)
        .put("minSdk", 26)
        .put("apk", "Melange-7.2.0.apk")
        .put("size", 123)
        .put("sha256", new String(new char[64]).replace('\0', 'a'));
  }

  JSONObject release() throws Exception {
    return new JSONObject()
        .put("tag_name", "v7.2.0")
        .put("body", "Notas")
        .put(
            "assets",
            new JSONArray().put(asset("update.json", 1)).put(asset("Melange-7.2.0.apk", 123)));
  }

  JSONObject asset(String name, long size) throws Exception {
    return new JSONObject()
        .put("name", name)
        .put("size", size)
        .put(
            "browser_download_url",
            "https://github.com/MardorTC/Melange/releases/download/v7.2.0/" + name);
  }

  GitHubReleaseClient client(JSONObject release, JSONObject metadata) {
    return new GitHubReleaseClient(
        (url, missing) -> missing ? release.toString() : metadata.toString());
  }

  @Test
  public void comparesNumericVersions() throws Exception {
    UpdateDescriptor d = new UpdateDescriptor(descriptor());
    assertTrue(d.isNewer(70100));
    assertFalse(d.isNewer(70200));
    assertFalse(d.isNewer(80000));
  }

  @Test
  public void rejectsBadMetadata() throws Exception {
    for (JSONObject bad :
        new JSONObject[] {
          descriptor().put("size", 0),
          descriptor().put("size", UpdateDescriptor.MAX_APK_BYTES + 1),
          descriptor().put("sha256", "bad"),
          descriptor().put("apk", "../../evil.apk"),
          descriptor().put("versionCode", 70200.5),
          descriptor().put("minSdk", 1)
        }) assertThrows(IOException.class, () -> new UpdateDescriptor(bad));
  }

  @Test
  public void resolvesOnlyCompleteStableRelease() throws Exception {
    GitHubReleaseClient.Release r = client(release(), descriptor()).latest();
    assertEquals("7.2.0", r.descriptor.version);
    assertEquals("Notas", r.notes);
    assertNull(client(release().put("prerelease", true), descriptor()).latest());
    assertNull(new GitHubReleaseClient((u, m) -> null).latest());
  }

  @Test
  public void rejectsMismatchedTagAndAsset() throws Exception {
    assertThrows(
        IOException.class,
        () -> client(release().put("tag_name", "v9.0.0"), descriptor()).latest());
    assertThrows(
        IOException.class, () -> client(release(), descriptor().put("size", 124)).latest());
    assertThrows(
        IOException.class,
        () -> client(release().put("assets", new JSONArray()), descriptor()).latest());
  }

  @Test
  public void propagatesNetworkFailure() {
    assertThrows(
        IOException.class,
        () ->
            new GitHubReleaseClient(
                    (u, m) -> {
                      throw new UnknownHostException("offline");
                    })
                .latest());
  }

  @Test
  public void restrictsRedirects() throws Exception {
    assertTrue(
        GitHubReleaseClient.allowed(new URL("https://release-assets.githubusercontent.com/file")));
    for (String url :
        new String[] {
          "http://github.com/x",
          "https://github.com.evil.test/x",
          "https://evil.test/x",
          "https://user@github.com/x",
          "https://github.com:444/x"
        }) assertFalse(GitHubReleaseClient.allowed(new URL(url)));
  }

  @Test
  public void rejectsForeignAssetOrigin() throws Exception {
    JSONObject r = release();
    r.getJSONArray("assets")
        .getJSONObject(0)
        .put(
            "browser_download_url",
            "https://github.com/Someone/Other/releases/download/v7.2.0/update.json");
    assertThrows(IOException.class, () -> client(r, descriptor()).latest());
  }

  @Test
  public void rejectsRateLimitAndHttpErrors() throws Exception {
    for (int code : new int[] {403, 429, 500, 404}) {
      HttpURLConnection c =
          new HttpURLConnection(new URL("https://github.com")) {
            public void connect() {}

            public void disconnect() {}

            public boolean usingProxy() {
              return false;
            }

            public int getResponseCode() {
              return code;
            }
          };
      assertThrows(IOException.class, () -> GitHubReleaseClient.requireSuccess(c));
    }
  }

  @Test
  public void hashesActualBytes() throws Exception {
    File file = File.createTempFile("melange-hash", ".apk");
    try {
      try (FileOutputStream out = new FileOutputStream(file)) {
        out.write("abc".getBytes(StandardCharsets.UTF_8));
      }
      assertEquals(
          "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
          ApkVerifier.digest(file));
    } finally {
      file.delete();
    }
  }

  @Test
  public void rejectsHashMismatchBeforeOpeningPackage() throws Exception {
    File file = File.createTempFile("bad-apk", ".apk");
    try {
      try (FileOutputStream out = new FileOutputStream(file)) {
        out.write(new byte[123]);
      }
      assertThrows(
          IOException.class,
          () -> ApkVerifier.verify(null, file, new UpdateDescriptor(descriptor())));
    } finally {
      file.delete();
    }
  }
}
