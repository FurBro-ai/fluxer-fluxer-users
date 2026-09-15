// SPDX-License-Identifier: AGPL-3.0-or-later

import type {APIErrorCode} from '@aethernet/constants/src/ApiErrorCodes';
import {AethernetError, type AethernetErrorData} from '@aethernet/errors/src/AethernetError';

export class InternalServerError extends AethernetError {
	constructor({
		code,
		data,
		headers,
		messageVariables,
	}: {
		code: APIErrorCode;
		data?: AethernetErrorData;
		headers?: Record<string, string>;
		messageVariables?: Record<string, unknown>;
	}) {
		super({code, status: 500, data, headers, messageVariables});
	}
}
