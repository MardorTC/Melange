package app.projectosp;

import android.content.Context;
import android.net.Uri;
import android.webkit.*;
import java.io.*;
import java.util.Collections;

/** Serves packaged assets only. Remote WebView navigation is never allowed. */
final class WebViewHost extends WebViewClient {
  static final String BASE = "https://appassets.androidplatform.net/";
  private final Context context;

  WebViewHost(Context context) {
    this.context = context;
  }

  static String mimeType(String path) {
    if (path.endsWith(".svg")) return "image/svg+xml";
    if (path.endsWith(".js")) return "application/javascript";
    if (path.endsWith(".css")) return "text/css";
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".json")) return "application/json";
    return "text/html";
  }

  @Override
  public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
    return true;
  }

  @Override
  public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
    Uri uri = request.getUrl();
    String path = uri.getPath();
    if ("https".equals(uri.getScheme())
        && "appassets.androidplatform.net".equals(uri.getHost())
        && path != null
        && !path.contains("..")
        && path.matches("/[a-zA-Z0-9_/.-]+")) {
      String mime = mimeType(path);
      try {
        return new WebResourceResponse(mime, "UTF-8", context.getAssets().open(path.substring(1)));
      } catch (IOException ignored) {
      }
    }
    return new WebResourceResponse(
        "text/plain",
        "UTF-8",
        403,
        "Blocked",
        Collections.emptyMap(),
        new ByteArrayInputStream(new byte[0]));
  }
}
