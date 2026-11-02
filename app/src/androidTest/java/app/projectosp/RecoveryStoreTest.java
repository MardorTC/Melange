package app.projectosp;

import static org.junit.Assert.*;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class RecoveryStoreTest {
  @Test
  public void recoveryPreservesCorruptOriginalAndRollsBackOnFailure() {
    // An isolated database; never open the application's real projectosp.db.
    Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    String databaseName = "recovery-test-" + System.nanoTime() + ".db";
    LedgerStore store = new LedgerStore(context, databaseName);
    SQLiteDatabase db = store.getWritableDatabase();
    String damaged = "{unreadable original";
    String restored = "{\"state\":{\"schemaVersion\":10},\"history\":[],\"revision\":0}";
    try {
      db.execSQL("INSERT OR REPLACE INTO vault(id,current) VALUES(1,?)", new Object[] {damaged});
      store.writeRecovery(restored);
      assertEquals(restored, store.read());
      try (Cursor rows =
          db.rawQuery("SELECT envelope FROM recovery_backups ORDER BY id DESC LIMIT 1", null)) {
        assertTrue(rows.moveToFirst());
        assertEquals(damaged, rows.getString(0));
      }
      long before;
      try (Cursor rows = db.rawQuery("SELECT COUNT(*) FROM recovery_backups", null)) {
        rows.moveToFirst();
        before = rows.getLong(0);
      }
      db.execSQL(
          "CREATE TEMP TRIGGER reject_recovery BEFORE INSERT ON vault BEGIN SELECT RAISE(ABORT,"
              + " 'injected'); END");
      try {
        store.writeRecovery("{\"another\":true}");
        fail("Expected storage failure");
      } catch (RuntimeException expected) {
        assertEquals(restored, store.read());
      }
      try (Cursor rows = db.rawQuery("SELECT COUNT(*) FROM recovery_backups", null)) {
        rows.moveToFirst();
        assertEquals(before, rows.getLong(0));
      }
    } finally {
      db.execSQL("DROP TRIGGER IF EXISTS reject_recovery");
      store.close();
      context.deleteDatabase(databaseName);
    }
  }
}
