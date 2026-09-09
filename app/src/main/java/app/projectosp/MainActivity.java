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
 private Store store;
 private String pendingExport;
 private Uri pendingApk;
 private static final int IMPORT=1,EXPORT=2,APK=3,INSTALL_PERMISSION=4,NOTIFICATIONS=5;
 private static final String BASE="https://appassets.androidplatform.net/";
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);store=new Store(this);
  getWindow().setStatusBarColor(Color.rgb(242,232,214));getWindow().setNavigationBarColor(Color.rgb(255,253,248));
  getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(242,232,214));
  root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,-1));setContentView(root);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSafeBrowsingEnabled(true);settings.setSupportZoom(false);settings.setMediaPlaybackRequiresUserGesture(true);
  web.setBackgroundColor(Color.rgb(242,232,214));web.addJavascriptInterface(new Bridge(),"NativeOSP");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){return true;}
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
    Uri u=r.getUrl();String path=u.getPath();
    if("https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())&&path!=null&&path.matches("/(index\\.html|core\\.js|app\\.js|app\\.css|history-core\\.js|screens\\.js|melange\\.css|logo\\.png)")){
     try{return new WebResourceResponse(path.endsWith(".png")?"image/png":path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":"text/html","UTF-8",getAssets().open(path.substring(1)));}catch(IOException e){}
    }
    return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
   }
  });
  web.setWebChromeClient(new WebChromeClient());web.loadUrl(BASE+"index.html");
 }
 private void message(String text){runOnUiThread(()->web.evaluateJavascript("window.nativeMessage("+JSONObject.quote(text)+")",null));}
 public class Bridge {
  @JavascriptInterface public String read(){try{return store.read();}catch(Exception e){return "ERROR:No se pudo leer la base local. "+e.getMessage();}}
  @JavascriptInterface public String write(String json){try{if(json.length()>40*1024*1024)throw new Exception("Respaldo demasiado grande");JSONObject obj=new JSONObject(json);if(obj.getJSONObject("state").getInt("schemaVersion")!=7)throw new Exception("Versión incompatible");store.write(json);return "OK";}catch(Exception e){return "ERROR:No se guardó el cambio: "+e.getMessage();}}
  @JavascriptInterface public void writeAsync(String json,int requestId){new Thread(()->{String result=write(json);runOnUiThread(()->{if(!isFinishing()&&!isDestroyed())web.evaluateJavascript("window.nativeSaved("+requestId+","+JSONObject.quote(result)+")",null);});}).start();}
  @JavascriptInterface public void exportBackup(String json){pendingExport=json;runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.setType("application/json");i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_TITLE,"Melange-"+java.time.LocalDate.now()+".json");startActivityForResult(i,EXPORT);});}
  @JavascriptInterface public void importBackup(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,IMPORT);});}
  @JavascriptInterface public void installUpdate(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("application/vnd.android.package-archive");i.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,APK);});}
  @JavascriptInterface public void configureReminders(String json){try{new JSONObject(json);getSharedPreferences("reminders",0).edit().putString("config",json).apply();getSystemService(NotificationManager.class).cancel(702);ReminderReceiver.schedule(MainActivity.this);}catch(Exception e){message("No se pudieron programar los recordatorios.");}}
  @JavascriptInterface public void requestNotifications(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33&&checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},NOTIFICATIONS);else if(!getSystemService(NotificationManager.class).areNotificationsEnabled()){Intent i=new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);i.putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName());startActivity(i);}else message("Los avisos del sistema están habilitados.");});}
  @JavascriptInterface public String notificationStatus(){return getSystemService(NotificationManager.class).areNotificationsEnabled()?"Permiso del sistema concedido.":"Falta habilitar las notificaciones en Android.";}
 }
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==INSTALL_PERMISSION){if(getPackageManager().canRequestPackageInstalls()&&pendingApk!=null)launchInstaller();return;}if(result!=RESULT_OK||data==null||data.getData()==null)return;Uri uri=data.getData();
  if(request==IMPORT)new Thread(()->{try(InputStream in=getContentResolver().openInputStream(uri)){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>20*1024*1024)throw new IOException("El archivo supera 20 MB");}String json=out.toString("UTF-8");runOnUiThread(()->web.evaluateJavascript("window.receiveImport("+JSONObject.quote(json)+")",null));}catch(Exception e){message("No se pudo abrir el respaldo: "+e.getMessage());}}).start();
  else if(request==EXPORT){final String json=pendingExport;pendingExport=null;new Thread(()->{try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(json==null)throw new IOException("Vuelve a exportar el respaldo");out.write(json.getBytes(StandardCharsets.UTF_8));message("Respaldo guardado.");}catch(Exception e){message("No se guardó el respaldo: "+e.getMessage());}}).start();}
  else if(request==APK){pendingApk=uri;try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignored){}if(!getPackageManager().canRequestPackageInstalls())startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getPackageName())),INSTALL_PERMISSION);else launchInstaller();}
 }
 private void launchInstaller(){try{Intent i=new Intent(Intent.ACTION_VIEW);i.setDataAndType(pendingApk,"application/vnd.android.package-archive");i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(i);}catch(Exception e){message("Abre el APK desde Archivos para instalar la actualización.");}}
 @Override public void onRequestPermissionsResult(int r,String[] p,int[] g){super.onRequestPermissionsResult(r,p,g);if(r==NOTIFICATIONS)message(g.length>0&&g[0]==PackageManager.PERMISSION_GRANTED?"Recordatorios autorizados.":"Los avisos requieren permiso de notificaciones.");}
 @Override public void onBackPressed(){web.evaluateJavascript("window.handleBack ? window.handleBack() : false",value->{if(!"true".equals(value))super.onBackPressed();});}
 @Override protected void onDestroy(){if(web!=null){web.removeJavascriptInterface("NativeOSP");web.destroy();}super.onDestroy();}
 static class Store extends SQLiteOpenHelper {
  Store(Context c){super(c,"projectosp.db",null,1);}
  @Override public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE vault (id INTEGER PRIMARY KEY CHECK(id=1), current TEXT NOT NULL, previous TEXT)");}
  @Override public void onUpgrade(SQLiteDatabase db,int oldV,int newV){throw new IllegalStateException("No hay migración registrada");}
  synchronized String read(){try(Cursor c=getReadableDatabase().rawQuery("SELECT current FROM vault WHERE id=1",null)){return c.moveToFirst()?c.getString(0):"";}}
  synchronized void write(String json){SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{String old=read();ContentValues v=new ContentValues();v.put("id",1);v.put("current",json);v.put("previous",old);db.insertWithOnConflict("vault",null,v,SQLiteDatabase.CONFLICT_REPLACE);db.setTransactionSuccessful();}finally{db.endTransaction();}}
 }
}
