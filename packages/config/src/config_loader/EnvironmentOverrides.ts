// SPDX-License-Identifier: AGPL-3.0-or-later

import {type ConfigObject, isConfigObject} from '@aethernet/config/src/config_loader/ConfigObject';

type ConfigPathKey = string | number;
type ConfigContainer = ConfigObject | Array<unknown>;

type EnvValueParser = (raw: string) => unknown;

interface NamedEnvOverride {
	path: Array<ConfigPathKey>;
	parse?: EnvValueParser;
}

const NAMED_AETHERNET_ENV_OVERRIDES: Record<string, NamedEnvOverride> = {
	AETHERNET_ENV: {path: ['env']},
	AETHERNET_BASE_DOMAIN: {path: ['domain', 'base_domain']},
	AETHERNET_PUBLIC_ORIGIN: {path: ['domain', 'public_origin']},
	AETHERNET_PUBLIC_SCHEME: {path: ['domain', 'public_scheme']},
	AETHERNET_INTERNAL_SCHEME: {path: ['domain', 'internal_scheme']},
	AETHERNET_PUBLIC_PORT: {path: ['domain', 'public_port'], parse: parseInteger},
	AETHERNET_STATIC_CDN_DOMAIN: {path: ['domain', 'static_cdn_domain']},
	AETHERNET_INVITE_DOMAIN: {path: ['domain', 'invite_domain']},
	AETHERNET_GIFT_DOMAIN: {path: ['domain', 'gift_domain']},
	AETHERNET_API_ENDPOINT: {path: ['endpoint_overrides', 'api']},
	AETHERNET_API_CLIENT_ENDPOINT: {path: ['endpoint_overrides', 'api_client']},
	AETHERNET_APP_ENDPOINT: {path: ['endpoint_overrides', 'app']},
	AETHERNET_GATEWAY_ENDPOINT: {path: ['endpoint_overrides', 'gateway']},
	AETHERNET_MEDIA_ENDPOINT: {path: ['endpoint_overrides', 'media']},
	AETHERNET_STATIC_CDN_ENDPOINT: {path: ['endpoint_overrides', 'static_cdn']},
	AETHERNET_ADMIN_ENDPOINT: {path: ['endpoint_overrides', 'admin']},
	AETHERNET_DOCS_ENDPOINT: {path: ['endpoint_overrides', 'docs']},
	AETHERNET_MARKETING_ENDPOINT: {path: ['endpoint_overrides', 'marketing']},
	AETHERNET_INVITE_ENDPOINT: {path: ['endpoint_overrides', 'invite']},
	AETHERNET_GIFT_ENDPOINT: {path: ['endpoint_overrides', 'gift']},
	AETHERNET_TRUST_CLIENT_IP_HEADER: {path: ['proxy', 'trust_client_ip_header'], parse: parseBoolean},
	AETHERNET_CLIENT_IP_HEADER_NAME: {path: ['proxy', 'client_ip_header']},
	AETHERNET_CASSANDRA_HOSTS: {path: ['database', 'cassandra', 'hosts'], parse: parseCsv},
	AETHERNET_CASSANDRA_PORT: {path: ['database', 'cassandra', 'port'], parse: parseInteger},
	AETHERNET_CASSANDRA_KEYSPACE: {path: ['database', 'cassandra', 'keyspace']},
	AETHERNET_CASSANDRA_LOCAL_DC: {path: ['database', 'cassandra', 'local_dc']},
	AETHERNET_CASSANDRA_USERNAME: {path: ['database', 'cassandra', 'username']},
	AETHERNET_CASSANDRA_PASSWORD: {path: ['database', 'cassandra', 'password']},
	AETHERNET_POSTGRES_URL: {path: ['database', 'postgres', 'url']},
	AETHERNET_POSTGRES_HOST: {path: ['database', 'postgres', 'host']},
	AETHERNET_POSTGRES_PORT: {path: ['database', 'postgres', 'port'], parse: parseInteger},
	AETHERNET_POSTGRES_DATABASE: {path: ['database', 'postgres', 'database']},
	AETHERNET_POSTGRES_USERNAME: {path: ['database', 'postgres', 'username']},
	AETHERNET_POSTGRES_PASSWORD: {path: ['database', 'postgres', 'password']},
	AETHERNET_POSTGRES_SSL: {path: ['database', 'postgres', 'ssl'], parse: parseBoolean},
	AETHERNET_POSTGRES_SSL_CA: {path: ['database', 'postgres', 'ssl_ca']},
	AETHERNET_POSTGRES_MAX_CONNECTIONS: {path: ['database', 'postgres', 'max_connections'], parse: parseInteger},
	AETHERNET_POSTGRES_KV_TABLE: {path: ['database', 'postgres', 'kv_table']},
	AETHERNET_POSTGRES_PREPARED_STATEMENTS: {path: ['database', 'postgres', 'prepared_statements'], parse: parseBoolean},
	AETHERNET_DATABASE_BACKEND: {path: ['database', 'backend']},
	AETHERNET_KV_URL: {path: ['internal', 'kv']},
	AETHERNET_KV_PROVIDER: {path: ['internal', 'kv_provider']},
	AETHERNET_KV_MODE: {path: ['internal', 'kv_mode']},
	AETHERNET_INTERNAL_API_ENDPOINT: {path: ['internal', 'api']},
	AETHERNET_INTERNAL_GATEWAY_ENDPOINT: {path: ['internal', 'gateway']},
	AETHERNET_INTERNAL_MEDIA_PROXY_ENDPOINT: {path: ['internal', 'media_proxy']},
	AETHERNET_S3_ENDPOINT: {path: ['s3', 'endpoint']},
	AETHERNET_S3_PUBLIC_ENDPOINT: {path: ['s3', 'presigned_url_base']},
	AETHERNET_S3_FORCE_PATH_STYLE: {path: ['s3', 'force_path_style'], parse: parseBoolean},
	AETHERNET_S3_REGION: {path: ['s3', 'region']},
	AETHERNET_S3_ACCESS_KEY_ID: {path: ['s3', 'access_key_id']},
	AETHERNET_S3_SECRET_ACCESS_KEY: {path: ['s3', 'secret_access_key']},
	AETHERNET_S3_BUCKET_CDN: {path: ['s3', 'buckets', 'cdn']},
	AETHERNET_S3_BUCKET_UPLOADS: {path: ['s3', 'buckets', 'uploads']},
	AETHERNET_S3_BUCKET_DOWNLOADS: {path: ['s3', 'buckets', 'downloads']},
	AETHERNET_S3_BUCKET_REPORTS: {path: ['s3', 'buckets', 'reports']},
	AETHERNET_S3_BUCKET_HARVESTS: {path: ['s3', 'buckets', 'harvests']},
	AETHERNET_S3_DOWNLOADS_ENDPOINT: {path: ['s3_downloads', 'endpoint']},
	AETHERNET_S3_DOWNLOADS_PUBLIC_ENDPOINT: {path: ['s3_downloads', 'presigned_url_base']},
	AETHERNET_S3_DOWNLOADS_FORCE_PATH_STYLE: {path: ['s3_downloads', 'force_path_style'], parse: parseBoolean},
	AETHERNET_S3_DOWNLOADS_REGION: {path: ['s3_downloads', 'region']},
	AETHERNET_S3_DOWNLOADS_ACCESS_KEY_ID: {path: ['s3_downloads', 'access_key_id']},
	AETHERNET_S3_DOWNLOADS_SECRET_ACCESS_KEY: {path: ['s3_downloads', 'secret_access_key']},
	AETHERNET_NATS_URL: {path: ['services', 'nats', 'core_url']},
	AETHERNET_NATS_JETSTREAM_URL: {path: ['services', 'nats', 'jetstream_url']},
	AETHERNET_NATS_AUTH_TOKEN: {path: ['services', 'nats', 'auth_token']},
	AETHERNET_API_PORT: {path: ['services', 'api', 'port'], parse: parseInteger},
	AETHERNET_API_HEADERS_TIMEOUT_MS: {path: ['services', 'api', 'headers_timeout_ms'], parse: parseInteger},
	AETHERNET_API_REQUEST_TIMEOUT_MS: {path: ['services', 'api', 'request_timeout_ms'], parse: parseInteger},
	AETHERNET_API_MAX_INFLIGHT_REQUESTS: {path: ['services', 'api', 'max_inflight_requests'], parse: parseInteger},
	AETHERNET_API_IP_BAN_EXEMPT_IPS: {path: ['services', 'api', 'ip_ban_exempt_ips'], parse: parseCsv},
	AETHERNET_API_DESKTOP_GITHUB_REDIRECT_COUNTRIES: {
		path: ['services', 'api', 'desktop_github_redirect_countries'],
		parse: parseCsv,
	},
	AETHERNET_API_PRESIGNED_ATTACHMENT_UPLOADS_ENABLED: {
		path: ['services', 'api', 'presigned_attachment_uploads_enabled'],
		parse: parseBoolean,
	},
	AETHERNET_API_PRESIGNED_DOWNLOADS_ENABLED: {
		path: ['services', 'api', 'presigned_downloads_enabled'],
		parse: parseBoolean,
	},
	AETHERNET_API_PRESIGNED_HARVEST_DOWNLOADS_ENABLED: {
		path: ['services', 'api', 'presigned_harvest_downloads_enabled'],
		parse: parseBoolean,
	},
	AETHERNET_API_WORKER_MODE: {path: ['services', 'api', 'worker', 'mode']},
	AETHERNET_API_WORKER_LANE: {path: ['services', 'api', 'worker', 'lane']},
	AETHERNET_API_WORKER_TASK: {path: ['services', 'api', 'worker', 'task']},
	AETHERNET_API_WORKER_ENABLE_CRON_SCHEDULER: {
		path: ['services', 'api', 'worker', 'enable_cron_scheduler'],
		parse: parseBoolean,
	},
	AETHERNET_API_WORKER_LANE_CONCURRENCY_OVERRIDES: {
		path: ['services', 'api', 'worker', 'lane_concurrency_overrides'],
		parse: parseJsonObject,
	},
	AETHERNET_API_UNFURL_IGNORED_HOSTS: {path: ['services', 'api', 'unfurl_ignored_hosts'], parse: parseCsv},
	AETHERNET_API_EMBEDS_OEMBED_HTML_ENABLED: {
		path: ['services', 'api', 'embeds', 'oembed_html_enabled'],
		parse: parseBoolean,
	},
	AETHERNET_API_EMBEDS_OEMBED_HTML_ALLOW_UNTRUSTED_ON_SELF_HOSTED: {
		path: ['services', 'api', 'embeds', 'oembed_html_allow_untrusted_on_self_hosted'],
		parse: parseBoolean,
	},
	AETHERNET_API_EMBEDS_OEMBED_HTML_ALLOWED_HOSTS: {
		path: ['services', 'api', 'embeds', 'oembed_html_allowed_hosts'],
		parse: parseCsv,
	},
	AETHERNET_API_EMBEDS_CACHE_DEFAULT_TTL_SECONDS: {
		path: ['services', 'api', 'embeds', 'cache_default_ttl_seconds'],
		parse: parseInteger,
	},
	AETHERNET_API_EMBEDS_CACHE_MAX_TTL_SECONDS: {
		path: ['services', 'api', 'embeds', 'cache_max_ttl_seconds'],
		parse: parseInteger,
	},
	AETHERNET_API_EMBEDS_CACHE_MIN_TTL_SECONDS: {
		path: ['services', 'api', 'embeds', 'cache_min_ttl_seconds'],
		parse: parseInteger,
	},
	AETHERNET_API_EMBEDS_CACHE_RESPECT_REMOTE_TTL: {
		path: ['services', 'api', 'embeds', 'cache_respect_remote_ttl'],
		parse: parseBoolean,
	},
	AETHERNET_API_CONTENT_MODERATION_NSFW_THRESHOLD: {
		path: ['services', 'api', 'content_moderation', 'nsfw_threshold'],
		parse: parseEnvValue,
	},
	AETHERNET_MEDIA_PROXY_HOST: {path: ['services', 'media_proxy', 'host']},
	AETHERNET_MEDIA_PROXY_PORT: {path: ['services', 'media_proxy', 'port'], parse: parseInteger},
	AETHERNET_MEDIA_PROXY_SECRET_KEY: {path: ['services', 'media_proxy', 'secret_key']},
	AETHERNET_MEDIA_PROXY_MODE: {path: ['services', 'media_proxy', 'mode']},
	AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_ENDPOINT: {path: ['services', 'media_proxy', 'upload_relay', 'endpoint']},
	AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: {
		path: ['services', 'media_proxy', 'upload_relay', 'secret_base64'],
	},
	AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_MAX_BODY_BYTES: {
		path: ['services', 'media_proxy', 'upload_relay', 'max_body_bytes'],
		parse: parseInteger,
	},
	AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_TOKEN_TTL_SECS: {
		path: ['services', 'media_proxy', 'upload_relay', 'token_ttl_secs'],
		parse: parseInteger,
	},
	AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_KEEP_DIRECT_COUNTRIES: {
		path: ['services', 'media_proxy', 'upload_relay', 'keep_direct_countries'],
		parse: parseCsv,
	},
	AETHERNET_ADMIN_PORT: {path: ['services', 'admin', 'port'], parse: parseInteger},
	AETHERNET_ADMIN_BASE_PATH: {path: ['services', 'admin', 'base_path']},
	AETHERNET_ADMIN_SECRET_KEY_BASE: {path: ['services', 'admin', 'secret_key_base']},
	AETHERNET_ADMIN_OAUTH_CLIENT_SECRET: {path: ['services', 'admin', 'oauth_client_secret']},
	AETHERNET_APP_PROXY_PORT: {path: ['services', 'app_proxy', 'port'], parse: parseInteger},
	AETHERNET_STATIC_DIR: {path: ['services', 'app_proxy', 'assets_dir']},
	AETHERNET_GATEWAY_PORT: {path: ['services', 'gateway', 'port'], parse: parseInteger},
	AETHERNET_GATEWAY_ROLE: {path: ['services', 'gateway', 'gateway_role']},
	AETHERNET_GATEWAY_MEDIA_PROXY_ENDPOINT: {path: ['services', 'gateway', 'media_proxy_endpoint']},
	AETHERNET_GATEWAY_API_RPC_ENDPOINT: {path: ['services', 'gateway', 'api_rpc_endpoint']},
	AETHERNET_GATEWAY_RPC_AUTH_TOKEN: {path: ['services', 'gateway', 'rpc_auth_token']},
	AETHERNET_GATEWAY_LOGGER_LEVEL: {path: ['services', 'gateway', 'logger_level']},
	AETHERNET_GATEWAY_HTTP_FAILURE_THRESHOLD: {
		path: ['services', 'gateway', 'gateway_http_failure_threshold'],
		parse: parseInteger,
	},
	AETHERNET_GATEWAY_HTTP_RECOVERY_TIMEOUT_MS: {
		path: ['services', 'gateway', 'gateway_http_recovery_timeout_ms'],
		parse: parseInteger,
	},
	AETHERNET_GATEWAY_HTTP_RPC_MAX_CONCURRENCY: {
		path: ['services', 'gateway', 'gateway_http_rpc_max_concurrency'],
		parse: parseInteger,
	},
	AETHERNET_GATEWAY_NATS_RPC_MAX_HANDLERS: {
		path: ['services', 'gateway', 'gateway_nats_rpc_max_handlers'],
		parse: parseInteger,
	},
	AETHERNET_GATEWAY_SHUTDOWN_DRAIN_WAIT_MS: {
		path: ['services', 'gateway', 'shutdown_drain_wait_ms'],
		parse: parseInteger,
	},
	AETHERNET_GATEWAY_CLUSTER_ENABLED: {path: ['services', 'gateway', 'cluster_enabled'], parse: parseEnvValue},
	AETHERNET_GATEWAY_CLUSTER_DISCOVERY_DNS_NAME: {path: ['services', 'gateway', 'cluster_discovery_dns_name']},
	AETHERNET_GATEWAY_CLUSTER_DISCOVERY_NODE_BASENAME: {
		path: ['services', 'gateway', 'cluster_discovery_node_basename'],
	},
	AETHERNET_GATEWAY_CLUSTER_DISCOVERY_POLL_INTERVAL_MS: {
		path: ['services', 'gateway', 'cluster_discovery_poll_interval_ms'],
		parse: parseInteger,
	},
	AETHERNET_SUDO_MODE_SECRET: {path: ['auth', 'sudo_mode_secret']},
	AETHERNET_CONNECTION_INITIATION_SECRET: {path: ['auth', 'connection_initiation_secret']},
	AETHERNET_SSO_ALLOW_PRIVATE_ADDRESSES: {path: ['auth', 'sso_allow_private_addresses'], parse: parseBoolean},
	AETHERNET_VAPID_PUBLIC_KEY: {path: ['auth', 'vapid', 'public_key']},
	AETHERNET_VAPID_PRIVATE_KEY: {path: ['auth', 'vapid', 'private_key']},
	AETHERNET_VAPID_EMAIL: {path: ['auth', 'vapid', 'email']},
	AETHERNET_PASSKEY_RP_NAME: {path: ['auth', 'passkeys', 'rp_name']},
	AETHERNET_PASSKEY_RP_ID: {path: ['auth', 'passkeys', 'rp_id']},
	AETHERNET_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: {
		path: ['auth', 'passkeys', 'additional_allowed_origins'],
		parse: parsePasskeyOrigins,
	},
	AETHERNET_AUTH_BLUESKY_ENABLED: {path: ['auth', 'bluesky', 'enabled'], parse: parseBoolean},
	AETHERNET_AUTH_BLUESKY_CLIENT_NAME: {path: ['auth', 'bluesky', 'client_name']},
	AETHERNET_AUTH_BLUESKY_CLIENT_URI: {path: ['auth', 'bluesky', 'client_uri']},
	AETHERNET_AUTH_BLUESKY_LOGO_URI: {path: ['auth', 'bluesky', 'logo_uri']},
	AETHERNET_AUTH_BLUESKY_TOS_URI: {path: ['auth', 'bluesky', 'tos_uri']},
	AETHERNET_AUTH_BLUESKY_POLICY_URI: {path: ['auth', 'bluesky', 'policy_uri']},
	AETHERNET_AUTH_BLUESKY_KEYS: {path: ['auth', 'bluesky', 'keys'], parse: parseJsonArray},
	AETHERNET_EMAIL_ENABLED: {path: ['integrations', 'email', 'enabled'], parse: parseBoolean},
	AETHERNET_EMAIL_PROVIDER: {path: ['integrations', 'email', 'provider']},
	AETHERNET_EMAIL_FROM_EMAIL: {path: ['integrations', 'email', 'from_email']},
	AETHERNET_EMAIL_FROM_NAME: {path: ['integrations', 'email', 'from_name']},
	AETHERNET_EMAIL_APP_BASE_URL: {path: ['integrations', 'email', 'app_base_url']},
	AETHERNET_EMAIL_WEBHOOK_SECRET: {path: ['integrations', 'email', 'webhook_secret']},
	AETHERNET_EMAIL_SMTP_HOST: {path: ['integrations', 'email', 'smtp', 'host']},
	AETHERNET_EMAIL_SMTP_PORT: {path: ['integrations', 'email', 'smtp', 'port'], parse: parseInteger},
	AETHERNET_EMAIL_SMTP_USERNAME: {path: ['integrations', 'email', 'smtp', 'username']},
	AETHERNET_EMAIL_SMTP_PASSWORD: {path: ['integrations', 'email', 'smtp', 'password']},
	AETHERNET_EMAIL_SMTP_SECURE: {path: ['integrations', 'email', 'smtp', 'secure'], parse: parseBoolean},
	AETHERNET_SMS_ENABLED: {path: ['integrations', 'sms', 'enabled'], parse: parseBoolean},
	AETHERNET_SMS_ACCOUNT_SID: {path: ['integrations', 'sms', 'account_sid']},
	AETHERNET_SMS_AUTH_TOKEN: {path: ['integrations', 'sms', 'auth_token']},
	AETHERNET_SMS_VERIFY_SERVICE_SID: {path: ['integrations', 'sms', 'verify_service_sid']},
	AETHERNET_SMS_INBOUND_CHALLENGE_NUMBER: {path: ['integrations', 'sms', 'inbound_challenge_number']},
	AETHERNET_SMS_INBOUND_WEBHOOK_AUTH_TOKEN: {path: ['integrations', 'sms', 'inbound_webhook_auth_token']},
	AETHERNET_SMS_INBOUND_WEBHOOK_PUBLIC_URL: {path: ['integrations', 'sms', 'inbound_webhook_public_url']},
	AETHERNET_CAPTCHA_ENABLED: {path: ['integrations', 'captcha', 'enabled'], parse: parseBoolean},
	AETHERNET_CAPTCHA_PROVIDER: {path: ['integrations', 'captcha', 'provider']},
	AETHERNET_CAPTCHA_HCAPTCHA_SITE_KEY: {path: ['integrations', 'captcha', 'hcaptcha', 'site_key']},
	AETHERNET_CAPTCHA_HCAPTCHA_SECRET_KEY: {path: ['integrations', 'captcha', 'hcaptcha', 'secret_key']},
	AETHERNET_CAPTCHA_TURNSTILE_SITE_KEY: {path: ['integrations', 'captcha', 'turnstile', 'site_key']},
	AETHERNET_CAPTCHA_TURNSTILE_SECRET_KEY: {path: ['integrations', 'captcha', 'turnstile', 'secret_key']},
	AETHERNET_LIVEKIT_ENABLED: {path: ['integrations', 'voice', 'enabled'], parse: parseBoolean},
	AETHERNET_LIVEKIT_API_KEY: {path: ['integrations', 'voice', 'api_key']},
	AETHERNET_LIVEKIT_API_SECRET: {path: ['integrations', 'voice', 'api_secret']},
	AETHERNET_LIVEKIT_URL: {path: ['integrations', 'voice', 'url']},
	AETHERNET_LIVEKIT_INTERNAL_URL: {path: ['integrations', 'voice', 'internal_url']},
	AETHERNET_LIVEKIT_WEBHOOK_URL: {path: ['integrations', 'voice', 'webhook_url']},
	AETHERNET_LIVEKIT_DEFAULT_REGION: {path: ['integrations', 'voice', 'default_region'], parse: parseJsonObject},
	AETHERNET_SEARCH_ENGINE: {path: ['integrations', 'search', 'engine']},
	AETHERNET_SEARCH_URL: {path: ['integrations', 'search', 'url']},
	AETHERNET_SEARCH_API_KEY: {path: ['integrations', 'search', 'api_key']},
	AETHERNET_SEARCH_USERNAME: {path: ['integrations', 'search', 'username']},
	AETHERNET_SEARCH_PASSWORD: {path: ['integrations', 'search', 'password']},
	AETHERNET_SEARCH_TLS_REJECT_UNAUTHORIZED: {
		path: ['integrations', 'search', 'tls_reject_unauthorized'],
		parse: parseBoolean,
	},
	AETHERNET_STRIPE_ENABLED: {path: ['integrations', 'stripe', 'enabled'], parse: parseBoolean},
	AETHERNET_STRIPE_SECRET_KEY: {path: ['integrations', 'stripe', 'secret_key']},
	AETHERNET_STRIPE_WEBHOOK_SECRET: {path: ['integrations', 'stripe', 'webhook_secret']},
	AETHERNET_STRIPE_PRICES: {path: ['integrations', 'stripe', 'prices'], parse: parseJsonObject},
	AETHERNET_STRIPE_LEGACY_PRICES: {path: ['integrations', 'stripe', 'legacy_prices'], parse: parseJsonObject},
	AETHERNET_STRIPE_PRICE_MONTHLY_USD: {path: ['integrations', 'stripe', 'prices', 'monthly_usd']},
	AETHERNET_STRIPE_PRICE_MONTHLY_EUR: {path: ['integrations', 'stripe', 'prices', 'monthly_eur']},
	AETHERNET_STRIPE_PRICE_MONTHLY_BRL: {path: ['integrations', 'stripe', 'prices', 'monthly_brl']},
	AETHERNET_STRIPE_PRICE_MONTHLY_DKK: {path: ['integrations', 'stripe', 'prices', 'monthly_dkk']},
	AETHERNET_STRIPE_PRICE_MONTHLY_INR: {path: ['integrations', 'stripe', 'prices', 'monthly_inr']},
	AETHERNET_STRIPE_PRICE_MONTHLY_NOK: {path: ['integrations', 'stripe', 'prices', 'monthly_nok']},
	AETHERNET_STRIPE_PRICE_MONTHLY_PLN: {path: ['integrations', 'stripe', 'prices', 'monthly_pln']},
	AETHERNET_STRIPE_PRICE_MONTHLY_SEK: {path: ['integrations', 'stripe', 'prices', 'monthly_sek']},
	AETHERNET_STRIPE_PRICE_MONTHLY_TRY: {path: ['integrations', 'stripe', 'prices', 'monthly_try']},
	AETHERNET_STRIPE_PRICE_YEARLY_USD: {path: ['integrations', 'stripe', 'prices', 'yearly_usd']},
	AETHERNET_STRIPE_PRICE_YEARLY_EUR: {path: ['integrations', 'stripe', 'prices', 'yearly_eur']},
	AETHERNET_STRIPE_PRICE_YEARLY_BRL: {path: ['integrations', 'stripe', 'prices', 'yearly_brl']},
	AETHERNET_STRIPE_PRICE_YEARLY_DKK: {path: ['integrations', 'stripe', 'prices', 'yearly_dkk']},
	AETHERNET_STRIPE_PRICE_YEARLY_INR: {path: ['integrations', 'stripe', 'prices', 'yearly_inr']},
	AETHERNET_STRIPE_PRICE_YEARLY_NOK: {path: ['integrations', 'stripe', 'prices', 'yearly_nok']},
	AETHERNET_STRIPE_PRICE_YEARLY_PLN: {path: ['integrations', 'stripe', 'prices', 'yearly_pln']},
	AETHERNET_STRIPE_PRICE_YEARLY_SEK: {path: ['integrations', 'stripe', 'prices', 'yearly_sek']},
	AETHERNET_STRIPE_PRICE_YEARLY_TRY: {path: ['integrations', 'stripe', 'prices', 'yearly_try']},
	AETHERNET_STRIPE_PRICE_VISIONARY_USD: {path: ['integrations', 'stripe', 'prices', 'visionary_usd']},
	AETHERNET_STRIPE_PRICE_VISIONARY_EUR: {path: ['integrations', 'stripe', 'prices', 'visionary_eur']},
	AETHERNET_STRIPE_PRICE_GIFT_VISIONARY_USD: {path: ['integrations', 'stripe', 'prices', 'gift_visionary_usd']},
	AETHERNET_STRIPE_PRICE_GIFT_VISIONARY_EUR: {path: ['integrations', 'stripe', 'prices', 'gift_visionary_eur']},
	AETHERNET_STRIPE_PRICE_GIFT_1_MONTH_USD: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_usd']},
	AETHERNET_STRIPE_PRICE_GIFT_1_MONTH_EUR: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_eur']},
	AETHERNET_STRIPE_PRICE_GIFT_1_MONTH_SEK: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_sek']},
	AETHERNET_STRIPE_PRICE_GIFT_1_YEAR_SEK: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_sek']},
	AETHERNET_STRIPE_PRICE_GIFT_1_MONTH_DKK: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_dkk']},
	AETHERNET_STRIPE_PRICE_GIFT_1_YEAR_DKK: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_dkk']},
	AETHERNET_STRIPE_PRICE_GIFT_1_MONTH_NOK: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_nok']},
	AETHERNET_STRIPE_PRICE_GIFT_1_YEAR_NOK: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_nok']},
	AETHERNET_STRIPE_PRICE_GIFT_1_MONTH_BRL: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_brl']},
	AETHERNET_STRIPE_PRICE_GIFT_1_MONTH_INR: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_inr']},
	AETHERNET_STRIPE_PRICE_GIFT_1_MONTH_PLN: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_pln']},
	AETHERNET_STRIPE_PRICE_GIFT_1_MONTH_TRY: {path: ['integrations', 'stripe', 'prices', 'gift_1_month_try']},
	AETHERNET_STRIPE_PRICE_GIFT_1_YEAR_USD: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_usd']},
	AETHERNET_STRIPE_PRICE_GIFT_1_YEAR_EUR: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_eur']},
	AETHERNET_STRIPE_PRICE_GIFT_1_YEAR_BRL: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_brl']},
	AETHERNET_STRIPE_PRICE_GIFT_1_YEAR_INR: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_inr']},
	AETHERNET_STRIPE_PRICE_GIFT_1_YEAR_PLN: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_pln']},
	AETHERNET_STRIPE_PRICE_GIFT_1_YEAR_TRY: {path: ['integrations', 'stripe', 'prices', 'gift_1_year_try']},
	AETHERNET_NCMEC_ENABLED: {path: ['integrations', 'ncmec', 'enabled'], parse: parseBoolean},
	AETHERNET_NCMEC_BASE_URL: {path: ['integrations', 'ncmec', 'base_url']},
	AETHERNET_NCMEC_USERNAME: {path: ['integrations', 'ncmec', 'username']},
	AETHERNET_NCMEC_PASSWORD: {path: ['integrations', 'ncmec', 'password']},
	AETHERNET_NCMEC_REPORTER_EMAIL: {path: ['integrations', 'ncmec', 'reporter_email']},
	AETHERNET_CLAMAV_ENABLED: {path: ['integrations', 'clamav', 'enabled'], parse: parseBoolean},
	AETHERNET_CLAMAV_HOST: {path: ['integrations', 'clamav', 'host']},
	AETHERNET_CLAMAV_PORT: {path: ['integrations', 'clamav', 'port'], parse: parseInteger},
	AETHERNET_CLAMAV_FAIL_OPEN: {path: ['integrations', 'clamav', 'fail_open'], parse: parseBoolean},
	AETHERNET_KLIPY_API_KEY: {path: ['integrations', 'klipy', 'api_key']},
	AETHERNET_YOUTUBE_API_KEY: {path: ['integrations', 'youtube', 'api_key']},
	AETHERNET_BUNNY_PURGE_ENABLED: {path: ['integrations', 'bunny', 'purge_enabled'], parse: parseBoolean},
	AETHERNET_BLOCKLIST_FEEDS_ENABLED: {path: ['integrations', 'blocklist_feeds', 'enabled'], parse: parseBoolean},
	AETHERNET_BUNNY_API_KEY: {path: ['integrations', 'bunny', 'api_key']},
	AETHERNET_BUNNY_PULL_ZONE_ID: {path: ['integrations', 'bunny', 'pull_zone_id'], parse: parseInteger},
	AETHERNET_RISK_INTEGRATION_ENABLED: {path: ['integrations', 'risk_integration', 'enabled'], parse: parseBoolean},
	AETHERNET_RISK_IPINFO_API_KEY: {path: ['integrations', 'risk_integration', 'ipinfo_api_key']},
	AETHERNET_ACCOUNT_POLICY_DSL: {
		path: ['integrations', 'risk_integration', 'account_policy_dsl'],
		parse: parseEnvValue,
	},
	AETHERNET_RISK_TOR_BLOCK_ALL_RELAYS: {
		path: ['integrations', 'risk_integration', 'tor', 'block_all_relays'],
		parse: parseBoolean,
	},
	AETHERNET_RISK_TOR_REVERSE_DNS_HEURISTIC: {
		path: ['integrations', 'risk_integration', 'tor', 'reverse_dns_heuristic'],
		parse: parseBoolean,
	},
	AETHERNET_RISK_TOR_REVERSE_DNS_TIMEOUT_MS: {
		path: ['integrations', 'risk_integration', 'tor', 'reverse_dns_timeout_ms'],
		parse: parseInteger,
	},
	AETHERNET_PUSH_APNS_ENABLED: {path: ['integrations', 'push', 'apns', 'enabled'], parse: parseBoolean},
	AETHERNET_PUSH_APNS_TEAM_ID: {path: ['integrations', 'push', 'apns', 'team_id']},
	AETHERNET_PUSH_APNS_KEY_ID: {path: ['integrations', 'push', 'apns', 'key_id']},
	AETHERNET_PUSH_APNS_PRIVATE_KEY: {path: ['integrations', 'push', 'apns', 'private_key']},
	AETHERNET_PUSH_APNS_PRIVATE_KEY_PATH: {path: ['integrations', 'push', 'apns', 'private_key_path']},
	AETHERNET_PUSH_APNS_DEFAULT_ENVIRONMENT: {path: ['integrations', 'push', 'apns', 'default_environment']},
	AETHERNET_PUSH_APNS_APPS: {path: ['integrations', 'push', 'apns', 'apps'], parse: parseJsonArray},
	AETHERNET_PUSH_FCM_ENABLED: {path: ['integrations', 'push', 'fcm', 'enabled'], parse: parseBoolean},
	AETHERNET_PUSH_FCM_PROJECT_ID: {path: ['integrations', 'push', 'fcm', 'project_id']},
	AETHERNET_PUSH_FCM_CLIENT_EMAIL: {path: ['integrations', 'push', 'fcm', 'client_email']},
	AETHERNET_PUSH_FCM_PRIVATE_KEY: {path: ['integrations', 'push', 'fcm', 'private_key']},
	AETHERNET_PUSH_FCM_PRIVATE_KEY_PATH: {path: ['integrations', 'push', 'fcm', 'private_key_path']},
	AETHERNET_PUSH_FCM_SERVICE_ACCOUNT_JSON_PATH: {path: ['integrations', 'push', 'fcm', 'service_account_json_path']},
	AETHERNET_PUSH_FCM_TOKEN_URI: {path: ['integrations', 'push', 'fcm', 'token_uri']},
	AETHERNET_PUSH_FCM_APPS: {path: ['integrations', 'push', 'fcm', 'apps'], parse: parseJsonArray},
	AETHERNET_SELF_HOSTED: {path: ['instance', 'self_hosted'], parse: parseBoolean},
	AETHERNET_AUTO_JOIN_INVITE_CODE: {path: ['instance', 'auto_join_invite_code']},
	AETHERNET_VISIONARIES_GUILD_ID: {path: ['instance', 'visionaries_guild_id']},
	AETHERNET_VISIONARIES_GUILD_VISIONARY_ROLE_ID: {path: ['instance', 'visionaries_guild_visionary_role_id']},
	AETHERNET_APP_PRODUCT_NAME: {path: ['instance', 'branding', 'product_name']},
	AETHERNET_APP_ICON_URL: {path: ['instance', 'branding', 'icon_url']},
	AETHERNET_APP_SYMBOL_URL: {path: ['instance', 'branding', 'symbol_url']},
	AETHERNET_APP_LOGO_URL: {path: ['instance', 'branding', 'logo_url']},
	AETHERNET_APP_WORDMARK_URL: {path: ['instance', 'branding', 'wordmark_url']},
	AETHERNET_APP_FAVICON_URL: {path: ['instance', 'branding', 'favicon_url']},
	AETHERNET_APP_THEME_COLOR: {path: ['instance', 'branding', 'theme_color']},
	AETHERNET_INSTANCE_SETUP_CONFIGURED: {path: ['instance', 'setup', 'configured'], parse: parseBoolean},
	AETHERNET_ABUSE_INBOUND_PHONE_COUNTRY_CODES: {
		path: ['instance', 'abuse_policy', 'inbound_phone_country_codes'],
		parse: parseCsv,
	},
	AETHERNET_ABUSE_PHONE_INBOUND_REQUIRED_PREFIXES: {
		path: ['instance', 'abuse_policy', 'phone_verification', 'inbound_required_prefixes'],
		parse: parseCsv,
	},
	AETHERNET_ABUSE_DIRECT_CONTACT_SPAM_ENABLED: {
		path: ['instance', 'abuse_policy', 'direct_contact_spam', 'enabled'],
		parse: parseBoolean,
	},
	AETHERNET_ABUSE_DIRECT_CONTACT_SPAM_COUNTRY_CODES: {
		path: ['instance', 'abuse_policy', 'direct_contact_spam', 'country_codes'],
		parse: parseCsv,
	},
	AETHERNET_ABUSE_DIRECT_CONTACT_SPAM_DISTINCT_TARGET_THRESHOLD: {
		path: ['instance', 'abuse_policy', 'direct_contact_spam', 'distinct_target_threshold'],
		parse: parseInteger,
	},
	AETHERNET_ABUSE_DIRECT_CONTACT_SPAM_TARGET_WINDOW_MS: {
		path: ['instance', 'abuse_policy', 'direct_contact_spam', 'target_window_ms'],
		parse: parseInteger,
	},
	AETHERNET_ABUSE_DIRECT_CONTACT_SPAM_ACTION: {
		path: ['instance', 'abuse_policy', 'direct_contact_spam', 'action'],
	},
	AETHERNET_DISCOVERY_ENABLED: {path: ['discovery', 'enabled'], parse: parseBoolean},
	AETHERNET_DISCOVERY_MIN_MEMBER_COUNT: {path: ['discovery', 'min_member_count'], parse: parseInteger},
	AETHERNET_DELETION_GRACE_PERIOD_HOURS: {path: ['deletion_grace_period_hours'], parse: parseInteger},
	AETHERNET_RELAX_REGISTRATION_RATE_LIMITS: {path: ['dev', 'relax_registration_rate_limits'], parse: parseBoolean},
	AETHERNET_DISABLE_RATE_LIMITS: {path: ['dev', 'disable_rate_limits'], parse: parseBoolean},
	AETHERNET_TEST_MODE_ENABLED: {path: ['dev', 'test_mode_enabled'], parse: parseBoolean},
	AETHERNET_TEST_HARNESS_TOKEN: {path: ['dev', 'test_harness_token']},
	AETHERNET_VALIDATE_RESPONSES: {path: ['dev', 'validate_responses'], parse: parseBoolean},
	AETHERNET_GEOIP_DB_PATH: {path: ['geoip', 'maxmind_db_path']},
};

