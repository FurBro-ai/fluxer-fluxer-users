// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {AethernetError} from '@aethernet/errors/src/AethernetError';

export class StripeSubscriptionNotCancelingError extends AethernetError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_SUBSCRIPTION_NOT_CANCELING,
			status: 400,
		});
	}
}
