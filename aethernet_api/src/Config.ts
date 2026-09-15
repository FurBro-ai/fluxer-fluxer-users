// SPDX-License-Identifier: AGPL-3.0-or-later

import {loadConfig} from '@aethernet/config/src/ConfigLoader';
import {buildAPIConfigFromMaster} from '@app/api/Config';
import type {APIConfig} from '@app/api/config/APIConfig';

const master = await loadConfig();
const apiConfig = buildAPIConfigFromMaster(master);

interface ExtendedAPIConfig extends APIConfig {
	env: string;
}

export const Config: ExtendedAPIConfig = {
	env: master.env,
	...apiConfig,
};

export type Config = typeof Config;
