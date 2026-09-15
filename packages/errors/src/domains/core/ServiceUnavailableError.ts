// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {AethernetError, type AethernetErrorData} from '@aethernet/errors/src/AethernetError';

export class ServiceUnavailableError extends AethernetError {
	constructor({
		code = APIErrorCodes.SERVICE_UNAVAILABLE,
		message,
		data,
		headers,
		messageVariables,
	}: {
		code?: string;
		message?: string;
		data?: AethernetErrorData;
		headers?: Record<string, string>;
		messageVariables?: Record<string, unknown>;
	} = {}) {
		super({code, message, status: 503, data, headers, messageVariables});
	}
}
