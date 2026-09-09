package app.projectosp;

import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.database.sqlite.*;
import android.graphics.Color;
import android.net.Uri;
import android.provider.Settings;
import android.view.*;
import android.webkit.*;
import android.widget.LinearLayout;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class MainActivity extends Activity {
 private WebView web;
 private LedgerStore store;
 private BackupController backups;
 static final int NOTIFICATIONS=5;
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);store=new LedgerStore(this);backups=new BackupController(this);
  getWindow().setStatusBarColor(Color.rgb(242,232,214));getWindow().setNavigationBarColor(Color.rgb(255,253,248));
  getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(242,232,214));
  root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,-1));setContentView(root);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSafeBrowsingEnabled(true);settings.setSupportZoom(false);settings.setMediaPlaybackRequiresUserGesture(true);
  web.setBackgroundColor(Color.rgb(242,232,214));web.addJavascriptInterface(new NativeBridge(this,store,backups),"NativeOSP");
  web.setWebViewClient(new WebViewHost(this));
  web.setWebChromeClient(new WebChromeClient());web.loadUrl(WebViewHost.BASE+"index.html");
 }
 void message(String text){runOnUiThread(()->web.evaluateJavascript("window.nativeMessage("+JSONObject.quote(text)+")",null));}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);backups.onActivityResult(request,result,data);}
 @Override public void onRequestPermissionsResult(int r,String[] p,int[] g){super.onRequestPermissionsResult(r,p,g);if(r==NOTIFICATIONS)message(g.length>0&&g[0]==PackageManager.PERMISSION_GRANTED?"Recordatorios autorizados.":"Los avisos requieren permiso de notificaciones.");}
 @Override public void onBackPressed(){web.evaluateJavascript("window.handleBack ? window.handleBack() : false",value->{if(!"true".equals(value))super.onBackPressed();});}
 void evaluate(String script) {runOnUiThread(()->{if(!isFinishing()&&!isDestroyed())web.evaluateJavascript(script,null);});}
 @Override protected void onDestroy(){if(web!=null){web.removeJavascriptInterface("NativeOSP");web.destroy();}super.onDestroy();}
}
