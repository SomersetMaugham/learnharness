"use client";
/**
 * The Appearance + Graph sections (thin settings wave).
 *
 * Appearance controls resolve against the factory in the provider; writes
 * PUT the whole appearance section and hand the delta back so the CSS
 * variables move IMMEDIATELY (the section's whole point — it must DO
 * something). Hex inputs commit on blur/Enter; the background derives the
 * raised/accent/edge palette in code (components/settings/appearance.tsx).
 * Mode is dark-only this wave: control rendered DISABLED with a note — the
 * light palette is the design wave's work, and a lying control is worse
 * than an honest disabled one.
 *
 * Graph graying (owner, 2026-09-20) follows the graph viewer's render-panel
 * convention: the whole row dims when a parent is off (stored values
 * persist but resolve inert — the switch shows stored, the dim effective).
 *
 * Reading font (Korean font wave, 2026-10-27, owner ask): a COMPARE
 * panel — left = the font in use now, right = the font being previewed
 * (hover / arrow-walk / click in the list below), an Apply button commits.
 * The list is the BUNDLED friendly Korean families (BUNDLED_READING_FONTS,
 * imported in app/layout.tsx — no CDN, same on every machine); the old
 * installed-font enumeration (queryLocalFonts, empty in Electron 44) is
 * gone. The custom-family search escape remains. Empty/unset keeps
 * meaning Source Sans 3.
 *
 * Emphasis inks (same wave): the factory tokens default to the regular
 * text color now (globals.css); the rows' empty-state labels say "same
 * as text".
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
	EXTRACTION_CHUNK_TOKENS_FLOOR,
	resolveSettings,
	type AppearanceSettings,
	type GraphSettings,
} from "@/src/core";
import { MenuShell } from "@/components/menu-shell";
import { Hint } from "@/components/ui/hint";
import { useAppearance } from "./appearance.tsx";
import { FontMenuList } from "./model-menu";
import { CommitInput, SettingsRow, ThinSelect, Toggle } from "./controls.tsx";

/** The factory reading family — the DEFAULT row's identity (unset =
 *  this). Exported for tests. */
export const DEFAULT_READING_FONT = "Source Sans 3";

/** The bundled families the panel offers (CSS family names as the
 *  imported @fontsource / pretendard stylesheets declare them — the
 *  stored fontFamily is the name verbatim). The factory family is
 *  absent: the DEFAULT row is it. Exported for tests. */
export const BUNDLED_READING_FONTS: readonly string[] = [
	"Pretendard",
	"Nanum Gothic",
	"Gowun Dodum",
	"Gowun Batang",
	"Gaegu",
];

/** The compare panel's sample: Korean + Latin + digits, so the left and
 *  right columns differ visibly in every script the lessons mix. */
export const FONT_SAMPLE_TEXT =
	"오늘도 천천히, 한 걸음씩 배워 봐요.\nThe quick brown fox jumps over the lazy dog. 0123456789";

/** The CSS font-family stack a preview column renders in. null = the
 *  factory reading font. Pure — exported for tests. */
export function previewStack(family: string | null): string {
	return family === null
		? "var(--font-sans3), ui-sans-serif, system-ui, sans-serif"
		: `"${family}", var(--font-sans3), ui-sans-serif, system-ui, sans-serif`;
}

/** Whether the renderer resolves `family` to a real installed face
 *  (font-name warning, 2026-10-27): CSS silently falls back on an
 *  unknown family, so a file name typed for a family name
 *  ("IBMPlexSansKR" for "IBM Plex Sans KR") looked like a dead Apply.
 *  The probe draws a sample in `family` over two different generic
 *  fallbacks; a real face changes the width against at least one.
 *  document.fonts.check is no use here — it answers true for unknown
 *  local families. Bundled families are known (and lazily loaded, so a
 *  probe could miss them). null = no DOM (SSR / tests). */
