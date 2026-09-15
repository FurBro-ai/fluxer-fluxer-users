// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {BadRequestError} from '@aethernet/errors/src/domains/core/BadRequestError';

export class MaxGuildRolesError extends BadRequestError {
	constructor(limit: number) {
		super({
			code: APIErrorCodes.MAX_GUILD_ROLES,
			messageVariables: {count: limit},
			data: {
				max_guild_roles: limit,
			},
		});
	}
}
