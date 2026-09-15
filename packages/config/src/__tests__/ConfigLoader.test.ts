// SPDX-License-Identifier: AGPL-3.0-or-later

import {generateKeyPairSync} from 'node:crypto';
import {getConfig, loadConfig, resetConfig} from '@aethernet/config/src/ConfigLoader';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

const MINIMAL_ENV: Record<string, string> = {
	AETHERNET_ENV: 'test',
	AETHERNET_BASE_DOMAIN: 'localhost',
	AETHERNET_PUBLIC_SCHEME: 'http',
	AETHERNET_PUBLIC_PORT: '8088',
	AETHERNET_CASSANDRA_HOSTS: '127.0.0.1',
	AETHERNET_CASSANDRA_PORT: '9042',
	AETHERNET_CASSANDRA_KEYSPACE: 'aethernet_test',
	AETHERNET_CASSANDRA_LOCAL_DC: 'datacenter1',
	AETHERNET_CASSANDRA_USERNAME: 'test-user',
	AETHERNET_CASSANDRA_PASSWORD: 'test-password',
	AETHERNET_S3_ENDPOINT: 'http://127.0.0.1:3900',
	AETHERNET_S3_ACCESS_KEY_ID: 'test-key',
	AETHERNET_S3_SECRET_ACCESS_KEY: 'test-secret',
	AETHERNET_MEDIA_PROXY_SECRET_KEY: 'test-media-secret',
	AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
	AETHERNET_ADMIN_SECRET_KEY_BASE: 'test-admin-secret',
	AETHERNET_ADMIN_OAUTH_CLIENT_SECRET: 'test-admin-oauth-secret',
	AETHERNET_APP_PROXY_PORT: '8773',
	AETHERNET_GATEWAY_MEDIA_PROXY_ENDPOINT: 'http://127.0.0.1:8088/media',
	AETHERNET_GATEWAY_RPC_AUTH_TOKEN: 'test-gateway-token',
	AETHERNET_SUDO_MODE_SECRET: 'test-sudo-secret',
	AETHERNET_CONNECTION_INITIATION_SECRET: 'test-connection-secret',
	AETHERNET_VAPID_PUBLIC_KEY: 'BB76bTFIuoqmxJtTfZX0yGTn1f_qu9H03B_nkj8OyExJFkN7Y-HBZZzShnHZoEhXKc5ZRy3jFu7OkBbnaQG-4aw',
	AETHERNET_VAPID_PRIVATE_KEY: 'Xgi-3P8J-I3Q6U1HlCcXMuc_tKLGAM9nIfznX3Hz68o',
};

