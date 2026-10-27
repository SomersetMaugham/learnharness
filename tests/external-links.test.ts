/** The renderer-link scheme allowlist (review fix, 2026-10-27): agent-written
 *  links reach shell.openExternal only as http/https/mailto. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const { isSafeExternalURL, openExternalLink } = require("../electron/external-links.cjs");

describe("isSafeExternalURL", () => {
	it("web pages and mail open", () => {
		for (const url of ["https://example.com/a?b=c", "http://localhost:8080", "mailto:someone@example.com", "HTTPS://EXAMPLE.COM"]) {
			assert.equal(isSafeExternalURL(url), true, url);
		}
	});
	it("program-launching and local schemes stay closed", () => {
		for (const url of ["file:///C:/Windows/System32/calc.exe", "smb://host/share", "ms-settings:privacy", "search-ms:query=x", "javascript:alert(1)", "vscode://file/x", "not a url", ""]) {
			assert.equal(isSafeExternalURL(url), false, url);
		}
	});
});

describe("openExternalLink", () => {
	it("opens allowed links and logs (never opens) the rest", () => {
		const opened: string[] = [];
		const logged: string[] = [];
		const deps = { openExternal: async (t: string) => void opened.push(t), log: (l: string) => void logged.push(l) };
		openExternalLink("https://example.com", deps);
		openExternalLink("file:///etc/passwd", deps);
		assert.deepEqual(opened, ["https://example.com"]);
		assert.equal(logged.length, 1);
		assert.match(logged[0]!, /blocked external link/);
	});
	it("main.cjs routes both renderer exits through it — no raw openExternal(target) left", () => {
		const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
		assert.equal((main.match(/openExternalLink\(target,/g) ?? []).length, 2);
		assert.ok(!/void shell\.openExternal\(target\)/.test(main));
	});
});