function isContainer(value: unknown): value is ConfigContainer {
	return isConfigObject(value) || Array.isArray(value);
}

function createChildContainer(nextKey: ConfigPathKey | undefined): ConfigContainer {
	return typeof nextKey === 'number' ? [] : {};
}

function getChildValue(target: ConfigContainer, key: ConfigPathKey): unknown {
	return Object.hasOwn(target, key) ? Reflect.get(target, key) : undefined;
}

function setChildValue(target: ConfigContainer, key: ConfigPathKey, value: unknown): void {
	if (key === '__proto__') {
		Object.defineProperty(target, key, {value, writable: true, enumerable: true, configurable: true});
		return;
	}
	if (Array.isArray(target) && typeof key === 'number') {
		target[key] = value;
		return;
	}
	(target as ConfigObject)[String(key)] = value;
}

function parseBoolean(raw: string): boolean {
	switch (raw.trim().toLowerCase()) {
		case 'true':
			return true;
		case 'false':
			return false;
		default:
			throw new Error('must be true or false');
	}
}

function parseJson(raw: string): unknown {
	const trimmed = raw.trim();
	if (trimmed.length === 0) return undefined;
	try {
		return JSON.parse(trimmed);
	} catch {
		throw new Error('must be valid JSON');
	}
}

function parseJsonObject(raw: string): ConfigObject | undefined {
	const value = parseJson(raw);
	if (value === undefined || isConfigObject(value)) return value;
	throw new Error('must be a JSON object');
}

