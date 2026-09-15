// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {
	buildUrl,
	canonicalizeDomain,
	type DerivedEndpoints,
	type DomainConfig,
	deriveDomain,
	deriveEndpointsFromDomain,
	normalizePublicEndpoint,
	parsePublicOrigin,
} from '@aethernet/config/src/EndpointDerivation';
import {describe, expect, test} from 'vitest';

describe('buildUrl', () => {
	test.each([
		['http', 'example.com', 80, '/path', 'http://example.com/path'],
		['https', 'example.com', 443, '/path', 'https://example.com/path'],
		['ws', 'example.com', 80, '/gateway', 'ws://example.com/gateway'],
		['wss', 'example.com', 443, '/gateway', 'wss://example.com/gateway'],
		['http', 'localhost', 8088, '/api', 'http://localhost:8088/api'],
		['https', 'example.com', 8443, '/api', 'https://example.com:8443/api'],
		['https', 'example.com', undefined, '/api', 'https://example.com/api'],
		['https', 'example.com', 443, undefined, 'https://example.com'],
		['https', 'example.com', 443, '', 'https://example.com'],
		['https', 'example.com', 443, '/', 'https://example.com/'],
	] as const)('%s %s:%s%s becomes %s', (scheme, domain, port, path, expected) => {
		expect(buildUrl(scheme, domain, port, path)).toBe(expected);
	});
});

describe('deriveDomain', () => {
	const baseConfig: DomainConfig = {
		base_domain: 'aethernet.dev',
		public_scheme: 'https',
		internal_scheme: 'http',
	};
	test.each([
		'api',
		'api_client',
		'app',
		'gateway',
		'media',
		'static_cdn',
		'admin',
		'docs',
		'marketing',
		'invite',
		'gift',
	] as const)('uses the base domain for %s without an override', (endpoint) => {
		expect(deriveDomain(endpoint, baseConfig)).toBe('aethernet.dev');
	});
	test.each([
		['static_cdn', {static_cdn_domain: 'cdn.aethernet.dev'}, 'cdn.aethernet.dev'],
		['invite', {invite_domain: 'aethernet.gg'}, 'aethernet.gg'],
		['gift', {gift_domain: 'aethernet.gift'}, 'aethernet.gift'],
	] as const)('uses the custom %s domain', (endpoint, overrides, expected) => {
		expect(deriveDomain(endpoint, {...baseConfig, ...overrides})).toBe(expected);
	});
});

interface EndpointScenario {
	name: string;
	config: DomainConfig;
	expected: DerivedEndpoints;
}

