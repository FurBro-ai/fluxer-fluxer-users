// SPDX-License-Identifier: AGPL-3.0-or-later

import type {APIErrorCode} from '@aethernet/constants/src/ApiErrorCodes';
import {AethernetError, type AethernetErrorData} from '@aethernet/errors/src/AethernetError';

export class LockedError extends AethernetError {
	constructor({
		code,
		headers,
		data,
		messageVariables,
	}: {
		code: APIErrorCode;
		data?: AethernetErrorData;
		headers?: Record<string, string>;
		messageVariables?: Record<string, unknown>;
	}) {
		super({code, status: 423, data, headers, messageVariables});
	}
}