function parseJsonArray(raw: string): Array<unknown> | undefined {
	const value = parseJson(raw);
	if (value === undefined || Array.isArray(value)) return value;
	throw new Error('must be a JSON array');
}

export function parseEnvValue(raw: string): unknown {
	const trimmed = raw.trim();
	const lower = trimmed.toLowerCase();
	if (lower === 'true' || lower === 'false') return parseBoolean(trimmed);
	if (/^-?\d+$/.test(trimmed)) {
		return parseInteger(trimmed);
	}
	if (/^-?\d+\.\d+$/.test(trimmed)) {
		const value = Number(trimmed);
		if (!Number.isFinite(value)) throw new Error('must be a finite number');
		return value;
	}
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		return parseJson(trimmed);
	}
	return raw;
}

function parseInteger(raw: string): number | undefined {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return undefined;
	}
	if (!/^-?\d+$/.test(trimmed)) {
		throw new Error(`must be an integer, got ${JSON.stringify(raw)}`);
	}
	const value = Number(trimmed);
	if (!Number.isSafeInteger(value)) throw new Error('must be a safe integer');
	return value;
}

function parseCsv(raw: string): Array<string> {
	return raw
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
}

function parsePasskeyOrigins(raw: string): Array<string> {
	if (/\p{Cc}/u.test(raw)) {
		throw new Error('must not contain control characters');
	}
	return parseCsv(raw);
}