function generateVapidPair(): {publicKey: string; privateKey: string} {
	const {privateKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
	const jwk = privateKey.export({format: 'jwk'});
	const x = Buffer.from(jwk.x ?? '', 'base64url');
	const y = Buffer.from(jwk.y ?? '', 'base64url');
	const d = Buffer.from(jwk.d ?? '', 'base64url');
	return {
		publicKey: Buffer.concat([Buffer.from([0x04]), x, y]).toString('base64url'),
		privateKey: d.toString('base64url'),
	};
}

function stubMinimalEnv(overrides: Record<string, string> = {}): void {
	for (const [key, value] of Object.entries({...MINIMAL_ENV, ...overrides})) {
		vi.stubEnv(key, value);
	}
}

function clearAethernetEnv(): void {
	for (const key of Object.keys(process.env)) {
		if (key.startsWith('AETHERNET_')) {
			vi.stubEnv(key, undefined);
		}
	}
}

describe('ConfigLoader', () => {
	beforeEach(() => {
		resetConfig();
		clearAethernetEnv();
	});

	afterEach(() => {
		resetConfig();
		vi.unstubAllEnvs();
	});

	test('loadConfig builds and caches config from AETHERNET environment variables', async () => {
		stubMinimalEnv();
		const config = await loadConfig();
		expect(config.env).toBe('test');
		expect(config.domain.base_domain).toBe('localhost');
		expect(config.database.backend).toBe('postgres');
		expect(config.database.postgres.database).toBe('aethernet');
		expect(config.database.cassandra.hosts).toEqual(['127.0.0.1']);

		vi.stubEnv('AETHERNET_BASE_DOMAIN', 'changed.example');
		expect((await loadConfig()).domain.base_domain).toBe('localhost');
	});

	test('getConfig throws when config is not loaded', () => {
		expect(() => getConfig()).toThrow('Config not loaded');
	});

	test('resetConfig clears the cache', async () => {
		stubMinimalEnv();
		await loadConfig();
		expect(() => getConfig()).not.toThrow();
		resetConfig();
		expect(() => getConfig()).toThrow('Config not loaded');
	});

	test('derives endpoints from domain config', async () => {
		stubMinimalEnv();
		const config = await loadConfig();
		expect(config.endpoints.api).toBe('http://localhost:8088/api');
		expect(config.endpoints.gateway).toBe('ws://localhost:8088/gateway');
	});

	test('endpoint overrides take precedence over derived endpoints', async () => {
		stubMinimalEnv({
			AETHERNET_API_ENDPOINT: 'https://custom-api.example.com',
			AETHERNET_API_CLIENT_ENDPOINT: 'https://custom-api-client.example.com',
			AETHERNET_GATEWAY_ENDPOINT: 'wss://custom-gw.example.com',
		});

		const config = await loadConfig();

		expect(config.endpoints.api).toBe('https://custom-api.example.com');
		expect(config.endpoints.api_client).toBe('https://custom-api-client.example.com');
		expect(config.endpoints.gateway).toBe('wss://custom-gw.example.com');
		expect(config.endpoints.app).toBe('http://localhost:8088');
	});

	test('inserts the public port into portless endpoints on a non-standard port', async () => {
		stubMinimalEnv({
			AETHERNET_MARKETING_ENDPOINT: 'http://localhost',
			AETHERNET_MEDIA_ENDPOINT: 'http://localhost/media',
			AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_ENDPOINT: 'http://localhost/media',
			AETHERNET_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: 'http://localhost',
		});

		const config = await loadConfig();

		expect(config.endpoints.marketing).toBe('http://localhost:8088');
		expect(config.endpoints.media).toBe('http://localhost:8088/media');
		expect(config.services.media_proxy.upload_relay.endpoint).toBe('http://localhost:8088/media');
		expect(config.auth.passkeys.additional_allowed_origins).toEqual(['http://localhost:8088']);
	});

	test('leaves a default https install untouched', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: 'chat.example',
			AETHERNET_PUBLIC_SCHEME: 'https',
			AETHERNET_PUBLIC_PORT: '443',
			AETHERNET_MARKETING_ENDPOINT: 'https://chat.example',
			AETHERNET_MEDIA_ENDPOINT: 'https://chat.example/media',
			AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_ENDPOINT: 'https://chat.example/media',
			AETHERNET_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: 'https://chat.example',
		});

		const config = await loadConfig();

		expect(config.endpoints.marketing).toBe('https://chat.example');
		expect(config.endpoints.media).toBe('https://chat.example/media');
		expect(config.endpoints.api).toBe('https://chat.example/api');
		expect(config.endpoints.gateway).toBe('wss://chat.example/gateway');
		expect(config.services.media_proxy.upload_relay.endpoint).toBe('https://chat.example/media');
		expect(config.auth.passkeys.additional_allowed_origins).toEqual(['https://chat.example']);
	});

	test('leaves a default http install untouched', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: 'chat.example',
			AETHERNET_PUBLIC_SCHEME: 'http',
			AETHERNET_PUBLIC_PORT: '80',
			AETHERNET_MARKETING_ENDPOINT: 'http://chat.example',
			AETHERNET_MEDIA_ENDPOINT: 'http://chat.example/media',
			AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_ENDPOINT: 'http://chat.example/media',
		});

		const config = await loadConfig();

		expect(config.endpoints.marketing).toBe('http://chat.example');
		expect(config.endpoints.media).toBe('http://chat.example/media');
		expect(config.endpoints.gateway).toBe('ws://chat.example/gateway');
		expect(config.services.media_proxy.upload_relay.endpoint).toBe('http://chat.example/media');
	});

	test('leaves foreign hosts and already ported endpoints untouched', async () => {
		stubMinimalEnv({
			AETHERNET_STATIC_CDN_ENDPOINT: 'https://cdn.example.net',
			AETHERNET_MEDIA_ENDPOINT: 'https://media.example.net/media',
			AETHERNET_MARKETING_ENDPOINT: 'http://localhost:9999',
			AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_ENDPOINT: 'http://localhost:8088/media',
		});

		const config = await loadConfig();

		expect(config.endpoints.static_cdn).toBe('https://cdn.example.net');
		expect(config.endpoints.media).toBe('https://media.example.net/media');
		expect(config.endpoints.marketing).toBe('http://localhost:9999');
		expect(config.services.media_proxy.upload_relay.endpoint).toBe('http://localhost:8088/media');
	});

	test('normalizes each passkey origin independently', async () => {
		stubMinimalEnv({
			AETHERNET_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS:
				'http://localhost,http://localhost:3000,https://desktop.example.net,android:apk-key-hash:keSY4bimyLqZQV7bKXgpa2xYuqXi0qZJzsYtp6gpx7w',
		});

		const config = await loadConfig();

		expect(config.auth.passkeys.additional_allowed_origins).toEqual([
			'http://localhost:8088',
			'http://localhost:3000',
			'https://desktop.example.net',
			'android:apk-key-hash:keSY4bimyLqZQV7bKXgpa2xYuqXi0qZJzsYtp6gpx7w',
		]);
	});

	test('includes the app origin alongside the default passkey origins', async () => {
		stubMinimalEnv();
		const config = await loadConfig();
		expect(config.auth.passkeys.additional_allowed_origins).toEqual([
			'https://aethernet.app',
			'https://web.aethernet.app',
			'https://web.canary.aethernet.app',
			'android:apk-key-hash:keSY4bimyLqZQV7bKXgpa2xYuqXi0qZJzsYtp6gpx7w',
			'android:apk-key-hash:zRmCKDKo3uCX2GDZISjJx8Rzo3J-Y3Gbp7s7mAaUH28',
			'http://localhost:8088',
		]);
	});

	test('rejects an empty client API endpoint override', async () => {
		stubMinimalEnv({AETHERNET_API_CLIENT_ENDPOINT: ''});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_API_CLIENT_ENDPOINT is required');
	});

	test('defaults the passkey relying party to the deployment domain', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: 'chat.example.com',
			AETHERNET_PUBLIC_SCHEME: 'https',
			AETHERNET_PUBLIC_PORT: '443',
		});

		const config = await loadConfig();

		expect(config.auth.passkeys.rp_id).toBe('chat.example.com');
	});

	test('uses only the app origin when the operator clears the default list', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: 'chat.example.com',
			AETHERNET_PUBLIC_SCHEME: 'https',
			AETHERNET_PUBLIC_PORT: '443',
			AETHERNET_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: '',
		});

		const config = await loadConfig();

		expect(config.auth.passkeys.additional_allowed_origins).toEqual(['https://chat.example.com']);
	});

	test('keeps explicit passkey relying party values', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: 'chat.example.com',
			AETHERNET_PUBLIC_SCHEME: 'https',
			AETHERNET_PUBLIC_PORT: '443',
			AETHERNET_PASSKEY_RP_ID: 'example.com',
			AETHERNET_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: 'https://example.com,https://app.example.com',
		});

		const config = await loadConfig();

		expect(config.auth.passkeys.rp_id).toBe('example.com');
		expect(config.auth.passkeys.additional_allowed_origins).toEqual(['https://example.com', 'https://app.example.com']);
	});

	test('parses typed named environment variables', async () => {
		stubMinimalEnv({
			AETHERNET_API_PORT: '9090',
			AETHERNET_CASSANDRA_HOSTS: 'db1,db2',
			AETHERNET_POSTGRES_HOST: 'pg1',
			AETHERNET_POSTGRES_PORT: '5544',
			AETHERNET_POSTGRES_MAX_CONNECTIONS: '7',
			AETHERNET_POSTGRES_SSL_CA: '-----BEGIN CERTIFICATE-----\\n-----END CERTIFICATE-----',
			AETHERNET_POSTGRES_PREPARED_STATEMENTS: 'false',
			AETHERNET_API_WORKER_MODE: 'single_task',
			AETHERNET_API_WORKER_TASK: 'processStripeWebhook',
			AETHERNET_ACCOUNT_POLICY_DSL: '{"version":1,"id":"env_policy","rules":[]}',
			AETHERNET_LIVEKIT_ENABLED: 'true',
			AETHERNET_LIVEKIT_DEFAULT_REGION:
				'{"id":"local","name":"Local","emoji":"LC","latitude":59.3293,"longitude":18.0686}',
		});

		const config = await loadConfig();

		expect(config.services.api.port).toBe(9090);
		expect(config.database.cassandra.hosts).toEqual(['db1', 'db2']);
		expect(config.database.postgres.host).toBe('pg1');
		expect(config.database.postgres.port).toBe(5544);
		expect(config.database.postgres.max_connections).toBe(7);
		expect(config.database.postgres.ssl_ca).toBe('-----BEGIN CERTIFICATE-----\\n-----END CERTIFICATE-----');
		expect(config.database.postgres.prepared_statements).toBe(false);
		expect(config.services.api.worker?.mode).toBe('single_task');
		expect(config.services.api.worker?.task).toBe('processStripeWebhook');
		expect(config.integrations.risk_integration.account_policy_dsl).toEqual({
			version: 1,
			id: 'env_policy',
			rules: [],
		});
		expect(config.integrations.voice.default_region?.id).toBe('local');
	});

	test('ignores AETHERNET_GATEWAY_PUSH_ENABLED, which only the gateway reads', async () => {
		stubMinimalEnv({AETHERNET_GATEWAY_PUSH_ENABLED: 'false'});

		const config = await loadConfig();

		expect(config.services.gateway).not.toHaveProperty('push_enabled');
	});

	test('rejects single task worker mode without task env', async () => {
		stubMinimalEnv({AETHERNET_API_WORKER_MODE: 'single_task'});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_API_WORKER_TASK');
	});

	test('rejects invalid Postgres typed environment values', async () => {
		stubMinimalEnv({AETHERNET_POSTGRES_PORT: 'abc'});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_POSTGRES_PORT');
	});

	test('rejects a non-integer port', async () => {
		stubMinimalEnv({AETHERNET_API_PORT: '80a'});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_API_PORT must be an integer, got "80a"');
	});

	test('rejects malformed JSON for a JSON-shaped variable', async () => {
		stubMinimalEnv({AETHERNET_LIVEKIT_DEFAULT_REGION: '{bad'});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_LIVEKIT_DEFAULT_REGION must be valid JSON');
	});

	test('keeps Postgres prepared statements on by default', async () => {
		stubMinimalEnv();
		expect((await loadConfig()).database.postgres.prepared_statements).toBe(true);
	});

	test('rejects a non-boolean Postgres prepared statements value', async () => {
		stubMinimalEnv({AETHERNET_POSTGRES_PREPARED_STATEMENTS: 'maybe'});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_POSTGRES_PREPARED_STATEMENTS');
	});

	test('keeps the api http timeouts at their defaults', async () => {
		stubMinimalEnv();
		const config = await loadConfig();
		expect(config.services.api.headers_timeout_ms).toBe(30_000);
		expect(config.services.api.request_timeout_ms).toBe(120_000);
	});

	test('reads the api http timeouts from the environment', async () => {
		stubMinimalEnv({AETHERNET_API_HEADERS_TIMEOUT_MS: '45000', AETHERNET_API_REQUEST_TIMEOUT_MS: '600000'});
		const config = await loadConfig();
		expect(config.services.api.headers_timeout_ms).toBe(45_000);
		expect(config.services.api.request_timeout_ms).toBe(600_000);
	});

	test('rejects a non-numeric api header timeout', async () => {
		stubMinimalEnv({AETHERNET_API_HEADERS_TIMEOUT_MS: 'soon'});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_API_HEADERS_TIMEOUT_MS');
	});

	test('rejects a non-numeric api request timeout', async () => {
		stubMinimalEnv({AETHERNET_API_REQUEST_TIMEOUT_MS: 'soon'});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_API_REQUEST_TIMEOUT_MS');
	});

	test('applies the KV mode from the environment', async () => {
		stubMinimalEnv({AETHERNET_KV_MODE: 'cluster'});
		expect((await loadConfig()).internal.kv_mode).toBe('cluster');
	});

	test('rejects an unknown KV mode', async () => {
		stubMinimalEnv({AETHERNET_KV_MODE: 'sentinel'});
		await expect(loadConfig()).rejects.toThrow('Invalid AETHERNET_KV_MODE: sentinel');
	});

	test('rejects unsafe production Postgres defaults', async () => {
		stubMinimalEnv({AETHERNET_ENV: 'production'});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_POSTGRES_HOST');
	});

	test('accepts explicitly configured production Postgres with TLS', async () => {
		stubMinimalEnv({
			AETHERNET_ENV: 'production',
			AETHERNET_POSTGRES_HOST: 'postgres.internal',
			AETHERNET_POSTGRES_DATABASE: 'aethernet_prod',
			AETHERNET_POSTGRES_USERNAME: 'aethernet_app',
			AETHERNET_POSTGRES_PASSWORD: 'prod-postgres-secret',
			AETHERNET_POSTGRES_SSL: 'true',
		});

		const config = await loadConfig();

		expect(config.database.postgres.host).toBe('postgres.internal');
		expect(config.database.postgres.ssl).toBe(true);
	});

	test('allows self-hosted production Postgres without TLS', async () => {
		stubMinimalEnv({
			AETHERNET_ENV: 'production',
			AETHERNET_SELF_HOSTED: 'true',
			AETHERNET_POSTGRES_HOST: 'postgres',
			AETHERNET_POSTGRES_DATABASE: 'aethernet',
			AETHERNET_POSTGRES_USERNAME: 'aethernet',
			AETHERNET_POSTGRES_PASSWORD: 'self-hosted-postgres-secret',
			AETHERNET_POSTGRES_SSL: 'false',
		});

		const config = await loadConfig();

		expect(config.instance.self_hosted).toBe(true);
		expect(config.database.postgres.ssl).toBe(false);
	});

	test('still requires TLS for non-self-hosted production Postgres', async () => {
		stubMinimalEnv({
			AETHERNET_ENV: 'production',
			AETHERNET_POSTGRES_HOST: 'postgres.internal',
			AETHERNET_POSTGRES_DATABASE: 'aethernet_prod',
			AETHERNET_POSTGRES_USERNAME: 'aethernet_app',
			AETHERNET_POSTGRES_PASSWORD: 'prod-postgres-secret',
			AETHERNET_POSTGRES_SSL: 'false',
		});

		await expect(loadConfig()).rejects.toThrow('AETHERNET_POSTGRES_SSL must be true');
	});

	test('parses self-host branding, setup, abuse policy, and search engine environment variables', async () => {
		stubMinimalEnv({
			AETHERNET_SEARCH_ENGINE: 'meilisearch',
			AETHERNET_SEARCH_URL: 'http://meilisearch:7700',
			AETHERNET_SEARCH_API_KEY: 'meili-key',
			AETHERNET_SELF_HOSTED: 'true',
			AETHERNET_APP_PRODUCT_NAME: 'Example Chat',
			AETHERNET_APP_ICON_URL: 'https://assets.example/icon.png',
			AETHERNET_APP_SYMBOL_URL: 'https://assets.example/symbol.png',
			AETHERNET_APP_LOGO_URL: 'https://assets.example/logo.png',
			AETHERNET_APP_WORDMARK_URL: 'https://assets.example/wordmark.png',
			AETHERNET_APP_FAVICON_URL: 'https://assets.example/favicon.png',
			AETHERNET_APP_THEME_COLOR: '#123456',
			AETHERNET_INSTANCE_SETUP_CONFIGURED: 'true',
			AETHERNET_ABUSE_INBOUND_PHONE_COUNTRY_CODES: 'AA,BB',
			AETHERNET_ABUSE_PHONE_INBOUND_REQUIRED_PREFIXES: '+101,+202',
			AETHERNET_ABUSE_DIRECT_CONTACT_SPAM_ENABLED: 'true',
			AETHERNET_ABUSE_DIRECT_CONTACT_SPAM_COUNTRY_CODES: 'AA,BB',
			AETHERNET_ABUSE_DIRECT_CONTACT_SPAM_DISTINCT_TARGET_THRESHOLD: '9',
			AETHERNET_ABUSE_DIRECT_CONTACT_SPAM_TARGET_WINDOW_MS: '12345',
			AETHERNET_ABUSE_DIRECT_CONTACT_SPAM_ACTION: 'suppress_delivery',
		});

		const config = await loadConfig();

		expect(config.integrations.search.engine).toBe('meilisearch');
		expect(config.integrations.search.url).toBe('http://meilisearch:7700');
		expect(config.integrations.search.api_key).toBe('meili-key');
		expect(config.instance.self_hosted).toBe(true);
		expect(config.instance.branding).toEqual({
			product_name: 'Example Chat',
			icon_url: 'https://assets.example/icon.png',
			symbol_url: 'https://assets.example/symbol.png',
			logo_url: 'https://assets.example/logo.png',
			wordmark_url: 'https://assets.example/wordmark.png',
			favicon_url: 'https://assets.example/favicon.png',
			theme_color: '#123456',
		});
		expect(config.instance.setup.configured).toBe(true);
		expect(config.instance.abuse_policy).toEqual({
			inbound_phone_country_codes: ['AA', 'BB'],
			phone_verification: {
				inbound_required_prefixes: ['+101', '+202'],
			},
			direct_contact_spam: {
				enabled: true,
				country_codes: ['AA', 'BB'],
				distinct_target_threshold: 9,
				target_window_ms: 12345,
				action: 'suppress_delivery',
			},
		});
	});

	test('rejects an enabled captcha with no keys for the selected provider', async () => {
		stubMinimalEnv({AETHERNET_CAPTCHA_ENABLED: 'true', AETHERNET_CAPTCHA_PROVIDER: 'hcaptcha'});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_CAPTCHA_HCAPTCHA_SITE_KEY is required');
	});

	test('rejects an enabled captcha with a site key but no secret key', async () => {
		stubMinimalEnv({
			AETHERNET_CAPTCHA_ENABLED: 'true',
			AETHERNET_CAPTCHA_PROVIDER: 'turnstile',
			AETHERNET_CAPTCHA_TURNSTILE_SITE_KEY: 'turnstile-site-key',
		});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_CAPTCHA_TURNSTILE_SECRET_KEY is required');
	});

	test('rejects an enabled captcha with no provider', async () => {
		stubMinimalEnv({AETHERNET_CAPTCHA_ENABLED: 'true'});
		await expect(loadConfig()).rejects.toThrow(
			'AETHERNET_CAPTCHA_PROVIDER must be hcaptcha or turnstile when AETHERNET_CAPTCHA_ENABLED is true',
		);
	});

	test('accepts an enabled captcha with both keys for the selected provider', async () => {
		stubMinimalEnv({
			AETHERNET_CAPTCHA_ENABLED: 'true',
			AETHERNET_CAPTCHA_PROVIDER: 'hcaptcha',
			AETHERNET_CAPTCHA_HCAPTCHA_SITE_KEY: 'hcaptcha-site-key',
			AETHERNET_CAPTCHA_HCAPTCHA_SECRET_KEY: 'hcaptcha-secret-key',
		});

		const config = await loadConfig();

		expect(config.integrations.captcha.enabled).toBe(true);
		expect(config.integrations.captcha.hcaptcha?.secret_key).toBe('hcaptcha-secret-key');
	});

	test('leaves a disabled captcha unvalidated', async () => {
		stubMinimalEnv({AETHERNET_CAPTCHA_PROVIDER: 'hcaptcha'});
		expect((await loadConfig()).integrations.captcha.enabled).toBe(false);
	});

	test('leaves Bluesky login off with no legal URLs by default', async () => {
		stubMinimalEnv();

		const config = await loadConfig();

		expect(config.auth.bluesky.enabled).toBe(false);
		expect(config.auth.bluesky.tos_uri).toBe('');
		expect(config.auth.bluesky.policy_uri).toBe('');
		expect(config.auth.bluesky.keys).toEqual([]);
	});

	test('applies explicit Bluesky legal URLs from the environment', async () => {
		stubMinimalEnv({
			AETHERNET_AUTH_BLUESKY_ENABLED: 'true',
			AETHERNET_AUTH_BLUESKY_TOS_URI: 'https://chat.example.com/terms',
			AETHERNET_AUTH_BLUESKY_POLICY_URI: 'https://chat.example.com/privacy',
		});

		const config = await loadConfig();

		expect(config.auth.bluesky.enabled).toBe(true);
		expect(config.auth.bluesky.tos_uri).toBe('https://chat.example.com/terms');
		expect(config.auth.bluesky.policy_uri).toBe('https://chat.example.com/privacy');
	});

	test('reads the upload relay secret through the override table', async () => {
		const secret = Buffer.alloc(32, 9).toString('base64');
		stubMinimalEnv({AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: secret});

		const config = await loadConfig();

		expect(config.services.media_proxy.upload_relay.secret_base64).toBe(secret);
	});

	test('defaults the upload relay body limit to the media proxy ceiling', async () => {
		stubMinimalEnv();
		expect((await loadConfig()).services.media_proxy.upload_relay.max_body_bytes).toBe(524_288_000);
	});

	test('rejects a missing upload relay secret in upload mode', async () => {
		stubMinimalEnv();
		vi.stubEnv('AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64', '');

		await expect(loadConfig()).rejects.toThrow(
			'AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 is required in upload mode',
		);
	});

	test('rejects a non-base64 upload relay secret', async () => {
		stubMinimalEnv({AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: 'not base64!'});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 must be base64');
	});

	test('rejects an upload relay secret shorter than 32 bytes', async () => {
		stubMinimalEnv({AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: Buffer.alloc(16, 7).toString('base64')});
		await expect(loadConfig()).rejects.toThrow(
			'AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 must decode to at least 32 bytes',
		);
	});

	test('leaves the upload relay secret optional outside upload mode', async () => {
		stubMinimalEnv({AETHERNET_MEDIA_PROXY_MODE: 'mp'});
		vi.stubEnv('AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64', '');

		const config = await loadConfig();

		expect(config.services.media_proxy.upload_relay.secret_base64).toBe('');
	});

	test('rejects a VAPID public key that is not a 65-byte uncompressed point', async () => {
		const {privateKey} = generateVapidPair();
		stubMinimalEnv({
			AETHERNET_VAPID_PUBLIC_KEY: Buffer.alloc(64, 4).toString('base64url'),
			AETHERNET_VAPID_PRIVATE_KEY: privateKey,
		});
		await expect(loadConfig()).rejects.toThrow(
			'AETHERNET_VAPID_PUBLIC_KEY must be the base64url 65-byte uncompressed P-256 point',
		);
	});

	test('rejects a VAPID private key that is not a 32-byte scalar', async () => {
		const {publicKey} = generateVapidPair();
		stubMinimalEnv({
			AETHERNET_VAPID_PUBLIC_KEY: publicKey,
			AETHERNET_VAPID_PRIVATE_KEY: Buffer.alloc(31, 9).toString('base64url'),
		});
		await expect(loadConfig()).rejects.toThrow(
			'AETHERNET_VAPID_PRIVATE_KEY must be the base64url 32-byte P-256 scalar',
		);
	});

	test('rejects a well formed VAPID scalar that does not derive the public point', async () => {
		const {publicKey} = generateVapidPair();
		const other = generateVapidPair();
		stubMinimalEnv({
			AETHERNET_VAPID_PUBLIC_KEY: publicKey,
			AETHERNET_VAPID_PRIVATE_KEY: other.privateKey,
		});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_VAPID_PRIVATE_KEY does not match AETHERNET_VAPID_PUBLIC_KEY');
	});

	test('accepts a generated VAPID pair', async () => {
		const pair = generateVapidPair();
		stubMinimalEnv({
			AETHERNET_VAPID_PUBLIC_KEY: pair.publicKey,
			AETHERNET_VAPID_PRIVATE_KEY: pair.privateKey,
		});

		const config = await loadConfig();

		expect(config.auth.vapid.public_key).toBe(pair.publicKey);
		expect(config.auth.vapid.private_key).toBe(pair.privateKey);
	});

	test('requires a complete environment', async () => {
		vi.stubEnv('AETHERNET_ENV', 'test');
		await expect(loadConfig()).rejects.toThrow();
	});

	test('inserts the public port into the LiveKit url', async () => {
		stubMinimalEnv({AETHERNET_LIVEKIT_URL: 'http://localhost/livekit'});

		const config = await loadConfig();

		expect(config.integrations.voice.url).toBe('http://localhost:8088/livekit');
	});

	test('inserts the public port into every other public url the config carries', async () => {
		stubMinimalEnv({
			AETHERNET_GATEWAY_MEDIA_PROXY_ENDPOINT: 'http://localhost/media',
			AETHERNET_S3_PUBLIC_ENDPOINT: 'http://localhost/s3',
			AETHERNET_EMAIL_APP_BASE_URL: 'http://localhost',
			AETHERNET_SMS_INBOUND_WEBHOOK_PUBLIC_URL: 'http://localhost/webhooks/sms',
			AETHERNET_AUTH_BLUESKY_CLIENT_URI: 'http://localhost',
			AETHERNET_AUTH_BLUESKY_TOS_URI: 'http://localhost/terms',
			AETHERNET_APP_ICON_URL: 'http://localhost/icon.png',
			AETHERNET_LIVEKIT_INTERNAL_URL: 'http://livekit:7880',
		});

		const config = await loadConfig();

		expect(config.services.gateway.media_proxy_endpoint).toBe('http://localhost:8088/media');
		expect(config.s3?.presigned_url_base).toBe('http://localhost:8088/s3');
		expect(config.integrations.email.app_base_url).toBe('http://localhost:8088');
		expect(config.integrations.sms.inbound_webhook_public_url).toBe('http://localhost:8088/webhooks/sms');
		expect(config.auth.bluesky.client_uri).toBe('http://localhost:8088');
		expect(config.auth.bluesky.tos_uri).toBe('http://localhost:8088/terms');
		expect(config.instance.branding.icon_url).toBe('http://localhost:8088/icon.png');
		expect(config.integrations.voice.internal_url).toBe('http://livekit:7880');
	});

	test('rejects a public port outside the valid range', async () => {
		stubMinimalEnv({AETHERNET_PUBLIC_PORT: '70000'});
		await expect(loadConfig()).rejects.toThrow('AETHERNET_PUBLIC_PORT must be an integer between 1 and 65535');
	});
});

