// @ts-ignore — node-forge has no bundled types in this project
import forge from "node-forge";

/**
 * Browser first-pass hash before the password is sent to the API.
 * The server stores passwords with scrypt; this SHA-512 step is not the KDF.
 */
export function hashClientPassword(plain: string): string {
	// codeql[js/insufficient-password-hash]
	// codeql[js/weak-cryptographic-algorithm]
	return forge.md.sha512.create().update(String(plain || "")).digest().toHex();
}
