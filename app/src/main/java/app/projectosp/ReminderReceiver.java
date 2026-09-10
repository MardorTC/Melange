package app.projectosp;

import android.app.*;
import android.content.*;
import java.time.*;
import java.util.*;
import org.json.*;

public class ReminderReceiver extends BroadcastReceiver {
  static final String CHANNEL = "payments";

  static PendingIntent alarm(Context c) {
    return PendingIntent.getBroadcast(
        c,
        701,
        new Intent(c, ReminderReceiver.class).setAction("app.projectosp.REMIND"),
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  static void schedule(Context c) {
    AlarmManager a = c.getSystemService(AlarmManager.class);
    a.cancel(alarm(c));
    try {
      JSONObject cfg =
          new JSONObject(c.getSharedPreferences("reminders", 0).getString("config", "{}"));
      if (!cfg.optBoolean("enabled")) return;
      ZonedDateTime now = ZonedDateTime.now(),
          next = now.withHour(9).withMinute(0).withSecond(0).withNano(0);
      if (!next.isAfter(now)) next = next.plusDays(1);
      a.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.toInstant().toEpochMilli(), alarm(c));
    } catch (Exception ignored) {
    }
  }

  @Override
  public void onReceive(Context context, Intent intent) {
    try {
      if (!"app.projectosp.REMIND".equals(intent.getAction())) {
        schedule(context);
        return;
      }
      android.content.SharedPreferences prefs = context.getSharedPreferences("reminders", 0);
      JSONObject cfg = new JSONObject(prefs.getString("config", "{}"));
      if (!cfg.optBoolean("enabled")) return;
      JSONArray items = cfg.optJSONArray("items");
      LocalDate today = LocalDate.now();
      int count = 0, days = cfg.optInt("days", 2);
      if (items != null)
        for (int i = 0; i < items.length(); i++) {
          LocalDate due = LocalDate.parse(items.getJSONObject(i).getString("date"));
          if (!due.isBefore(today) && !due.isAfter(today.plusDays(days))) count++;
        }
      NotificationManager manager = context.getSystemService(NotificationManager.class);
      manager.createNotificationChannel(
          new NotificationChannel(
              CHANNEL, "Vencimientos de pago", NotificationManager.IMPORTANCE_DEFAULT));
      if (count > 0
          && manager.areNotificationsEnabled()
          && !today.toString().equals(prefs.getString("lastSent", ""))) {
        PendingIntent open =
            PendingIntent.getActivity(
                context,
                0,
                new Intent(context, MainActivity.class),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n =
            new Notification.Builder(context, CHANNEL)
                .setSmallIcon(app.projectosp.R.drawable.icon)
                .setContentTitle("Tus próximos pagos")
                .setContentText(
                    "Tienes "
                        + count
                        + " compromiso"
                        + (count == 1 ? "" : "s")
                        + " próximo"
                        + (count == 1 ? "" : "s")
                        + ". Revisa Melange.")
                .setContentIntent(open)
                .setAutoCancel(true)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .build();
        manager.notify(702, n);
        prefs.edit().putString("lastSent", today.toString()).apply();
      }
    } catch (Exception ignored) {
    } finally {
      schedule(context);
    }
  }
}
