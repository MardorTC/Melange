package app.projectosp;

import static org.junit.Assert.*;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import org.junit.Test;

public class BackupPolicyTest {
  @Test
  public void invalidUtf8IsRejectedWithoutReplacementCharacters() throws Exception {
    assertEquals("ñ", BackupController.decodeBackup(new byte[] {(byte) 0xc3, (byte) 0xb1}));
    assertEquals(
        "{}",
        BackupController.decodeBackup(
            new byte[] {(byte) 0xef, (byte) 0xbb, (byte) 0xbf, '{', '}'}));
    try {
      BackupController.decodeBackup(new byte[] {(byte) 0xff});
      fail("Invalid UTF-8 must not be silently repaired");
    } catch (java.nio.charset.CharacterCodingException expected) {
      // No lossy financial import.
    }
  }

  @Test
  public void backupLimitUsesUtf8Bytes() {
    assertEquals(20 * 1024 * 1024, BackupController.MAX_BACKUP_BYTES);
    assertEquals(2, BackupController.backupBytes("ñ"));
    assertEquals(0, BackupController.backupBytes(null));
  }

  @Test
  public void importReadsExactlyTheLimitAndRejectsOneMoreByte() throws Exception {
    byte[] exact = new byte[4];
    assertArrayEquals(exact, BackupController.readLimited(new ByteArrayInputStream(exact), 4));
    try {
      BackupController.readLimited(new ByteArrayInputStream(new byte[5]), 4);
      fail("Expected the stream to be rejected");
    } catch (IOException expected) {
      assertTrue(expected.getMessage().contains("tamaño"));
    }
  }
}
