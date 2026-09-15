// SPDX-License-Identifier: AGPL-3.0-or-later

import {type Logger as AethernetLogger, createLogger} from '@aethernet/logger/src/Logger';

export const Logger = createLogger('aethernet-api');

export type Logger = AethernetLogger;
