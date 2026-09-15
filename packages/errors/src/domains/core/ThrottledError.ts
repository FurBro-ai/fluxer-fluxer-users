// SPDX-License-Identifier: AGPL-3.0-or-later

import {AethernetError, type AethernetErrorData} from '@aethernet/errors/src/AethernetError';
import {sanitizeRetryAfterSeconds} from '@aethernet/errors/src/domains/core/RetryAfterSeconds';

export class ThrottledError extends AethernetError {
	constructor({
		code,
		message,
		retryAfterSeconds,
		data,
		headers,
		messageVariables,
	}: {
		code: string;
		message?: string;
		retryAfterSeconds: number;
		data?: AethernetErrorData;
		headers?: Record<string, string>;
		messageVariables?: Record<string, unknown>;
	}) {
		super({
			code,
			message,
			status: 429,
			data,
			headers: {...headers, 'Retry-After': sanitizeRetryAfterSeconds(retryAfterSeconds).toString()},
			messageVariables,
		});
	}
}
