// SPDX-License-Identifier: AGPL-3.0-or-later

// Ordering + visibility for profile badges.
//
// Built-in badges have a stable default order. Users can reorder/hide them in
// profile settings; the choice persists in localStorage so it works without a
// backend round-trip (self-hosted parity). Admin custom badges reuse the same
// shape: `sort_order` maps to position, `enabled` maps to visibility.

export const PROFILE_BADGE_DISPLAY_STORAGE_KEY = 'aethernet.profile-badge-display.v1';

export const DEFAULT_PROFILE_BADGE_ORDER = [
	'aethernet_member',
	'staff',
	'partner',
	'bug_hunter',
	'premium',
	'premium_sequence',
] as const;

export type ProfileBadgeKey = string;

export interface ProfileBadgeDisplayState {
	order: ProfileBadgeKey[];
	hidden: ProfileBadgeKey[];
}

export interface DisplayableBadge {
	key: string;
}

function defaultState(): ProfileBadgeDisplayState {
	return {order: [...DEFAULT_PROFILE_BADGE_ORDER], hidden: []};
}

function sanitize(keys: unknown): ProfileBadgeKey[] {
	if (!Array.isArray(keys)) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const key of keys) {
		if (typeof key !== 'string') continue;
		const trimmed = key.trim().slice(0, 64);
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		out.push(trimmed);
		if (out.length >= 100) break;
	}
	return out;
}

export function loadProfileBadgeDisplay(storage?: Storage | null): ProfileBadgeDisplayState {
	const fallback = defaultState();
	try {
		const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
		if (!store) return fallback;
		const raw = store.getItem(PROFILE_BADGE_DISPLAY_STORAGE_KEY);
		if (!raw) return fallback;
		const parsed = JSON.parse(raw) as Partial<ProfileBadgeDisplayState>;
		const order = sanitize(parsed.order);
		const hidden = sanitize(parsed.hidden);
		return {
			order: order.length > 0 ? order : fallback.order,
			hidden,
		};
	} catch {
		return fallback;
	}
}

export function saveProfileBadgeDisplay(state: ProfileBadgeDisplayState, storage?: Storage | null): void {
	try {
		const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
		if (!store) return;
		store.setItem(
			PROFILE_BADGE_DISPLAY_STORAGE_KEY,
			JSON.stringify({order: sanitize(state.order), hidden: sanitize(state.hidden)}),
		);
	} catch {
		// Storage full / private mode: profile keeps default display.
	}
}

export function moveProfileBadge(
	order: ProfileBadgeKey[],
	key: ProfileBadgeKey,
	direction: -1 | 1,
): ProfileBadgeKey[] {
	const index = order.indexOf(key);
	if (index < 0) return [...order];
	const next = index + direction;
	if (next < 0 || next >= order.length) return [...order];
	const copy = [...order];
	[copy[index], copy[next]] = [copy[next]!, copy[index]!];
	return copy;
}

export function toggleProfileBadgeHidden(hidden: ProfileBadgeKey[], key: ProfileBadgeKey): ProfileBadgeKey[] {
	return hidden.includes(key) ? hidden.filter((item) => item !== key) : [...hidden, key];
}

// Desktop + mobile render the same badge list; only the CSS differs. Sorting
// and hiding here keeps both surfaces in sync and gives visual-regression
// tests a single pure function to assert against.
export function applyProfileBadgeDisplay<T extends DisplayableBadge>(
	badges: T[],
	display: ProfileBadgeDisplayState,
): T[] {
	const hidden = new Set(display.hidden);
	const visible = badges.filter((badge) => !hidden.has(badge.key));
	const position = new Map(display.order.map((key, index) => [key, index] as const));
	return [...visible].sort((a, b) => {
		const pa = position.get(a.key) ?? Number.MAX_SAFE_INTEGER;
		const pb = position.get(b.key) ?? Number.MAX_SAFE_INTEGER;
		if (pa !== pb) return pa - pb;
		return a.key.localeCompare(b.key);
	});
}
