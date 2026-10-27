"use strict";

/** The only schemes a renderer link may hand to the OS (review fix,
 * 2026-10-27). Markdown links are agent-written and Streamdown passes any
 * scheme, so file:, smb:, ms-*: and friends — which can launch programs on
 * Windows — stay closed. Trusted main-process opens (ChatGPT/subscription
 * sign-in) call shell.openExternal directly and are not filtered here. */
const EXTERNAL_SCHEMES = new Set(["http:", "https:", "mailto:"]);

function isSafeExternalURL(target) {
	try {
		return EXTERNAL_SCHEMES.has(new URL(target).protocol);
	} catch {
		return false;
	}
}

/** Open an allowed link in the OS default handler; refuse and log the rest. */
function openExternalLink(target, { openExternal, log }) {
	if (!isSafeExternalURL(target)) {
		log(`blocked external link (scheme not allowed): ${String(target).slice(0, 200)}`);
		return;
	}
	void openExternal(target);
}

module.exports = { isSafeExternalURL, openExternalLink, EXTERNAL_SCHEMES };
