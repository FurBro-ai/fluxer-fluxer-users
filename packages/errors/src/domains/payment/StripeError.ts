// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {AethernetError} from '@aethernet/errors/src/AethernetError';

export class StripeError extends AethernetError {
	constructor(detail?: string) {
		super({
			code: APIErrorCodes.STRIPE_ERROR,
			status: 400,
			data: detail ? {detail} : undefined,
			messageVariables: detail ? {detail} : undefined,
		});
	}
}
