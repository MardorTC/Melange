package app.projectosp;

import static org.junit.Assert.*;

import java.time.*;
import org.junit.Test;

public class ReminderTimeTest {
  @Test
  public void configuredTimeAndTomorrow() {
    ZonedDateTime now =
        ZonedDateTime.of(2026, 9, 11, 12, 0, 0, 0, ZoneId.of("America/Mexico_City"));
    assertEquals(
        "2026-09-11T18:35",
        ReminderReceiver.nextReminder(now, "18:35").toLocalDateTime().toString());
    assertEquals(
        "2026-09-12T09:00",
        ReminderReceiver.nextReminder(now, "invalid").toLocalDateTime().toString());
  }

  @Test
  public void zoneChangeAndDstGapKeepLocalClockOnFollowingDay() {
    ZonedDateTime now = ZonedDateTime.of(2026, 3, 8, 0, 0, 0, 0, ZoneId.of("America/New_York"));
    assertEquals(3, ReminderReceiver.nextReminder(now, "02:30").getHour());
    assertEquals(2, ReminderReceiver.nextReminder(now.plusDays(1), "02:30").getHour());
    assertEquals(
        ZoneId.of("Asia/Tokyo"),
        ReminderReceiver.nextReminder(now.withZoneSameInstant(ZoneId.of("Asia/Tokyo")), "18:35")
            .getZone());
  }
}
