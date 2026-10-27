/**
 * THE RECORD WRITE (review fix, 2026-10-27): every whole-file record write
 * in src/store goes through here — temp file beside the target, then rename
 * over it, the crash-safety graph.ts rewriteLedgers/positions already had.
 * A crash or power loss mid-write leaves the old file plus an orphan
 * `.tmp-*`, never a torn record (a torn chat used to read as "absent" and
 * vanish from the sidebar). Temp names end in `.tmp-<id>`, so directory
 * listings that filter on `.json` / `.md` never see them.
 */

import * as fs from "node:fs";

/** Windows: antivirus/indexers briefly hold files open, and rename over a
 *  held file fails with EPERM/EBUSY/EACCES. A few short retries ride it out. */
const RENAME_RETRY_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
const RENAME_ATTEMPTS = 5;
const RENAME_BACKOFF_MS = 20;

function sleepSync(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function renameWithRetry(from: string, to: string): void {
	for (let attempt = 1; ; attempt++) {
		try {
			fs.renameSync(from, to);
			return;
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code ?? "";
			if (process.platform !== "win32" || !RENAME_RETRY_CODES.has(code) || attempt >= RENAME_ATTEMPTS) throw err;
			sleepSync(RENAME_BACKOFF_MS * attempt);
		}
	}
}

/** Replace `file` with `data` atomically. The caller owns mkdir. */
export function writeFileAtomic(file: string, data: string): void {
	const tmp = `${file}.tmp-${crypto.randomUUID().slice(0, 8)}`;
	try {
		fs.writeFileSync(tmp, data, "utf-8");
		renameWithRetry(tmp, file);
	} catch (err) {
		try {
			fs.unlinkSync(tmp);
		} catch {
			/* the temp file never landed */
		}
		throw err;
	}
}
