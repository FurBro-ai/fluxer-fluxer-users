// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {AethernetError} from '@aethernet/errors/src/AethernetError';

export class StripeGiftRedemptionInProgressError extends AethernetError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_GIFT_REDEMPTION_IN_PROGRESS,
			status: 400,
		});
	}
}