export function fontAvailable(family: string): boolean | null {
	if (BUNDLED_READING_FONTS.includes(family)) return true;
	if (typeof document === "undefined") return null;
	const ctx = document.createElement("canvas").getContext("2d");
	if (!ctx) return null;
	const sample = "mmmmmmmmmmlli 가나다라마 0123";
	const quoted = `"${family.replace(/["\\]/g, "\\$&")}"`;
	return ["monospace", "serif"].some((fallback) => {
		ctx.font = `40px ${fallback}`;
		const base = ctx.measureText(sample).width;
		ctx.font = `40px ${quoted}, ${fallback}`;
		return ctx.measureText(sample).width !== base;
	});
}

const noSubscribe = () => () => {};

/** fontAvailable as a hook: null on the server snapshot, so a stored
 *  missing family never causes a hydration mismatch. null family (the
 *  factory default) is always fine. */
function useFontAvailable(family: string | null): boolean | null {
	return useSyncExternalStore(
		noSubscribe,
		() => (family === null ? true : fontAvailable(family)),
		() => null,
	);
}

/** The warning both surfaces show for a family the renderer can't find. */
export const FONT_MISSING_MESSAGE =
	"Not found on this computer — showing Source Sans 3. Use the exact family name (Windows Settings › Fonts), and restart the app after installing a font.";

/** Compose the reading-font pick: null (or blank) = the factory
 *  Source Sans 3; otherwise the family verbatim (trimmed — the
 *  sanitizer trims again server-side). Pure — exported for tests. */
export function composeFontFamily(
	appearance: AppearanceSettings | undefined,
	family: string | null,
): AppearanceSettings {
	const value = family?.trim() ?? "";
	return { ...appearance, fontFamily: value === "" ? null : value };
}

/** One column of the compare panel: a label, the family's name, and the
 *  sample set in that family. name === null = nothing previewed yet. */
function FontSpecimen({
	title,
	name,
	family,
	testid,
}: {
	title: string;
	name: string | null;
	family: string | null;
	testid: string;
}) {
	const available = useFontAvailable(name === null ? null : family);
	return (
		<div data-testid={testid} className="flex min-h-32 flex-col gap-1.5 rounded-lg border border-border bg-background p-2.5">
			<div className="flex items-center justify-between gap-2 text-muted-foreground">
				<span>{title}</span>
				<span className="truncate">{name ?? "—"}</span>
			</div>
			{name === null ? (
				<p className="text-muted-foreground">Hover or pick a font to preview it here.</p>
			) : (
				<p className="whitespace-pre-line text-sm leading-relaxed text-foreground" style={{ fontFamily: previewStack(family) }}>
					{FONT_SAMPLE_TEXT}
				</p>
			)}
			{available === false && (
				<p data-testid={`${testid}-missing`} role="alert" className="text-amber-400">
					⚠ {FONT_MISSING_MESSAGE}
				</p>
			)}
		</div>
	);
}

