// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';
import styles from '@app/features/app/components/pages/NotFoundPage.module.css';
import {Link} from '@app/features/platform/components/router/RouterReact';
import {Button} from '@app/features/ui/button/Button';
import {AethernetIcon} from '@app/features/ui/components/icons/AethernetIcon';
import {useAethernetDocumentTitle} from '@app/features/window/hooks/useAethernetDocumentTitle';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

export const NotFoundPage = observer(() => {
	useAethernetDocumentTitle('Not Found');
	return (
		<div className={styles.container} data-flx="app.not-found-page.container">
			<AethernetIcon className={styles.icon} data-flx="app.not-found-page.icon" />
			<div className={styles.content} data-flx="app.not-found-page.content">
				<h1 className={styles.title} data-flx="app.not-found-page.title">
					<Trans>404: page not found</Trans>
				</h1>
				<p className={styles.description} data-flx="app.not-found-page.description">
					<Trans>The page you're looking for doesn't exist or has been moved.</Trans>
				</p>
			</div>
			<div className={styles.actions} data-flx="app.not-found-page.actions">
				<Link to={Routes.ME} data-flx="app.not-found-page.link">
					<Button data-flx="app.not-found-page.button">
						<Trans>Go to home</Trans>
					</Button>
				</Link>
			</div>
		</div>
	);
});