const endpointScenarios: Array<EndpointScenario> = [
	{
		name: 'development',
		config: {
			base_domain: 'localhost',
			public_scheme: 'http',
			internal_scheme: 'http',
			public_port: 8088,
			internal_port: 8088,
		},
		expected: {
			api: 'http://localhost:8088/api',
			api_client: 'http://localhost:8088/api',
			app: 'http://localhost:8088',
			gateway: 'ws://localhost:8088/gateway',
			media: 'http://localhost:8088/media',
			static_cdn: 'http://localhost:8088',
			admin: 'http://localhost:8088/admin',
			docs: 'https://aethernet.dev',
			marketing: 'http://localhost:8088/marketing',
			invite: 'http://localhost:8088/invite',
			gift: 'http://localhost:8088/gift',
		},
	},
	{
		name: 'production',
		config: {
			base_domain: 'aethernet.app',
			public_scheme: 'https',
			internal_scheme: 'http',
			public_port: 443,
			internal_port: 8080,
		},
		expected: {
			api: 'https://aethernet.app/api',
			api_client: 'https://aethernet.app/api',
			app: 'https://aethernet.app',
			gateway: 'wss://aethernet.app/gateway',
			media: 'https://aethernet.app/media',
			static_cdn: 'https://aethernet.app',
			admin: 'https://aethernet.app/admin',
			docs: 'https://aethernet.dev',
			marketing: 'https://aethernet.app/marketing',
			invite: 'https://aethernet.app/invite',
			gift: 'https://aethernet.app/gift',
		},
	},
	{
		name: 'staging',
		config: {
			base_domain: 'staging.aethernet.dev',
			public_scheme: 'https',
			internal_scheme: 'http',
			public_port: 8443,
			internal_port: 8080,
		},
		expected: {
			api: 'https://staging.aethernet.dev:8443/api',
			api_client: 'https://staging.aethernet.dev:8443/api',
			app: 'https://staging.aethernet.dev:8443',
			gateway: 'wss://staging.aethernet.dev:8443/gateway',
			media: 'https://staging.aethernet.dev:8443/media',
			static_cdn: 'https://staging.aethernet.dev:8443',
			admin: 'https://staging.aethernet.dev:8443/admin',
			docs: 'https://aethernet.dev',
			marketing: 'https://staging.aethernet.dev:8443/marketing',
			invite: 'https://staging.aethernet.dev:8443/invite',
			gift: 'https://staging.aethernet.dev:8443/gift',
		},
	},
	{
		name: 'custom CDN',
		config: {
			base_domain: 'aethernet.app',
			public_scheme: 'https',
			internal_scheme: 'http',
			public_port: 443,
			static_cdn_domain: 'cdn.aethernet.app',
		},
		expected: {
			api: 'https://aethernet.app/api',
			api_client: 'https://aethernet.app/api',
			app: 'https://aethernet.app',
			gateway: 'wss://aethernet.app/gateway',
			media: 'https://aethernet.app/media',
			static_cdn: 'https://cdn.aethernet.app',
			admin: 'https://aethernet.app/admin',
			docs: 'https://aethernet.dev',
			marketing: 'https://aethernet.app/marketing',
			invite: 'https://aethernet.app/invite',
			gift: 'https://aethernet.app/gift',
		},
	},
	{
		name: 'custom invite and gift domains',
		config: {
			base_domain: 'aethernet.app',
			public_scheme: 'https',
			internal_scheme: 'http',
			public_port: 443,
			invite_domain: 'aethernet.gg',
			gift_domain: 'aethernet.gift',
		},
		expected: {
			api: 'https://aethernet.app/api',
			api_client: 'https://aethernet.app/api',
			app: 'https://aethernet.app',
			gateway: 'wss://aethernet.app/gateway',
			media: 'https://aethernet.app/media',
			static_cdn: 'https://aethernet.app',
			admin: 'https://aethernet.app/admin',
			docs: 'https://aethernet.dev',
			marketing: 'https://aethernet.app/marketing',
			invite: 'https://aethernet.gg/invite',
			gift: 'https://aethernet.gift/gift',
		},
	},
	{
		name: 'canary',
		config: {
			base_domain: 'canary.aethernet.app',
			public_scheme: 'https',
			internal_scheme: 'http',
			public_port: 443,
			static_cdn_domain: 'cdn-canary.aethernet.app',
		},
		expected: {
			api: 'https://canary.aethernet.app/api',
			api_client: 'https://canary.aethernet.app/api',
			app: 'https://canary.aethernet.app',
			gateway: 'wss://canary.aethernet.app/gateway',
			media: 'https://canary.aethernet.app/media',
			static_cdn: 'https://cdn-canary.aethernet.app',
			admin: 'https://canary.aethernet.app/admin',
			docs: 'https://aethernet.dev',
			marketing: 'https://canary.aethernet.app/marketing',
			invite: 'https://canary.aethernet.app/invite',
			gift: 'https://canary.aethernet.app/gift',
		},
	},
	{
		name: 'standard HTTP port',
		config: {
			base_domain: 'example.com',
			public_scheme: 'http',
			internal_scheme: 'http',
			public_port: 80,
		},
		expected: {
			api: 'http://example.com/api',
			api_client: 'http://example.com/api',
			app: 'http://example.com',
			gateway: 'ws://example.com/gateway',
			media: 'http://example.com/media',
			static_cdn: 'http://example.com',
			admin: 'http://example.com/admin',
			docs: 'https://aethernet.dev',
			marketing: 'http://example.com/marketing',
			invite: 'http://example.com/invite',
			gift: 'http://example.com/gift',
		},
	},
	{
		name: 'unspecified port',
		config: {
			base_domain: 'example.com',
			public_scheme: 'https',
			internal_scheme: 'http',
		},
		expected: {
			api: 'https://example.com/api',
			api_client: 'https://example.com/api',
			app: 'https://example.com',
			gateway: 'wss://example.com/gateway',
			media: 'https://example.com/media',
			static_cdn: 'https://example.com',
			admin: 'https://example.com/admin',
			docs: 'https://aethernet.dev',
			marketing: 'https://example.com/marketing',
			invite: 'https://example.com/invite',
			gift: 'https://example.com/gift',
		},
	},
	{
		name: 'IPv4',
		config: {
			base_domain: '127.0.0.1',
			public_scheme: 'http',
			internal_scheme: 'http',
			public_port: 8088,
		},
		expected: {
			api: 'http://127.0.0.1:8088/api',
			api_client: 'http://127.0.0.1:8088/api',
			app: 'http://127.0.0.1:8088',
			gateway: 'ws://127.0.0.1:8088/gateway',
			media: 'http://127.0.0.1:8088/media',
			static_cdn: 'http://127.0.0.1:8088',
			admin: 'http://127.0.0.1:8088/admin',
			docs: 'https://aethernet.dev',
			marketing: 'http://127.0.0.1:8088/marketing',
			invite: 'http://127.0.0.1:8088/invite',
			gift: 'http://127.0.0.1:8088/gift',
		},
	},
	{
		name: 'external CDN uses HTTPS without the public port',
		config: {
			base_domain: 'localhost',
			public_scheme: 'http',
			internal_scheme: 'http',
			public_port: 8088,
			static_cdn_domain: 'cdn.example.com',
		},
		expected: {
			api: 'http://localhost:8088/api',
			api_client: 'http://localhost:8088/api',
			app: 'http://localhost:8088',
			gateway: 'ws://localhost:8088/gateway',
			media: 'http://localhost:8088/media',
			static_cdn: 'https://cdn.example.com',
			admin: 'http://localhost:8088/admin',
			docs: 'https://aethernet.dev',
			marketing: 'http://localhost:8088/marketing',
			invite: 'http://localhost:8088/invite',
			gift: 'http://localhost:8088/gift',
		},
	},
];

