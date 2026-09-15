// SPDX-License-Identifier: AGPL-3.0-or-later

type AethernetDebugObject = NonNullable<Window['__AETHERNET_DEBUG__']>;

export function getAethernetDebugObject(): AethernetDebugObject | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const existing = window.__AETHERNET_DEBUG__;
	if (existing === undefined || existing === null) {
		const created: AethernetDebugObject = {};
		window.__AETHERNET_DEBUG__ = created;
		return created;
	}
	if (typeof existing !== 'object' || Array.isArray(existing)) {
		return null;
	}
	return existing;
}
