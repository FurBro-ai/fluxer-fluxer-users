// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {NotFoundError} from '@aethernet/errors/src/domains/core/NotFoundError';

export class UnknownInviteError extends NotFoundError {
	constructor() {
		super({code: APIErrorCodes.UNKNOWN_INVITE});
	}
}
