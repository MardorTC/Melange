package app.projectosp;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.Intent;
import android.content.pm.Signature;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.*;
import org.junit.*;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class AndroidSmokeTest {
  @Test
  public void nativeStorageAndSignatures() throws Exception {
    android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    Context context = instrumentation.getTargetContext();
    LedgerStore store = new LedgerStore(context);
    String original = store.read();
    String marker =
        "{\"state\":{\"schemaVersion\":7},\"history\":[],\"draft\":null,\"revision\":17}";
    store.write(marker);
    assertEquals(marker, store.read());
    String upgraded = marker.replace("schemaVersion\":7", "schemaVersion\":8");
    store.write(upgraded);
    assertEquals(upgraded, store.read());
    try (android.database.Cursor backup =
        store
            .getReadableDatabase()
            .rawQuery("SELECT envelope FROM migration_backups WHERE version=7", null)) {
      assertTrue(backup.moveToFirst());
      assertTrue(backup.getString(0).contains("schemaVersion\":7"));
    }
    store.write(original);
    store.close();
    Signature first = new Signature("0011"), second = new Signature("0022");
    assertTrue(
        ApkVerifier.sameSigners(new Signature[] {first}, new Signature[] {new Signature("0011")}));
    assertFalse(ApkVerifier.sameSigners(new Signature[] {first}, new Signature[] {second}));
  }

  @Test
  public void modernWebViewLoadsModulesAndBridge() throws Exception {
    android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    Context context = instrumentation.getTargetContext();
    android.content.pm.PackageInfo provider = WebView.getCurrentWebViewPackage();
    Assume.assumeTrue(
        "System image requires an updated WebView (92+)",
        provider != null && Integer.parseInt(provider.versionName.split("\\.")[0]) >= 92);
    String fixture;
    try (java.io.InputStream input =
        instrumentation.getContext().getAssets().open("v7-upgrade.json")) {
      java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
      byte[] buffer = new byte[4096];
      int count;
      while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
      fixture = bytes.toString("UTF-8");
    }
    LedgerStore seed = new LedgerStore(context);
    seed.write(fixture);
    seed.close();
    MainActivity activity =
        (MainActivity)
            instrumentation.startActivitySync(
                new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    try {
      WebView web = find(activity.getWindow().getDecorView());
      assertNotNull(web);
      String loaded = "";
      long deadline = System.currentTimeMillis() + 90000;
      while (System.currentTimeMillis() < deadline) {
        loaded = eval(instrumentation, web, "document.querySelector('#view')?.textContent || ''");
        if (loaded.contains("Empezar desde cero")) {
          eval(instrumentation, web, "document.querySelector('[data-action=start]').click()");
        }
        if (loaded.contains("Cada grano cuenta") || loaded.contains("No se pudieron abrir")) break;
        Thread.sleep(500);
      }
      assertTrue(
          "WebView did not load the application: " + loaded, loaded.contains("Cada grano cuenta"));
      String info = eval(instrumentation, web, "NativeOSP.appInfo()");
      assertTrue(info.contains(BuildConfig.VERSION_NAME));
      assertEquals(
          "true", eval(instrumentation, web, "JSON.parse(NativeOSP.read()).state.started"));
      assertEquals(
          "8", eval(instrumentation, web, "JSON.parse(NativeOSP.read()).state.schemaVersion"));
      assertEquals("2", eval(instrumentation, web, "JSON.parse(NativeOSP.read()).draft.version"));
      assertEquals(
          "8",
          eval(
              instrumentation, web, "JSON.parse(NativeOSP.read()).history[0].state.schemaVersion"));
      assertEquals(
          "830000",
          eval(
              instrumentation,
              web,
              "JSON.parse(NativeOSP.read()).state.walletAccounts.find(a=>a.id==='debit').opening"));
      assertEquals(
          "100000",
          eval(instrumentation, web, "JSON.parse(NativeOSP.read()).state.goals[0].balance"));
      assertEquals("\"undefined\"", eval(instrumentation, web, "typeof window.OSP"));
      assertEquals("\"function\"", eval(instrumentation, web, "typeof window.nativeUpdate"));
      assertEquals("true", eval(instrumentation, web, "window.handleBack() === false"));
    } finally {
      instrumentation.runOnMainSync(activity::finish);
    }
  }

  private static WebView find(View view) {
    if (view instanceof WebView) return (WebView) view;
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup) view;
      for (int i = 0; i < group.getChildCount(); i++) {
        WebView found = find(group.getChildAt(i));
        if (found != null) return found;
      }
    }
    return null;
  }

  private static String eval(
      android.app.Instrumentation instrumentation, WebView web, String script) throws Exception {
    CompletableFuture<String> result = new CompletableFuture<>();
    instrumentation.runOnMainSync(() -> web.evaluateJavascript(script, result::complete));
    return result.get(20, TimeUnit.SECONDS);
  }
}
