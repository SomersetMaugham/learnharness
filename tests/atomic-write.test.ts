/**
 * Record writes are tmp + rename (review fix, 2026-10-27): a crash never
 * tears a record, and a corrupt chat is logged, not silently dropped.
 * LH_DATA_DIR is set before any config-loading import (dynamic imports).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it, mock } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-atomic-"));
process.env.LH_DATA_DIR = TMP_DATA;

const { writeFileAtomic } = await import("../src/store/atomic-write.ts");
const { chatStore } = await import("../src/store/chats.ts");
const { PATHS } = await import("../config.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

describe("writeFileAtomic", () => {
	it("creates, then replaces, leaving no temp files behind", () => {
		const dir = fs.mkdtempSync(path.join(TMP_DATA, "w-"));
		const file = path.join(dir, "record.json");
		writeFileAtomic(file, "first");
		writeFileAtomic(file, "second");
		assert.equal(fs.readFileSync(file, "utf-8"), "second");
		assert.deepEqual(fs.readdirSync(dir), ["record.json"]);
	});

	it("a failed swap keeps the target intact and cleans up its temp file", () => {
		const dir = fs.mkdtempSync(path.join(TMP_DATA, "f-"));
		const target = path.join(dir, "occupied");
		fs.mkdirSync(target);
		fs.writeFileSync(path.join(target, "keep.txt"), "x");
		assert.throws(() => writeFileAtomic(target, "data"));
		assert.deepEqual(fs.readdirSync(dir), ["occupied"]);
		assert.equal(fs.readFileSync(path.join(target, "keep.txt"), "utf-8"), "x");
	});
});

describe("chat store — atomic writes and corrupt records", () => {
	it("chat writes leave only .json files in the chats dir", () => {
		const chat = chatStore.createChat("atomic");
		chatStore.renameChat(chat.id, "renamed");
		assert.equal(chatStore.getChat(chat.id)?.title, "renamed");
		assert.ok(fs.readdirSync(PATHS.chats).every((f) => f.endsWith(".json")));
	});

	it("a corrupt record reads as absent, is logged, and is left untouched", () => {
		const file = path.join(PATHS.chats, "chat_corrupt.json");
		fs.writeFileSync(file, '{"id": "chat_corrupt", "messa');
		const errors = mock.method(console, "error", () => {});
		try {
			assert.equal(chatStore.getChat("chat_corrupt"), null);
			assert.ok(!chatStore.listChats().some((c) => c.id === "chat_corrupt"));
			assert.ok(errors.mock.calls.some((c) => String(c.arguments[0]).includes("corrupt record left in place")));
		} finally {
			errors.mock.restore();
		}
		assert.equal(fs.readFileSync(file, "utf-8"), '{"id": "chat_corrupt", "messa');
		fs.rmSync(file);
	});

	it("a missing or invalid id is quietly absent (no log)", () => {
		const errors = mock.method(console, "error", () => {});
		try {
			assert.equal(chatStore.getChat("chat_nope"), null);
			assert.equal(chatStore.getChat("../escape"), null);
			assert.equal(errors.mock.callCount(), 0);
		} finally {
			errors.mock.restore();
		}
	});
});
