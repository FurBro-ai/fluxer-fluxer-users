// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@aethernet/constants/src/ApiErrorCodes';
import {BadRequestError} from '@aethernet/errors/src/domains/core/BadRequestError';

export class PreviewMustBeJpegError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.PREVIEW_MUST_BE_JPEG});
	}
}
