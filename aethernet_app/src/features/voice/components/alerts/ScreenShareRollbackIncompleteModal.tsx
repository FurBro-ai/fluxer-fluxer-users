// SPDX-License-Identifier: AGPL-3.0-or-later

import {GenericErrorModal} from '@app/features/app/components/alerts/GenericErrorModal';
import {PRODUCT_NAME} from '@app/features/app/config/I18nDisplayConstants';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

const TITLE_DESCRIPTOR = msg({
	message: 'Screen sharing may still be active',
	comment: 'Title shown when a failed screen share could not be fully stopped.',
});
export const ScreenShareRollbackIncompleteModal = observer(() => {
	const {i18n} = useLingui();
	return (
		<GenericErrorModal
			title={i18n._(TITLE_DESCRIPTOR)}
			message={`Screen sharing failed, but ${PRODUCT_NAME} could not confirm that every capture path stopped. Use Stop Sharing or disconnect from the call before continuing.`}
			data-flx="voice.screen-share-rollback-incomplete-modal.confirm-modal"
		/>
	);
});