describe('AETHERNET_PUBLIC_ORIGIN', () => {
	beforeEach(() => {
		resetConfig();
		clearAethernetEnv();
	});

	afterEach(() => {
		resetConfig();
		vi.unstubAllEnvs();
	});

	test('a ported origin ports every derived endpoint and every compose override', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: 'chat.example.com',
			AETHERNET_PUBLIC_SCHEME: 'https',
			AETHERNET_PUBLIC_PORT: '',
			AETHERNET_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
			AETHERNET_MARKETING_ENDPOINT: 'https://chat.example.com:29080',
			AETHERNET_MEDIA_ENDPOINT: 'https://chat.example.com:29080/media',
			AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_ENDPOINT: 'https://chat.example.com:29080/media',
			AETHERNET_LIVEKIT_URL: 'https://chat.example.com:29080/livekit',
			AETHERNET_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: 'https://chat.example.com:29080',
		});

		const config = await loadConfig();

		expect(config.domain.public_port).toBe(29080);
		expect(config.domain.public_origin).toBe('https://chat.example.com:29080');
		expect(config.endpoints.api_client).toBe('https://chat.example.com:29080/api');
		expect(config.endpoints.app).toBe('https://chat.example.com:29080');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com:29080/gateway');
		expect(config.endpoints.admin).toBe('https://chat.example.com:29080/admin');
		expect(config.endpoints.marketing).toBe('https://chat.example.com:29080');
		expect(config.endpoints.media).toBe('https://chat.example.com:29080/media');
		expect(config.services.media_proxy.upload_relay.endpoint).toBe('https://chat.example.com:29080/media');
		expect(config.integrations.voice.url).toBe('https://chat.example.com:29080/livekit');
		expect(config.auth.passkeys.additional_allowed_origins).toEqual(['https://chat.example.com:29080']);
	});

	test('the origin port wins over a AETHERNET_PUBLIC_PORT that disagrees', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: 'chat.example.com',
			AETHERNET_PUBLIC_SCHEME: 'https',
			AETHERNET_PUBLIC_PORT: '443',
			AETHERNET_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
		});

		const config = await loadConfig();

		expect(config.domain.public_port).toBe(29080);
		expect(config.endpoints.app).toBe('https://chat.example.com:29080');
		expect(config.endpoints.api_client).toBe('https://chat.example.com:29080/api');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com:29080/gateway');
		expect(config.endpoints.admin).toBe('https://chat.example.com:29080/admin');
	});

	test('accepts an origin whose port matches AETHERNET_PUBLIC_PORT', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: 'chat.example.com',
			AETHERNET_PUBLIC_SCHEME: 'https',
			AETHERNET_PUBLIC_PORT: '29080',
			AETHERNET_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
		});

		expect((await loadConfig()).endpoints.gateway).toBe('wss://chat.example.com:29080/gateway');
	});

	test('normalizes an origin written with an explicit default port', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: 'chat.example.com',
			AETHERNET_PUBLIC_SCHEME: 'https',
			AETHERNET_PUBLIC_PORT: '443',
			AETHERNET_PUBLIC_ORIGIN: 'https://chat.example.com:443',
			AETHERNET_ADMIN_ENDPOINT: 'https://chat.example.com/admin',
		});

		const config = await loadConfig();

		expect(config.domain.public_port).toBe(443);
		expect(config.domain.public_origin).toBe('https://chat.example.com');
		expect(config.endpoints.admin).toBe('https://chat.example.com/admin');
		expect(config.endpoints.app).toBe('https://chat.example.com');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com/gateway');
	});

	test('takes the scheme and the domain from the origin when neither is set', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: '',
			AETHERNET_PUBLIC_SCHEME: '',
			AETHERNET_PUBLIC_PORT: '',
			AETHERNET_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
		});

		const config = await loadConfig();

		expect(config.domain.base_domain).toBe('chat.example.com');
		expect(config.domain.public_scheme).toBe('https');
		expect(config.domain.public_port).toBe(29080);
	});

	test('the origin scheme wins over a AETHERNET_PUBLIC_SCHEME that disagrees', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: 'chat.example.com',
			AETHERNET_PUBLIC_SCHEME: 'http',
			AETHERNET_PUBLIC_PORT: '',
			AETHERNET_PUBLIC_ORIGIN: 'https://chat.example.com',
		});

		const config = await loadConfig();

		expect(config.domain.public_scheme).toBe('https');
		expect(config.endpoints.app).toBe('https://chat.example.com');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com/gateway');
	});

	test('the origin host wins over a AETHERNET_BASE_DOMAIN that disagrees', async () => {
		stubMinimalEnv({
			AETHERNET_BASE_DOMAIN: 'chat.example.com',
			AETHERNET_PUBLIC_SCHEME: 'https',
			AETHERNET_PUBLIC_PORT: '',
			AETHERNET_PUBLIC_ORIGIN: 'https://other.example.com',
		});

		const config = await loadConfig();

		expect(config.domain.base_domain).toBe('other.example.com');
		expect(config.endpoints.app).toBe('https://other.example.com');
	});

	test('refuses to boot on an origin that is not a bare origin', async () => {
		stubMinimalEnv({AETHERNET_PUBLIC_ORIGIN: 'https://chat.example.com/app'});
		await expect(loadConfig()).rejects.toThrow(
			'AETHERNET_PUBLIC_ORIGIN must be a scheme, host and optional port such as https://chat.example.com:8443',
		);
	});

	test('leaves the derived origin canonical when nothing is set', async () => {
		stubMinimalEnv();
		expect((await loadConfig()).domain.public_origin).toBe('http://localhost:8088');
	});
});
