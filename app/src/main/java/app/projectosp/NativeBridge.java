package app.projectosp;

import android.webkit.JavascriptInterface;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import org.json.JSONObject;

/** The only interface exposed to packaged JavaScript. */
final class NativeBridge {
    private final MainActivity activity;
    private final LedgerStore store;
    private final BackupController backups;
    NativeBridge(MainActivity activity,LedgerStore store,BackupController backups) {this.activity=activity;this.store=store;this.backups=backups;}
    @JavascriptInterface public String read(){try{return store.read();}catch(Exception e){return "ERROR:No se pudo leer la base local. "+e.getMessage();}}
    @JavascriptInterface public String write(String json){try{if(json.length()>40*1024*1024)throw new Exception("Respaldo demasiado grande");JSONObject obj=new JSONObject(json);if(obj.getJSONObject("state").getInt("schemaVersion")!=7)throw new Exception("Versión incompatible");store.write(json);return "OK";}catch(Exception e){return "ERROR:No se guardó el cambio: "+e.getMessage();}}
    @JavascriptInterface public void writeAsync(String json,int requestId){new Thread(()->{String result=write(json);activity.evaluate("window.nativeSaved("+requestId+","+JSONObject.quote(result)+")");},"ledger-write").start();}
    @JavascriptInterface public void exportBackup(String json){activity.runOnUiThread(()->backups.exportBackup(json));}
    @JavascriptInterface public void importBackup(){activity.runOnUiThread(backups::importBackup);}
    @JavascriptInterface public void installUpdate(){activity.runOnUiThread(backups::pickApk);}
    @JavascriptInterface public String appInfo(){return "{\"version\":\""+BuildConfig.VERSION_NAME+"\",\"versionCode\":"+BuildConfig.VERSION_CODE+"}";}
    @JavascriptInterface public void configureReminders(String json){try{new JSONObject(json);activity.getSharedPreferences("reminders",0).edit().putString("config",json).apply();activity.getSystemService(NotificationManager.class).cancel(702);ReminderReceiver.schedule(activity);}catch(Exception e){activity.message("No se pudieron programar los recordatorios.");}}
    @JavascriptInterface public void requestNotifications(){activity.runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33&&activity.checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=PackageManager.PERMISSION_GRANTED)activity.requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},MainActivity.NOTIFICATIONS);else if(!activity.getSystemService(NotificationManager.class).areNotificationsEnabled()){Intent i=new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);i.putExtra(Settings.EXTRA_APP_PACKAGE,activity.getPackageName());activity.startActivity(i);}else activity.message("Los avisos del sistema están habilitados.");});}
    @JavascriptInterface public String notificationStatus(){return activity.getSystemService(NotificationManager.class).areNotificationsEnabled()?"Permiso del sistema concedido.":"Falta habilitar las notificaciones en Android.";}
}
