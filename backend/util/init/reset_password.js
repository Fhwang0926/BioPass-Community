'use strict';

import working_directory from "app-module-path";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

working_directory.addPath(__dirname);

import { sql } from "../../lib/index.js";
import { hashPassword } from "../password.js";
import { eq, sql as drizzleSql } from 'drizzle-orm';

/**
 * 특정 사용자의 비밀번호를 재설정
 */
const resetPassword = async (email, newPassword) => {
  try {
    const user = await sql.db.select()
      .from(sql.schema.sysUser)
      .where(eq(sql.schema.sysUser.email, email))
      .limit(1)
      .get();

    if (!user) {
      console.error(`User not found: ${email}`);
      return false;
    }

    const hashedPassword = hashPassword(email, newPassword);

    await sql.db.update(sql.schema.sysUser)
      .set({
        password: hashedPassword,
        updatedAt: drizzleSql`now()`
      })
      .where(eq(sql.schema.sysUser.id, user.id))
      .returning();

    console.log(`Password updated successfully for ${email}`);
    return true;
  } catch (e) {
    console.error("Password reset failed:", e);
    throw e;
  }
};

const isMainModule = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('reset_password.js') ||
  process.argv[1]?.endsWith('reset_password');

if (isMainModule) {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('Usage: node reset_password.js <email> <password>');
    process.exit(1);
  }

  (async () => {
    try {
      await resetPassword(email, password);
      await sql.close();
      process.exit(0);
    } catch (e) {
      console.error('Error:', e.message);
      process.exit(1);
    }
  })();
}

export default resetPassword;
