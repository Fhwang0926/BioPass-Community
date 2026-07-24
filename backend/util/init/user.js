'use strict';

import working_directory from "app-module-path";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

working_directory.addPath(__dirname);

import { sql } from "../../lib/index.js";
import { hashPassword } from "../password.js";
import { hashPhoneSha512 } from "../phone.js";
import { eq, sql as drizzleSql } from 'drizzle-orm';

const normalizePermission = (permission, fallback = 'USER') => {
  const value = String(permission || fallback).trim().toUpperCase();
  return value || fallback;
};

const resolveIsAdminFlag = (permission) => {
  const normalizedPermission = normalizePermission(permission);
  return normalizedPermission === 'ADMIN' || normalizedPermission === 'SUPER_ADMIN';
};

/**
 * 단일 사용자 생성
 */
export const createUser = async (account = null) => {
  try {
    if (!account && (!process.env.INIT_ADMIN_EMAIL || !process.env.INIT_ADMIN_PASSWORD)) {
      throw new Error(
        "createUser requires an account or INIT_ADMIN_EMAIL + INIT_ADMIN_PASSWORD"
      );
    }

    const email = (account?.email || process.env.INIT_ADMIN_EMAIL || "").trim().toLowerCase();
    const password = account?.password || process.env.INIT_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error("email and password are required");
    }

    const accountData = {
      email,
      password,
      permissions: (account && account.permissions) || "ADMIN",
      name: (account && account.name) || process.env.INIT_ADMIN_NAME || "Admin",
      phone: (account && account.phone) || process.env.INIT_ADMIN_PHONE || "",
      isActive: account?.isActive !== undefined ? account.isActive : true,
      isVerify: account?.isVerify !== undefined ? account.isVerify : true,
    };

    const company = {
      name: accountData.email.split("@")[0],
      isActive: true
    };

    const existingUser = await sql.db.select()
      .from(sql.schema.sysUser)
      .where(eq(sql.schema.sysUser.email, accountData.email))
      .limit(1)
      .get();

    if (existingUser) {
      console.log(`User already exists: ${accountData.email}`);
      return existingUser;
    }

    let rs_company = await sql.db.select()
      .from(sql.schema.sysCompany)
      .where(eq(sql.schema.sysCompany.name, company.name))
      .limit(1)
      .get();

    if (!rs_company) {
      rs_company = await sql.db.insert(sql.schema.sysCompany)
        .values(company)
        .returning()
        .get();
      console.log("Created company:", company.name);
    } else {
      console.log("Company already exists:", company.name);
    }

    const hashedPassword = hashPassword(accountData.email, accountData.password);

    const userData = {
      email: accountData.email,
      password: hashedPassword,
      name: accountData.name,
      phone: accountData.phone,
      phoneSha512: hashPhoneSha512(accountData.phone) ?? undefined,
      permissions: normalizePermission(accountData.permissions),
      companyId: rs_company.id,
      isAdmin: resolveIsAdminFlag(accountData.permissions),
      isActive: accountData.isActive,
      isVerify: accountData.isVerify
    };

    const rs_user = await sql.db.insert(sql.schema.sysUser)
      .values(userData)
      .returning()
      .get();

    console.log("Created user:", {
      email: rs_user.email,
      name: rs_user.name,
      permissions: rs_user.permissions,
      isAdmin: rs_user.isAdmin,
      isActive: rs_user.isActive,
      isVerify: rs_user.isVerify
    });
    console.log("Initialization completed successfully");

    return rs_user;
  } catch (e) {
    console.error("Initialization failed:", e);
    throw e;
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      await createUser();
      process.exit(0);
    } catch (e) {
      console.error('오류:', e.message);
      process.exit(1);
    }
  })();
}

export default createUser;
