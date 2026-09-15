// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {AethernetError} from '@aethernet/errors/src/AethernetError';

export class AgeVerificationAlreadyVerifiedError extends AethernetError {
	constructor() {
		super({
			code: APIErrorCodes.AGE_VERIFICATION_ALREADY_VERIFIED,
			status: 400,
		});
	}
}