describe('deriveEndpointsFromDomain', () => {
	test.each(endpointScenarios)('$name', ({config, expected}) => {
		expect(deriveEndpointsFromDomain(config)).toEqual(expected);
	});
});

describe('normalizePublicEndpoint', () => {
	test('leaves a default https install untouched', () => {
		expect(normalizePublicEndpoint('https://aethernet.dev', 'aethernet.dev', 443)).toBe('https://aethernet.dev');
		expect(normalizePublicEndpoint('https://aethernet.dev/media', 'aethernet.dev', 443)).toBe(
			'https://aethernet.dev/media',
		);
		expect(normalizePublicEndpoint('wss://aethernet.dev/gateway', 'aethernet.dev', 443)).toBe(
			'wss://aethernet.dev/gateway',
		);
	});
	test('leaves a default http install untouched', () => {
		expect(normalizePublicEndpoint('http://aethernet.dev', 'aethernet.dev', 80)).toBe('http://aethernet.dev');
		expect(normalizePublicEndpoint('http://aethernet.dev/media', 'aethernet.dev', 80)).toBe(
			'http://aethernet.dev/media',
		);
		expect(normalizePublicEndpoint('ws://aethernet.dev/gateway', 'aethernet.dev', 80)).toBe(
			'ws://aethernet.dev/gateway',
		);
	});
	test('inserts a non-standard port', () => {
		expect(normalizePublicEndpoint('https://aethernet.dev', 'aethernet.dev', 8443)).toBe('https://aethernet.dev:8443');
		expect(normalizePublicEndpoint('https://aethernet.dev/media', 'aethernet.dev', 8443)).toBe(
			'https://aethernet.dev:8443/media',
		);
		expect(normalizePublicEndpoint('wss://aethernet.dev/gateway', 'aethernet.dev', 8443)).toBe(
			'wss://aethernet.dev:8443/gateway',
		);
	});
	test('judges standard ports against the url scheme, not the public scheme', () => {
		expect(normalizePublicEndpoint('http://aethernet.dev/media', 'aethernet.dev', 443)).toBe(
			'http://aethernet.dev:443/media',
		);
		expect(normalizePublicEndpoint('https://aethernet.dev/media', 'aethernet.dev', 80)).toBe(
			'https://aethernet.dev:80/media',
		);
	});
	test('leaves a foreign host untouched', () => {
		expect(normalizePublicEndpoint('https://cdn.example.net/media', 'aethernet.dev', 8443)).toBe(
			'https://cdn.example.net/media',
		);
		expect(normalizePublicEndpoint('https://sub.aethernet.dev', 'aethernet.dev', 8443)).toBe(
			'https://sub.aethernet.dev',
		);
	});
	test('leaves an already ported url untouched', () => {
		expect(normalizePublicEndpoint('https://aethernet.dev:8443/media', 'aethernet.dev', 8443)).toBe(
			'https://aethernet.dev:8443/media',
		);
		expect(normalizePublicEndpoint('https://aethernet.dev:9000/media', 'aethernet.dev', 8443)).toBe(
			'https://aethernet.dev:9000/media',
		);
		expect(normalizePublicEndpoint('https://aethernet.dev:443/media', 'aethernet.dev', 8443)).toBe(
			'https://aethernet.dev:443/media',
		);
	});
	test('is idempotent', () => {
		const once = normalizePublicEndpoint('https://aethernet.dev/media', 'aethernet.dev', 8443);
		expect(normalizePublicEndpoint(once, 'aethernet.dev', 8443)).toBe(once);
	});
	test('preserves path, query, fragment, trailing slash, and case', () => {
		expect(normalizePublicEndpoint('https://aethernet.dev/Media/', 'aethernet.dev', 8443)).toBe(
			'https://aethernet.dev:8443/Media/',
		);
		expect(normalizePublicEndpoint('https://aethernet.dev/media?a=B#Frag', 'aethernet.dev', 8443)).toBe(
			'https://aethernet.dev:8443/media?a=B#Frag',
		);
		expect(normalizePublicEndpoint('https://aethernet.dev?a=B', 'aethernet.dev', 8443)).toBe(
			'https://aethernet.dev:8443?a=B',
		);
		expect(normalizePublicEndpoint('https://aethernet.dev#Frag', 'aethernet.dev', 8443)).toBe(
			'https://aethernet.dev:8443#Frag',
		);
		expect(normalizePublicEndpoint('https://user:pw@aethernet.dev/media', 'aethernet.dev', 8443)).toBe(
			'https://user:pw@aethernet.dev:8443/media',
		);
	});
	test('matches the host case-insensitively and ignores a trailing dot', () => {
		expect(normalizePublicEndpoint('https://AETHERNET.dev/media', 'aethernet.dev', 8443)).toBe(
			'https://AETHERNET.dev:8443/media',
		);
		expect(normalizePublicEndpoint('https://aethernet.dev./media', 'aethernet.dev', 8443)).toBe(
			'https://aethernet.dev.:8443/media',
		);
		expect(normalizePublicEndpoint('https://aethernet.dev/media', 'AETHERNET.dev.', 8443)).toBe(
			'https://aethernet.dev:8443/media',
		);
	});
	test('leaves unparseable and non-http values untouched', () => {
		expect(normalizePublicEndpoint('not a url', 'aethernet.dev', 8443)).toBe('not a url');
		expect(normalizePublicEndpoint('', 'aethernet.dev', 8443)).toBe('');
		expect(normalizePublicEndpoint('android:apk-key-hash:abc', 'aethernet.dev', 8443)).toBe('android:apk-key-hash:abc');
		expect(normalizePublicEndpoint('https://aethernet.dev:/media', 'aethernet.dev', 8443)).toBe(
			'https://aethernet.dev:/media',
		);
	});
	test('leaves malformed authorities untouched', () => {
		expect(normalizePublicEndpoint('https:aethernet.dev/media', 'aethernet.dev', 8443)).toBe(
			'https:aethernet.dev/media',
		);
		expect(normalizePublicEndpoint('https:/aethernet.dev/media', 'aethernet.dev', 8443)).toBe(
			'https:/aethernet.dev/media',
		);
		expect(normalizePublicEndpoint('https:////aethernet.dev/media', 'aethernet.dev', 8443)).toBe(
			'https:////aethernet.dev/media',
		);
		expect(normalizePublicEndpoint('https://aethernet.dev\\media', 'aethernet.dev', 8443)).toBe(
			'https://aethernet.dev:8443\\media',
		);
	});
	test('leaves everything untouched without a usable port or base domain', () => {
		expect(normalizePublicEndpoint('https://aethernet.dev/media', 'aethernet.dev')).toBe('https://aethernet.dev/media');
		expect(normalizePublicEndpoint('https://aethernet.dev/media', '', 8443)).toBe('https://aethernet.dev/media');
		expect(normalizePublicEndpoint('https://aethernet.dev/media', '   ', 8443)).toBe('https://aethernet.dev/media');
	});
});

