// SPDX-License-Identifier: AGPL-3.0-or-later

import type {APIErrorCode} from '@aethernet/constants/src/ApiErrorCodes';
import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {AethernetError, type AethernetErrorData} from '@aethernet/errors/src/AethernetError';

export class BadGatewayError extends AethernetError {
	constructor({
		code = APIErrorCodes.BAD_GATEWAY,
		message,
		data,
		headers,
		messageVariables,
	}: {
		code?: APIErrorCode;
		message?: string;
		data?: AethernetErrorData;
		headers?: Record<string, string>;
		messageVariables?: Record<string, unknown>;
	} = {}) {
		super({code, message, status: 502, data, headers, messageVariables});
	}
}
