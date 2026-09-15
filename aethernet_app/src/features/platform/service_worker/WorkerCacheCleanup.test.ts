// SPDX-License-Identifier: AGPL-3.0-or-later

import {shouldDeleteWorkerCache} from '@app/features/platform/service_worker/WorkerCacheCleanup';
import {describe, expect, it} from 'vitest';

describe('WorkerCacheCleanup', () => {
	const expectedCaches = new Set(['aethernet-precache-current', 'aethernet-navigation-current']);

	it('reclaims every cache the current worker no longer writes to', () => {
		expect(shouldDeleteWorkerCache('aethernet-assets-current', expectedCaches)).toBe(true);
		expect(shouldDeleteWorkerCache('aethernet-assets-previous', expectedCaches)).toBe(true);
		expect(shouldDeleteWorkerCache('aethernet-expression-assets', expectedCaches)).toBe(true);
		expect(shouldDeleteWorkerCache('aethernet-expression-assets-2026.604', expectedCaches)).toBe(true);
		expect(shouldDeleteWorkerCache('aethernet-precache-previous', expectedCaches)).toBe(true);
		expect(shouldDeleteWorkerCache('aethernet-navigation-previous', expectedCaches)).toBe(true);
	});

	it('keeps the current caches and anything the worker does not own', () => {
		expect(shouldDeleteWorkerCache('aethernet-precache-current', expectedCaches)).toBe(false);
		expect(shouldDeleteWorkerCache('aethernet-navigation-current', expectedCaches)).toBe(false);
		expect(shouldDeleteWorkerCache('third-party-cache', expectedCaches)).toBe(false);
		expect(shouldDeleteWorkerCache('aethernet', expectedCaches)).toBe(false);
	});
});
