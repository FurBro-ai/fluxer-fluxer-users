// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, expect, it} from 'vitest';
import {
	applyProfileBadgeDisplay,
	loadProfileBadgeDisplay,
	moveProfileBadge,
	toggleProfileBadgeHidden,
} from './ProfileBadgeDisplay';

const DESKTOP_BADGES = [
	{key: 'aethernet_member'},
	{key: 'staff'},
	{key: 'partner'},
	{key: 'bug_hunter'},
	{key: 'premium'},
	{key: 'premium_sequence'},
];

const MOBILE_BADGES = [...DESKTOP_BADGES].reverse();

describe('applyProfileBadgeDisplay', () => {
	it('keeps desktop and mobile badge sets identical after sorting', () => {
		const memory = (() => {
			const store = new Map<string, string>();
			return {
				getItem: (key: string) => store.get(key) ?? null,
				setItem: (key: string, value: string) => void store.set(key, value),
				removeItem: (key: string) => void store.delete(key),
			} as unknown as Storage;
		})();
		const display = loadProfileBadgeDisplay(memory);
		expect(display.order).toContain('aethernet_member');
		const desktop = applyProfileBadgeDisplay(DESKTOP_BADGES, {
			order: ['premium', 'staff', 'aethernet_member', 'partner', 'bug_hunter', 'premium_sequence'],
			hidden: [],
		});
		const mobile = applyProfileBadgeDisplay(MOBILE_BADGES, {
			order: ['premium', 'staff', 'aethernet_member', 'partner', 'bug_hunter', 'premium_sequence'],
			hidden: [],
		});
		expect(desktop.map((badge) => badge.key)).toEqual(mobile.map((badge) => badge.key));
		expect(desktop[0]?.key).toBe('premium');
	});

	it('hides disabled badges on both surfaces', () => {
		const display = {order: ['aethernet_member', 'staff', 'premium'], hidden: ['staff']};
		const result = applyProfileBadgeDisplay(DESKTOP_BADGES, display);
		expect(result.map((badge) => badge.key)).not.toContain('staff');
		expect(result.map((badge) => badge.key)).toContain('premium');
	});

	it('falls back to key order for unknown custom badges', () => {
		const result = applyProfileBadgeDisplay(
			[{key: 'custom-zebra'}, {key: 'custom-alpha'}, {key: 'aethernet_member'}],
			{order: ['aethernet_member'], hidden: []},
		);
		expect(result.map((badge) => badge.key)).toEqual(['aethernet_member', 'custom-alpha', 'custom-zebra']);
	});
});

describe('badge ordering controls', () => {
	it('moves badges without mutating the input', () => {
		const order = ['a', 'b', 'c'];
		expect(moveProfileBadge(order, 'b', -1)).toEqual(['b', 'a', 'c']);
		expect(moveProfileBadge(order, 'b', 1)).toEqual(['a', 'c', 'b']);
		expect(order).toEqual(['a', 'b', 'c']);
		expect(moveProfileBadge(order, 'a', -1)).toEqual(order);
	});

	it('toggles visibility symmetrically', () => {
		expect(toggleProfileBadgeHidden([], 'staff')).toEqual(['staff']);
		expect(toggleProfileBadgeHidden(['staff'], 'staff')).toEqual([]);
	});
});
