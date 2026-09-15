// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {ConflictError} from '@aethernet/errors/src/domains/core/ConflictError';

export class NcmecAlreadySubmittedError extends ConflictError {
	constructor() {
		super({
			code: APIErrorCodes.NCMEC_ALREADY_SUBMITTED,
		});
	}
}
