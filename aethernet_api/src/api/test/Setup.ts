// SPDX-License-Identifier: AGPL-3.0-or-later

import {existsSync} from 'node:fs';
import {loadConfig} from '@aethernet/config/src/ConfigLoader';
import type {UserPartialResponse} from '@aethernet/schema/src/domains/user/UserResponseSchemas';
import {afterAll, afterEach, beforeAll} from 'vitest';
import type {UserID} from '../BrandedTypes';
import {buildAPIConfigFromMaster, initializeConfig} from '../Config';
import {setInjectedMessageResponseDataService} from '../channel/services/message/MessageResponseDataService';
import {
	resetCassandraQueryExecutorForTesting,
	setCassandraQueryExecutorForTesting,
	shutdownCassandraQueryExecutorForTesting,
} from '../database/CassandraQueryExecution';
import type {IUsersServiceClient} from '../infrastructure/UsersServiceClient';
import {setInjectedUsersServiceClient} from '../infrastructure/UsersServiceClient';
import {initializeLogger} from '../Logger';
import {setInjectedKVProvider, setInjectedSnowflakeService} from '../middleware/ServiceRegistry';
import {getInstanceConfigRepository, getUserRepository} from '../middleware/ServiceSingletons';
import {drainSearchTasks, enableSearchTaskTracking} from '../search/SearchTaskTracker';
import {mapUserToPartialResponse} from '../user/UserMappers';
import {InMemoryCassandraQueryExecutor} from './InMemoryCassandraQueryExecutor';
import {MockKVProvider} from './mocks/MockKVProvider';
import {MockSnowflakeService} from './mocks/MockSnowflakeService';
import {NoopLogger} from './mocks/NoopLogger';
import {RepositoryBackedMessageResponseDataService} from './mocks/RepositoryBackedMessageResponseDataService';
import {fakeNcmecServer} from './msw/handlers/NcmecHandlers';
import {server} from './msw/server';

function defaultNatsUrl(): string {
	return `nats://${existsSync('/.dockerenv') ? 'nats' : '127.0.0.1'}:4222`;
}

function setDefaultTestEnv(): void {
	// API tests use a non-self-hosted baseline; self-hosted scenarios override the loaded config explicitly.
	process.env.AETHERNET_SELF_HOSTED = 'false';

	const natsUrl = defaultNatsUrl();
	const defaults: Record<string, string> = {
		AETHERNET_ENV: 'test',
		AETHERNET_BASE_DOMAIN: 'localhost',
		AETHERNET_PUBLIC_SCHEME: 'http',
		AETHERNET_PUBLIC_PORT: '8088',
		AETHERNET_TRUST_CLIENT_IP_HEADER: 'true',
		AETHERNET_CLIENT_IP_HEADER_NAME: 'x-forwarded-for',
		AETHERNET_CASSANDRA_HOSTS: '127.0.0.1',
		AETHERNET_CASSANDRA_PORT: '9042',
		AETHERNET_CASSANDRA_KEYSPACE: 'aethernet_test',
		AETHERNET_CASSANDRA_LOCAL_DC: 'datacenter1',
		AETHERNET_CASSANDRA_USERNAME: 'cassandra',
		AETHERNET_CASSANDRA_PASSWORD: 'cassandra',
		AETHERNET_KV_URL: 'redis://127.0.0.1:6379/0',
		AETHERNET_NATS_URL: natsUrl,
		AETHERNET_NATS_CORE_URL: natsUrl,
		AETHERNET_NATS_JETSTREAM_URL: natsUrl,
		AETHERNET_INTERNAL_API_ENDPOINT: 'http://127.0.0.1:8088/api',
		AETHERNET_INTERNAL_GATEWAY_ENDPOINT: 'http://127.0.0.1:8088/gateway',
		AETHERNET_INTERNAL_MEDIA_PROXY_ENDPOINT: 'http://127.0.0.1:8088/media',
		AETHERNET_S3_ENDPOINT: 'http://127.0.0.1:3900',
		AETHERNET_S3_REGION: 'local',
		AETHERNET_S3_ACCESS_KEY_ID: 'test',
		AETHERNET_S3_SECRET_ACCESS_KEY: 'test',
		AETHERNET_API_PRESIGNED_ATTACHMENT_UPLOADS_ENABLED: 'false',
		AETHERNET_MEDIA_PROXY_SECRET_KEY: 'test-media-secret',
		AETHERNET_ADMIN_SECRET_KEY_BASE: 'test-admin-secret',
		AETHERNET_ADMIN_OAUTH_CLIENT_SECRET: 'test-admin-oauth-secret',
		AETHERNET_APP_PROXY_PORT: '8773',
		AETHERNET_GATEWAY_MEDIA_PROXY_ENDPOINT: 'http://127.0.0.1:8088/media',
		AETHERNET_GATEWAY_RPC_AUTH_TOKEN: 'test-gateway-rpc-token',
		AETHERNET_SUDO_MODE_SECRET: 'test-sudo-secret',
		AETHERNET_CONNECTION_INITIATION_SECRET: 'test-connection-secret',
		AETHERNET_VAPID_PUBLIC_KEY:
			'BB76bTFIuoqmxJtTfZX0yGTn1f_qu9H03B_nkj8OyExJFkN7Y-HBZZzShnHZoEhXKc5ZRy3jFu7OkBbnaQG-4aw',
		AETHERNET_VAPID_PRIVATE_KEY: 'Xgi-3P8J-I3Q6U1HlCcXMuc_tKLGAM9nIfznX3Hz68o',
		AETHERNET_VAPID_EMAIL: 'test@example.com',
		AETHERNET_PASSKEY_RP_NAME: 'Aethernet Test',
		AETHERNET_PASSKEY_RP_ID: 'localhost',
		AETHERNET_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: 'http://localhost',
		AETHERNET_EMAIL_ENABLED: 'true',
		AETHERNET_EMAIL_PROVIDER: 'smtp',
		AETHERNET_EMAIL_FROM_EMAIL: 'noreply@example.com',
		AETHERNET_EMAIL_SMTP_HOST: 'localhost',
		AETHERNET_EMAIL_SMTP_PORT: '1025',
		AETHERNET_EMAIL_SMTP_USERNAME: 'test',
		AETHERNET_EMAIL_SMTP_PASSWORD: 'test',
		AETHERNET_EMAIL_SMTP_SECURE: 'false',
		AETHERNET_LIVEKIT_ENABLED: 'false',
		AETHERNET_STRIPE_ENABLED: 'true',
		AETHERNET_SEARCH_ENGINE: 'elasticsearch',
		AETHERNET_SEARCH_URL: 'http://127.0.0.1:9200',
		AETHERNET_SEARCH_API_KEY: 'test',
		AETHERNET_CAPTCHA_ENABLED: 'false',
		AETHERNET_CAPTCHA_PROVIDER: 'none',
		AETHERNET_DISCOVERY_ENABLED: 'true',
		AETHERNET_RELAX_REGISTRATION_RATE_LIMITS: 'true',
		AETHERNET_DISABLE_RATE_LIMITS: 'true',
		AETHERNET_TEST_MODE_ENABLED: 'true',
	};
	for (const [key, value] of Object.entries(defaults)) {
		process.env[key] ??= value;
	}
}

