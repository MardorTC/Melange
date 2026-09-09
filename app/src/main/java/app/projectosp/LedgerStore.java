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

final class LedgerStore extends SQLiteOpenHelper {
  LedgerStore(Context c){super(c,"projectosp.db",null,1);}
  @Override public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE vault (id INTEGER PRIMARY KEY CHECK(id=1), current TEXT NOT NULL, previous TEXT)");}
  @Override public void onUpgrade(SQLiteDatabase db,int oldV,int newV){throw new IllegalStateException("No hay migración registrada");}
  synchronized String read(){try(Cursor c=getReadableDatabase().rawQuery("SELECT current FROM vault WHERE id=1",null)){return c.moveToFirst()?c.getString(0):"";}}
  synchronized void write(String json){SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{String old=read();ContentValues v=new ContentValues();v.put("id",1);v.put("current",json);v.put("previous",old);db.insertWithOnConflict("vault",null,v,SQLiteDatabase.CONFLICT_REPLACE);db.setTransactionSuccessful();}finally{db.endTransaction();}}
 }
