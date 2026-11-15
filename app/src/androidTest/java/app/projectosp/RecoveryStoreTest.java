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
  public void bridgeAcceptsOnlyTheCurrentLedgerSchema() {
    Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    String databaseName = "schema-test-" + System.nanoTime() + ".db";
    LedgerStore store = new LedgerStore(context, databaseName);
    try {
      NativeBridge bridge = new NativeBridge(null, store, null, null);
      String current =
          "{\"state\":{\"schemaVersion\":"
              + NativeBridge.SCHEMA_VERSION
              + "},\"history\":[],\"revision\":1}";
      assertEquals("OK", bridge.write(current));
      assertEquals(current, bridge.read());
      assertTrue(
          bridge
              .write("{\"state\":{\"schemaVersion\":10},\"history\":[],\"revision\":2}")
              .startsWith("ERROR:"));
      assertTrue(
          bridge
              .write(
                  "{\"state\":{\"schemaVersion\":"
                      + (NativeBridge.SCHEMA_VERSION + 1)
                      + "},\"history\":[],\"revision\":2}")
              .startsWith("ERROR:"));
      assertEquals(current, bridge.read());
    } finally {
      store.close();
      context.deleteDatabase(databaseName);
    }
  }

  @Test
  public void readsAndRewritesABookLargerThanOneCursorWindow() {
    Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
    String databaseName = "large-ledger-test-" + System.nanoTime() + ".db";
    LedgerStore store = new LedgerStore(context, databaseName);
    try {
      // About 5 MB in UTF-8, with multibyte characters crossing chunk borders.
      StringBuilder notes = new StringBuilder();
      while (notes.length() < 2_400_000) notes.append("Nómina ñ € 😀 ");
      String large =
          "{\"state\":{\"schemaVersion\":10,\"notes\":\""
              + notes
              + "\"},\"history\":[],\"revision\":1}";
      store.write(large);
      assertEquals(large, store.read());
      String next = large.replace("\"revision\":1", "\"revision\":2");
      store.write(next);
      assertEquals(next, store.read());
    } finally {
      store.close();
      context.deleteDatabase(databaseName);
    }
  }

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
