package app.projectosp;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.*;

final class LedgerStore extends SQLiteOpenHelper {
  LedgerStore(Context c) {
    super(c, "projectosp.db", null, 1);
  }

  @Override
  public void onCreate(SQLiteDatabase db) {
    db.execSQL(
        "CREATE TABLE vault (id INTEGER PRIMARY KEY CHECK(id=1), current TEXT NOT NULL, previous"
            + " TEXT)");
  }

  @Override
  public void onUpgrade(SQLiteDatabase db, int oldV, int newV) {
    throw new IllegalStateException("No hay migración registrada");
  }

  synchronized String read() {
    try (Cursor c = getReadableDatabase().rawQuery("SELECT current FROM vault WHERE id=1", null)) {
      return c.moveToFirst() ? c.getString(0) : "";
    }
  }

  synchronized void write(String json) {
    SQLiteDatabase db = getWritableDatabase();
    db.beginTransaction();
    try {
      String old = read();
      db.execSQL(
          "CREATE TABLE IF NOT EXISTS migration_backups (version INTEGER PRIMARY KEY, envelope TEXT"
              + " NOT NULL)");
      if (!old.isEmpty() && !json.isEmpty()) {
        try {
          int previousVersion =
              new org.json.JSONObject(old).getJSONObject("state").getInt("schemaVersion");
          int nextVersion =
              new org.json.JSONObject(json).getJSONObject("state").getInt("schemaVersion");
          if (previousVersion < nextVersion) {
            ContentValues backup = new ContentValues();
            backup.put("version", previousVersion);
            backup.put("envelope", old);
            if (db.insertWithOnConflict(
                    "migration_backups", null, backup, SQLiteDatabase.CONFLICT_IGNORE)
                == -1) {
              try (Cursor existing =
                  db.rawQuery(
                      "SELECT version FROM migration_backups WHERE version=?",
                      new String[] {String.valueOf(previousVersion)})) {
                if (!existing.moveToFirst())
                  throw new IllegalStateException("No se pudo conservar el original");
              }
            }
          }
        } catch (org.json.JSONException error) {
          throw new IllegalArgumentException(
              "Estado anterior incompatible; no se reemplazó", error);
        }
      }
      ContentValues v = new ContentValues();
      v.put("id", 1);
      v.put("current", json);
      v.put("previous", old);
      if (db.insertWithOnConflict("vault", null, v, SQLiteDatabase.CONFLICT_REPLACE) == -1)
        throw new IllegalStateException("No se pudo guardar el libro");
      db.setTransactionSuccessful();
    } finally {
      db.endTransaction();
    }
  }
}