export function setNestedValue(target: ConfigContainer, keys: Array<ConfigPathKey>, value: unknown): void {
	if (keys.length === 0) {
		return;
	}
	const [first, ...rest] = keys;
	if (rest.length === 0) {
		setChildValue(target, first, value);
		return;
	}
	const current = getChildValue(target, first);
	let child: ConfigContainer;
	if (isContainer(current)) {
		child = current;
	} else {
		child = createChildContainer(rest[0]);
		setChildValue(target, first, child);
	}
	setNestedValue(child, rest, value);
}

const NAMED_AETHERNET_ENV_ALIASES: Record<string, string | undefined> = {
	AETHERNET_INTERNAL_MEDIA_PROXY_ENDPOINT: 'AETHERNET_MEDIA_PROXY_ENDPOINT',
	AETHERNET_NATS_URL: 'AETHERNET_NATS_CORE_URL',
};

export function buildNamedAethernetEnvOverrides(env: NodeJS.ProcessEnv): ConfigObject {
	const overrides: ConfigObject = {};
	for (const [envKey, mapping] of Object.entries(NAMED_AETHERNET_ENV_OVERRIDES)) {
		const alias = NAMED_AETHERNET_ENV_ALIASES[envKey];
		const raw = env[envKey] ?? (alias === undefined ? undefined : env[alias]);
		if (raw === undefined) {
			continue;
		}
		let parsed: unknown;
		try {
			parsed = mapping.parse ? mapping.parse(raw) : raw;
		} catch (error) {
			throw new Error(`${envKey} ${error instanceof Error ? error.message : String(error)}`);
		}
		if (parsed === undefined) {
			continue;
		}
		setNestedValue(overrides, mapping.path, parsed);
	}
	return overrides;
}
