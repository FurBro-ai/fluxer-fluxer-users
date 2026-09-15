// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@aethernet/errors/src/domains/core/ForbiddenError';

export class TestHarnessForbiddenError extends ForbiddenError {
	constructor() {
		super({code: APIErrorCodes.TEST_HARNESS_FORBIDDEN});
	}
}
