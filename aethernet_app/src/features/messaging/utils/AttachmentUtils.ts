// SPDX-License-Identifier: AGPL-3.0-or-later

import {ATTACHMENT_MAX_SIZE_NON_PREMIUM} from '@aethernet/constants/src/LimitConstants';
import {LimitResolver} from '@app/features/app/utils/LimitResolverAdapter';

export function getMaxAttachmentFileSize(): number {
	return LimitResolver.resolve({
		key: 'max_attachment_file_size',
		fallback: ATTACHMENT_MAX_SIZE_NON_PREMIUM,
	});
}
