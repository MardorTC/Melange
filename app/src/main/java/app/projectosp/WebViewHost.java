package app.projectosp;

import android.webkit.*;
import android.net.Uri;
import android.content.Context;
import java.io.*;
import java.util.Collections;

/** Serves packaged assets only. Remote WebView navigation is never allowed. */
final class WebViewHost extends WebViewClient {
    static final String BASE = "https://appassets.androidplatform.net/";
    private final Context context;
    WebViewHost(Context context) { this.context = context; }
    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        String path = uri.getPath();
        if ("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
            && path != null && !path.contains("..") && path.matches("/[a-zA-Z0-9_/.-]+")) {
            String mime = path.endsWith(".js") ? "application/javascript" : path.endsWith(".css") ? "text/css"
                : path.endsWith(".png") ? "image/png" : path.endsWith(".json") ? "application/json" : "text/html";
            try { return new WebResourceResponse(mime, "UTF-8", context.getAssets().open(path.substring(1))); }
            catch (IOException ignored) { }
        }
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
}
