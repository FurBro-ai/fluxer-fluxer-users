// SPDX-License-Identifier: AGPL-3.0-or-later

import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {getDataFlx, getImageSizingProps} from './BrandImageUtils';

const APPLICATION_ICON_DESCRIPTOR = msg({
	message: '{productName} application icon',
	comment: 'Accessible label for the product application icon. Preserve {productName}; it is inserted by code.',
});
export const AethernetIcon = observer((props: React.SVGProps<SVGSVGElement>) => {
	const {i18n} = useLingui();
	const ariaLabel = i18n._(APPLICATION_ICON_DESCRIPTOR, {productName: RuntimeConfig.productName});
	if (RuntimeConfig.iconUrl) {
		return (
			<img
				{...getImageSizingProps(props)}
				src={RuntimeConfig.iconUrl}
				alt={ariaLabel}
				data-flx={getDataFlx(props, 'ui.icons.aethernet-icon.img')}
			/>
		);
	}
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 512 512"
			role="img"
			aria-label={ariaLabel}
			data-flx="ui.icons.aethernet-icon.img"
			{...props}
		>
			<rect fill="var(--brand-primary)" height={512} rx={256} width={512} data-flx="ui.icons.aethernet-icon.rect" />
			<path
				fill="var(--brand-primary-fill)"
				fillRule="evenodd"
				d="M256 72 424 430h-86l-30-72H204l-30 72H88L256 72Zm0 123-29 94h58l-29-94Z"
				clipRule="evenodd"
				data-flx="ui.icons.aethernet-icon.path"
			/>
		</svg>
	);
});