class RepositoryBackedUsersServiceClient implements IUsersServiceClient {
	async getUserPartialResponses(userIds: Array<UserID>): Promise<Map<UserID, UserPartialResponse>> {
		const userRepository = getUserRepository();
		const result = new Map<UserID, UserPartialResponse>();
		for (const userId of userIds) {
			const user = await userRepository.findUnique(userId);
			if (user) {
				result.set(userId, mapUserToPartialResponse(user));
			}
		}
		return result;
	}

	async invalidateUserCache(_userId: UserID): Promise<void> {}
}

setDefaultTestEnv();
process.env.AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 ??= 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';

const master = await loadConfig();
const apiConfig = buildAPIConfigFromMaster(master);
const testApiConfig = {
	...apiConfig,
	auth: {
		...apiConfig.auth,
		passkeys: {
			...apiConfig.auth.passkeys,
			rpId: 'localhost',
			allowedOrigins: ['http://localhost'],
		},
	},
	voice: {
		...apiConfig.voice,
		enabled: false,
	},
	stripe: {
		...apiConfig.stripe,
		enabled: true,
		secretKey: 'sk_test_aethernet',
		webhookSecret: 'whsec_test_aethernet',
	},
	ncmec: {
		...apiConfig.ncmec,
		enabled: true,
		baseUrl: fakeNcmecServer.baseUrl,
		username: 'usr123',
		password: 'pswd123',
	},
};
testApiConfig.dev.relaxRegistrationRateLimits = true;
testApiConfig.dev.disableRateLimits = true;
testApiConfig.dev.testModeEnabled = true;

initializeConfig(testApiConfig);

const bootstrapLogger = new NoopLogger();

initializeLogger(bootstrapLogger);

setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());

setInjectedKVProvider(new MockKVProvider());
setInjectedSnowflakeService(new MockSnowflakeService({startTimestampMs: Date.now()}));
setInjectedUsersServiceClient(new RepositoryBackedUsersServiceClient());
setInjectedMessageResponseDataService(new RepositoryBackedMessageResponseDataService());

enableSearchTaskTracking();

export {fakeNcmecServer};

beforeAll(async () => {
	server.listen({
		onUnhandledRequest: 'error',
	});
});

afterEach(async () => {
	await drainSearchTasks();
	resetCassandraQueryExecutorForTesting();
	getInstanceConfigRepository().clearCacheForTesting();
	server.resetHandlers();
	fakeNcmecServer.reset();
});

afterAll(async () => {
	server.close();
	await shutdownCassandraQueryExecutorForTesting();
});
