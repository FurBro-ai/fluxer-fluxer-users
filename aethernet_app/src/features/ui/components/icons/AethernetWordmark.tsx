// SPDX-License-Identifier: AGPL-3.0-or-later

import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {type BrandSvgProps, getDataFlx, getImageSizingProps} from './BrandImageUtils';

const APPLICATION_WORDMARK_DESCRIPTOR = msg({
	message: '{productName} wordmark',
	comment: 'Accessible label for the application wordmark.',
});

interface AethernetWordmarkProps extends BrandSvgProps {
	variant?: 'default' | 'monochrome';
}

export const AethernetWordmark = observer(({variant = 'default', ...props}: AethernetWordmarkProps) => {
	const {i18n} = useLingui();
	const productName = RuntimeConfig.productName;
	const ariaLabel = i18n._(APPLICATION_WORDMARK_DESCRIPTOR, {productName});
	if (RuntimeConfig.wordmarkUrl) {
		return (
			<img
				{...getImageSizingProps(props)}
				src={RuntimeConfig.wordmarkUrl}
				alt={ariaLabel}
				data-flx={getDataFlx(props, 'ui.icons.aethernet-wordmark.img')}
			/>
		);
	}
	const style: React.CSSProperties = {
		...(props.style as React.CSSProperties | undefined),
		alignItems: 'center',
		display: 'inline-flex',
		fontWeight: 900,
		letterSpacing: '0.08em',
		lineHeight: 1,
	};
	return (
		<span
			className={props.className}
			style={style}
			role="img"
			aria-label={ariaLabel}
			data-variant={variant}
			data-flx={getDataFlx(props, 'ui.icons.aethernet-wordmark.text')}
		>
			{productName}
		</span>
	);
});