describe('canonicalizeDomain', () => {
	test('lowercases, trims and drops the root dot', () => {
		expect(canonicalizeDomain('  CHAT.Example.COM.  ')).toBe('chat.example.com');
	});
	test('leaves an empty value empty', () => {
		expect(canonicalizeDomain('   ')).toBe('');
	});
});

describe('parsePublicOrigin', () => {
	test('reads scheme, host and a non-standard port', () => {
		expect(parsePublicOrigin('https://chat.example.com:8443')).toEqual({
			public_scheme: 'https',
			base_domain: 'chat.example.com',
			public_port: 8443,
		});
		expect(parsePublicOrigin('http://chat.example.com:19080')).toEqual({
			public_scheme: 'http',
			base_domain: 'chat.example.com',
			public_port: 19080,
		});
	});
	test('fills in the standard port for a portless origin', () => {
		expect(parsePublicOrigin('https://chat.example.com')).toEqual({
			public_scheme: 'https',
			base_domain: 'chat.example.com',
			public_port: 443,
		});
		expect(parsePublicOrigin('http://chat.example.com')).toEqual({
			public_scheme: 'http',
			base_domain: 'chat.example.com',
			public_port: 80,
		});
	});
	test('normalizes an explicitly written standard port to the portless form', () => {
		const origin = parsePublicOrigin('https://chat.example.com:443');
		assert.ok(origin);
		expect(origin).toEqual({public_scheme: 'https', base_domain: 'chat.example.com', public_port: 443});
		expect(buildUrl(origin.public_scheme, origin.base_domain, origin.public_port)).toBe('https://chat.example.com');
		expect(parsePublicOrigin('http://chat.example.com:80')?.public_port).toBe(80);
	});
	test('canonicalizes the host', () => {
		expect(parsePublicOrigin('  https://CHAT.Example.com.:8443  ')).toEqual({
			public_scheme: 'https',
			base_domain: 'chat.example.com',
			public_port: 8443,
		});
	});
	test('keeps an IPv6 literal bracketed', () => {
		expect(parsePublicOrigin('http://[::1]:19080')).toEqual({
			public_scheme: 'http',
			base_domain: '[::1]',
			public_port: 19080,
		});
	});
	test('accepts a bare trailing slash', () => {
		expect(parsePublicOrigin('https://chat.example.com:8443/')?.public_port).toBe(8443);
	});
	test('rejects anything that is not a bare origin', () => {
		expect(parsePublicOrigin('')).toBeNull();
		expect(parsePublicOrigin('   ')).toBeNull();
		expect(parsePublicOrigin('not a url')).toBeNull();
		expect(parsePublicOrigin('chat.example.com:8443')).toBeNull();
		expect(parsePublicOrigin('wss://chat.example.com')).toBeNull();
		expect(parsePublicOrigin('https://chat.example.com/media')).toBeNull();
		expect(parsePublicOrigin('https://chat.example.com?a=1')).toBeNull();
		expect(parsePublicOrigin('https://chat.example.com#top')).toBeNull();
		expect(parsePublicOrigin('https://user:pw@chat.example.com')).toBeNull();
	});
});

describe('endpoints derived from a public origin', () => {
	test('an origin with a non-standard port ports every derived endpoint', () => {
		const origin = parsePublicOrigin('https://chat.example.com:29080');
		assert.ok(origin);
		const endpoints = deriveEndpointsFromDomain({
			...origin,
			internal_scheme: 'http',
		});
		expect(endpoints.api_client).toBe('https://chat.example.com:29080/api');
		expect(endpoints.app).toBe('https://chat.example.com:29080');
		expect(endpoints.gateway).toBe('wss://chat.example.com:29080/gateway');
		expect(endpoints.admin).toBe('https://chat.example.com:29080/admin');
	});
	test('an origin written with an explicit :443 derives portless endpoints', () => {
		const origin = parsePublicOrigin('https://chat.example.com:443');
		assert.ok(origin);
		const endpoints = deriveEndpointsFromDomain({
			...origin,
			internal_scheme: 'http',
		});
		expect(endpoints.admin).toBe('https://chat.example.com/admin');
		expect(endpoints.app).toBe('https://chat.example.com');
		expect(endpoints.gateway).toBe('wss://chat.example.com/gateway');
	});
});
