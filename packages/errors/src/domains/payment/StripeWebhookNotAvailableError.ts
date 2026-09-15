// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {AethernetError} from '@aethernet/errors/src/AethernetError';

export class StripeWebhookNotAvailableError extends AethernetError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_WEBHOOK_NOT_AVAILABLE,
			status: 400,
		});
	}
}
