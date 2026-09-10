package app.projectosp;

import android.content.Context;
import android.content.pm.*;
import android.os.Build;
import java.io.*;
import java.security.MessageDigest;
import java.util.*;

final class ApkVerifier {
  static String digest(File file) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    try (InputStream in = new FileInputStream(file)) {
      byte[] buffer = new byte[65536];
      int n;
      while ((n = in.read(buffer)) != -1) digest.update(buffer, 0, n);
    }
    StringBuilder hex = new StringBuilder();
    for (byte value : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", value & 255));
    return hex.toString();
  }

  static void verify(Context context, File file, UpdateDescriptor expected) throws Exception {
    if (expected != null
        && (file.length() != expected.size || !digest(file).equals(expected.sha256)))
      throw new IOException("El APK está incompleto o su hash no coincide");
    PackageManager manager = context.getPackageManager();
    int flags =
        Build.VERSION.SDK_INT >= 28
            ? PackageManager.GET_SIGNING_CERTIFICATES
            : PackageManager.GET_SIGNATURES;
    PackageInfo candidate = manager.getPackageArchiveInfo(file.getAbsolutePath(), flags);
    PackageInfo installed = manager.getPackageInfo(context.getPackageName(), flags);
    if (candidate == null || !context.getPackageName().equals(candidate.packageName))
      throw new IOException("El APK no pertenece a Melange");
    long code =
        Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode;
    if (code <= BuildConfig.VERSION_CODE)
      throw new IOException("El APK debe tener una versión superior a la instalada");
    if (expected != null
        && (code != expected.versionCode
            || !expected.version.equals(candidate.versionName)
            || candidate.applicationInfo.minSdkVersion != expected.minSdk))
      throw new IOException("La versión del APK no coincide con la release");
    if (candidate.applicationInfo.minSdkVersion > Build.VERSION.SDK_INT)
      throw new IOException("Esta versión requiere un Android más reciente");
    Signature[] theirs = signatures(candidate), ours = signatures(installed);
    if (!sameSigners(ours, theirs))
      throw new IOException("El APK no tiene la firma original de esta instalación");
  }

  static boolean sameSigners(Signature[] ours, Signature[] theirs) {
    return ours != null
        && theirs != null
        && ours.length > 0
        && new HashSet<>(Arrays.asList(ours)).equals(new HashSet<>(Arrays.asList(theirs)));
  }

  private static Signature[] signatures(PackageInfo info) {
    return Build.VERSION.SDK_INT >= 28
        ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners())
        : info.signatures;
  }
}
