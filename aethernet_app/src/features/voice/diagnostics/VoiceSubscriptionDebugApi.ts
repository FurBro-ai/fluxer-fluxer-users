// SPDX-License-Identifier: AGPL-3.0-or-later

import {getAethernetDebugObject} from '@app/features/platform/utils/AethernetDebugGlobal';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {loadLazyModule} from '@app/features/platform/utils/LazyModuleLoader';

const logger = new Logger('VoiceSubscriptionDebugApi');

async function collectReport(): Promise<unknown> {
	const {collectVoiceSubscriptionDebugReport} = await loadLazyModule(
		() => import('@app/features/voice/diagnostics/VoiceSubscriptionDebugReport'),
	);
	return collectVoiceSubscriptionDebugReport();
}

export function installVoiceSubscriptionDebugApi(): void {
	const debugObject = getAethernetDebugObject();
	if (!debugObject) {
		return;
	}
	try {
		debugObject.getVoiceSubscriptionDebug = collectReport;
		debugObject.getVoiceSubscriptionDebugJson = async () => JSON.stringify(await collectReport(), null, 2);
	} catch (error) {
		logger.warn('Failed to install __AETHERNET_DEBUG__ voice subscription helpers', error);
	}
}
