// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {BadRequestError} from '@aethernet/errors/src/domains/core/BadRequestError';

export class MaxGuildChannelsError extends BadRequestError {
	constructor(maxChannels: number) {
		super({
			code: APIErrorCodes.MAX_GUILD_CHANNELS,
			messageVariables: {count: maxChannels},
		});
	}
}