export function AppearanceSection({
	appearance,
	onSectionChange,
}: {
	/** The record's appearance delta (absent = factory). */
	appearance: AppearanceSettings | undefined;
	/** PUT the whole appearance section; the page re-applies on success. */
	onSectionChange: (next: AppearanceSettings) => void;
}) {
	const { appearance: resolved } = useAppearance();
	const md = appearance?.mdRendering;

	// The compare panel: open state, the CLICKED pick (undefined = none
	// yet; null = the default row), and the transient hover/walk preview.
	// The right column shows hover ?? picked; Apply commits the pick.
	const [fontMenuOpen, setFontMenuOpen] = useState(false);
	const [picked, setPicked] = useState<string | null | undefined>(undefined);
	const [hovered, setHovered] = useState<string | null | undefined>(undefined);
	const menuAnchorRef = useRef<HTMLSpanElement>(null);

	const openFontMenu = () => {
		setPicked(undefined);
		setHovered(undefined);
		setFontMenuOpen((open) => !open);
	};

	const currentFont = appearance?.fontFamily || null;
	const currentAvailable = useFontAvailable(currentFont);
	const previewing = hovered !== undefined ? hovered : picked;
	const canApply = picked !== undefined && picked !== currentFont;

	const applyFont = () => {
		if (picked === undefined) return;
		setFontMenuOpen(false);
		onSectionChange(composeFontFamily(appearance, picked));
	};

	// The dropdown contract (agent-section's, mirrored): any click
	// outside the open menu — or an Esc — closes it. Esc is CLAIMED with
	// stopPropagation so the settings dialog behind does NOT also close.
	useEffect(() => {
		if (!fontMenuOpen) return;
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as Node;
			if (menuAnchorRef.current?.contains(target)) return;
			if (target instanceof Element && target.closest("[data-lh-menu]")) return;
			if (target instanceof Element && target.closest('[role="dialog"]')) {
				setFontMenuOpen(false);
			}
			// else: outside the dialog — the dialog's own close handles it.
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				setFontMenuOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [fontMenuOpen]);

	return (
		<>
			<SettingsRow label="Mode" hint="Coming soon" testid="row-mode" dimmed>
				<ThinSelect value="dark" ariaLabel="mode" onChange={() => {}} testid="select-mode" disabled>
					<option value="dark">Dark</option>
				</ThinSelect>
			</SettingsRow>
			<SettingsRow
				label="Background"
				hint={`Empty = ${resolved.background ?? "#141414"}`}
				testid="row-background"
			>
				<CommitInput
					value={appearance?.background ?? ""}
					placeholder="#141414"
					ariaLabel="background hex"
					testid="input-background"
					onCommit={(v) => onSectionChange({ ...appearance, background: v === "" ? null : v })}
				/>
			</SettingsRow>
			<SettingsRow
				label="Reading font"
				hint={
					currentAvailable === false ? (
						<span data-testid="font-row-missing" className="text-amber-400">
							⚠ Not found — showing {DEFAULT_READING_FONT}
						</span>
					) : (
						`Empty = ${DEFAULT_READING_FONT}`
					)
				}
				testid="row-font"
			>
				<span ref={fontMenuOpen ? menuAnchorRef : undefined} className="relative flex items-center gap-2">
					{/* The MenuTrigger look (agent-section's collapsed
					    select — it lives unexported there, so the
					    classes ride inline; the searchable machine is
					    the shared part). The tooltip rides the CLOSED
					    button ONLY (owner ruling 2026-09-26: never while
					    the dropdown is out — it popped over the open
					    menu when the wrap covered the whole anchor
					    span). */}
					{(() => {
						const triggerButton = (
							<button
								type="button"
								aria-label="Reading font"
								aria-expanded={fontMenuOpen}
								data-testid="font-trigger"
								onClick={openFontMenu}
								className="flex h-7 min-w-20 items-center gap-1 rounded-sm border border-border bg-background px-1.5 font-ui text-xs text-foreground transition-colors hover:border-muted-foreground/50"
							>
								<span className="min-w-0 flex-1 truncate">{appearance?.fontFamily || DEFAULT_READING_FONT}</span>
								<span aria-hidden className="text-muted-foreground">
									▾
								</span>
							</button>
						);
						return fontMenuOpen ? (
							triggerButton
						) : (
							<Hint label="Compare and choose a reading font" side="left">
								{triggerButton}
							</Hint>
						);
					})()}
					{fontMenuOpen && (
						<MenuShell
							preferredSide="down"
							anchorTestid="font-trigger"
							testid="font-menu"
							menuClass="flex w-[30rem] max-w-[92vw] flex-col gap-2 rounded-xl border border-border bg-card p-3 text-xs shadow-xl"
						>
							<div className="grid grid-cols-2 gap-2" data-testid="font-compare">
								<FontSpecimen
									testid="font-specimen-current"
									title="Current"
									name={currentFont ?? DEFAULT_READING_FONT}
									family={currentFont}
								/>
								<FontSpecimen
									testid="font-specimen-preview"
									title="Preview"
									name={previewing === undefined ? null : (previewing ?? DEFAULT_READING_FONT)}
									family={previewing === undefined ? currentFont : previewing}
								/>
							</div>
							<div className="flex flex-col gap-0.5">
								<FontMenuList
									families={[...BUNDLED_READING_FONTS]}
									effectiveFamily={picked !== undefined ? picked : currentFont}
									onPick={(family) => setPicked(family)}
									onPreview={setHovered}
									footer="Bundled with the app — hover to preview, click to select"
								/>
							</div>
							<div className="flex justify-end">
								<button
									type="button"
									data-testid="font-apply"
									disabled={!canApply}
									onClick={applyFont}
									className="h-7 rounded-sm border border-border bg-background px-3 font-ui text-xs text-foreground transition-colors hover:border-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-40"
								>
									Apply
								</button>
							</div>
						</MenuShell>
					)}
				</span>
			</SettingsRow>
			<SettingsRow label="Reading font size" hint={`${resolved.proseFontSize}px`} testid="row-prose-size">
				<CommitInput
					type="number"
					value={String(appearance?.proseFontSize ?? "")}
					placeholder="16"
					ariaLabel="prose font size"
					testid="input-prose-size"
					onCommit={(v) => {
						// Empty = factory default (owner, fix wave): omit the key so the record
						// UNSETS and the field stays empty (absence, not null, is the
						// unset for numbers). Number("") is 0, so the old clamp wrote 12.
						if (v === "") {
							onSectionChange({ ...appearance, proseFontSize: undefined });
							return;
						}
						const n = Number(v);
						if (!Number.isFinite(n)) return; // bad input: no write, factory stays
						onSectionChange({ ...appearance, proseFontSize: Math.min(24, Math.max(12, Math.round(n))) });
					}}
				/>
			</SettingsRow>
			<SettingsRow label="Session names in serif" testid="row-session-serif">
				<Toggle
					checked={appearance?.sessionNameSerif ?? true}
					label="session names serif"
					onChange={(on) => onSectionChange({ ...appearance, sessionNameSerif: on })}
				/>
			</SettingsRow>
			<SettingsRow label="Heading weight" hint={`${resolved.mdRendering.headingWeight}`} testid="row-heading-weight">
				<CommitInput
					type="number"
					value={String(md?.headingWeight ?? "")}
					placeholder="900"
					ariaLabel="heading weight"
					testid="input-heading-weight"
					onCommit={(v) => {
						// Empty = factory default (owner, fix wave): Number("") is 0, so
						// Absence is the unset representation — the old clamp wrote 100.
						if (v === "") {
							onSectionChange({ ...appearance, mdRendering: { ...md, headingWeight: undefined } });
							return;
						}
						const n = Number(v);
						if (!Number.isFinite(n)) return;
						onSectionChange({
							...appearance,
							mdRendering: { ...md, headingWeight: Math.min(900, Math.max(100, Math.round(n))) },
						});
					}}
				/>
			</SettingsRow>
			{/* The emphasis inks default to the REGULAR TEXT COLOR now
			    (appearance wave, 2026-09-26) — the empty-state labels say
			    so; explicit hex overrides ride unchanged. */}
			<SettingsRow label="Bold color" hint="Empty = same as text" testid="row-bold-color">
				<CommitInput
					value={md?.boldColor ?? ""}
					placeholder="same as text"
					ariaLabel="bold color"
					testid="input-bold-color"
					onCommit={(v) => onSectionChange({ ...appearance, mdRendering: { ...md, boldColor: v === "" ? null : v } })}
				/>
			</SettingsRow>
			<SettingsRow label="Italic color" hint="Empty = same as text" testid="row-italic-color">
				<CommitInput
					value={md?.italicColor ?? ""}
					placeholder="same as text"
					ariaLabel="italic color"
					testid="input-italic-color"
					onCommit={(v) => onSectionChange({ ...appearance, mdRendering: { ...md, italicColor: v === "" ? null : v } })}
				/>
			</SettingsRow>
		</>
	);
}

export function GraphSection({
	graph,
	onSectionChange,
}: {
	graph: GraphSettings | undefined;
	onSectionChange: (next: GraphSettings) => void;
}) {
	// Wave 7 collapse (owner ruling 2026-09-23): the section is the MASTER
	// SWITCH — the embedding/clustering/labeling rungs are gone; clustering
	// is the free birth-session partition derived on read, labels ARE session
	// names. The chunk budget (2026-10-02) joined it as the section's second
	// and only other control: it denominates the coverage ring AND gates the
	// auto-extraction trigger (turn settle ≥ budget fires the run).
	//
	// Resolved through the SAME core resolver the server's effective
	// settings use (one source of truth, the 4096-fallback fix 2026-10-02):
	// the hint and placeholder report exactly the number the trigger waits
	// for — never a second hand-rolled default.
	const resolved = resolveSettings(graph === undefined ? null : { version: 1, graph }).graph;
	return (
		<>
			{/* EXTRACTION (renamed, owner 2026-10-06): this switch is the DATA
			    channel — the pipeline, the auditor, the prober's graph tools. It
			    was born labeled "Graph" and that label lied once the rendering
			    switch below arrived: off ≠ no graph, off = the graph stops
			    growing. The testid keeps the old name's shape (row-enabled) so
			    this stays one rename, not a test re-pin. */}
			<SettingsRow label="Extraction" hint="Off = the graph stops growing" testid="graph-row-enabled">
				<Toggle
					checked={graph?.enabled ?? true}
					label="extraction enabled"
					onChange={(on) =>
						// Compose, never replace-whole (the section PUT is, but the
					// row must not drop its sibling field — fixed with the budget
					// row's arrival: the old { enabled: on } wiped a stored budget).
						onSectionChange({ ...graph, enabled: on })
					}
				/>
			</SettingsRow>
			{/* GRAPH RENDERING (owner, 2026-10-06 — the release graph-controls
			    round): display-only. Off = the home shows the chains view
			    instead of the canvas. The ledgers, the pipeline, everything
			    data keeps working — that is the extraction switch above. */}
			<SettingsRow label="Graph rendering" hint="Off = home shows the chains view" testid="graph-row-rendering">
				<Toggle
					checked={graph?.rendering ?? true}
					label="graph rendering enabled"
					onChange={(on) => onSectionChange({ ...graph, rendering: on })}
				/>
			</SettingsRow>
			<SettingsRow
				label="Extraction chunk budget"
				hint={`${resolved.extractionChunkTokens} tok`}
				testid="graph-row-chunk-tokens"
			>
				<CommitInput
					type="number"
					value={String(graph?.extractionChunkTokens ?? "")}
					placeholder={String(resolved.extractionChunkTokens)}
					ariaLabel="extraction chunk budget"
					testid="input-chunk-tokens"
					onCommit={(v) => {
						// Empty = factory default (the fix-wave discipline): absence is
						// the unset for numbers — Number("") is 0, so clamping would
						// write the floor instead of unsetting.
						if (v === "") {
							onSectionChange({ ...graph, extractionChunkTokens: undefined });
							return;
						}
						const n = Number(v);
						if (!Number.isFinite(n) || n <= 0) return; // bad input: no write
						// Mirror the server sanitize exactly: floor only (cost
						// protection), no ceiling — a big budget is the user's call.
						onSectionChange({
							...graph,
							extractionChunkTokens: Math.max(EXTRACTION_CHUNK_TOKENS_FLOOR, Math.round(n)),
						});
					}}
				/>
			</SettingsRow>
		</>
	);
}