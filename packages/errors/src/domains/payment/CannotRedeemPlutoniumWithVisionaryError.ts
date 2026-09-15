// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {BadRequestError} from '@aethernet/errors/src/domains/core/BadRequestError';

export class CannotRedeemPlutoniumWithVisionaryError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.CANNOT_REDEEM_PLUTONIUM_WITH_VISIONARY,
			messageVariables: {premium_tier_name: 'Plutonium'},
		});
	}
}
