// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {BadRequestError} from '@aethernet/errors/src/domains/core/BadRequestError';

export class WebAuthnCredentialLimitReachedError extends BadRequestError {
	constructor(count = 10) {
		super({
			code: APIErrorCodes.WEBAUTHN_CREDENTIAL_LIMIT_REACHED,
			messageVariables: {count},
		});
	}
}
