// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {BadRequestError} from '@aethernet/errors/src/domains/core/BadRequestError';

export class UnknownSuspiciousFlagError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.UNKNOWN_SUSPICIOUS_FLAG});
	}
}
