#!/usr/bin/env node
/**
 * i18n guardrails for the admin frontend:
 * 1) en_US / ko_KR leaf-key parity
 * 2) static t("...") / t('...') keys exist in both catalogs
 * 3) optional Hangul literal scan outside locales (warn-only for allowlisted paths)
 *
 * Usage: node scripts/check-i18n.mjs
 * Exit 1 on parity / missing-key failures.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const langRoot = path.join(root, "frontend/src/locales/lang");
const srcRoot = path.join(root, "frontend/src");

function flatten(obj, prefix = "", out = {}) {
	for (const [k, v] of Object.entries(obj || {})) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
		else out[key] = v;
	}
	return out;
}

function loadLocale(locale) {
	const dir = path.join(langRoot, locale);
	const merged = {};
	for (const file of ["common.json", "sys.json"]) {
		Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
	}
	return flatten(merged);
}

function walk(dir, acc = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name === "dist") continue;
			walk(full, acc);
		} else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
			acc.push(full);
		}
	}
	return acc;
}

const en = loadLocale("en_US");
const ko = loadLocale("ko_KR");
const onlyEn = Object.keys(en).filter((k) => !(k in ko));
const onlyKo = Object.keys(ko).filter((k) => !(k in en));

let failed = false;

console.log(`Locale leaf keys: en=${Object.keys(en).length} ko=${Object.keys(ko).length}`);
if (onlyEn.length || onlyKo.length) {
	failed = true;
	if (onlyEn.length) console.error("Keys only in en_US:", onlyEn);
	if (onlyKo.length) console.error("Keys only in ko_KR:", onlyKo);
} else {
	console.log("OK: en/ko key parity");
}

const keyRe = /\bt\(\s*['"`]([^'"`]+?)['"`]/g;
const used = new Set();
for (const file of walk(srcRoot)) {
	let text = fs.readFileSync(file, "utf8");
	// Strip block and line comments so commented t() keys are ignored
	text = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
	let m;
	while ((m = keyRe.exec(text))) {
		const key = m[1];
		if (key.includes("${") || key.includes("{{")) continue;
		used.add(key);
	}
}

const missing = [...used].filter((k) => !(k in en) || !(k in ko)).sort();
// Allow status-code style lookups that are built dynamically via template in some places —
// we only flag fully static keys.
if (missing.length) {
	failed = true;
	console.error("Missing static t() keys:", missing);
} else {
	console.log(`OK: ${used.size} static t() keys present in both catalogs`);
}

// Hangul outside locale catalogs (informational; legal bilingual content is allowlisted)
const hangulRe = /['"`][^'"`]*[가-힣][^'"`]*['"`]/;
const allowHangul = [
	"/locales/lang/ko_KR/",
	"/locales/use-locale.ts", // language self-name "한국어"
	"/pages/legal/", // structured ko/en section bodies live in source
	"/pages/developer/components/integrationSamples.ts", // bilingual sample packs
];
const hangulHits = [];
for (const file of walk(srcRoot)) {
	const rel = file.replace(root + path.sep, "");
	if (allowHangul.some((p) => file.includes(p))) continue;
	const text = fs.readFileSync(file, "utf8");
	const lines = text.split("\n");
	lines.forEach((line, i) => {
		if (hangulRe.test(line) && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
			hangulHits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
		}
	});
}
if (hangulHits.length) {
	console.warn(`WARN: ${hangulHits.length} possible Hangul UI literals outside allowlist (not failing):`);
	for (const hit of hangulHits.slice(0, 40)) console.warn(" ", hit);
	if (hangulHits.length > 40) console.warn(`  ...and ${hangulHits.length - 40} more`);
} else {
	console.log("OK: no Hangul UI string literals outside allowlist");
}

if (failed) {
	console.error("i18n check failed");
	process.exit(1);
}
console.log("i18n check passed");
