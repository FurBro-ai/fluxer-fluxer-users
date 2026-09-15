// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@aethernet/errors/src/domains/core/ForbiddenError';

export class GuildPhoneVerificationRequiredError extends ForbiddenError {
	constructor() {
		super({
			code: APIErrorCodes.GUILD_PHONE_VERIFICATION_REQUIRED,
		});
	}
}
