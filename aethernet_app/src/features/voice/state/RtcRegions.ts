// SPDX-License-Identifier: AGPL-3.0-or-later

import type {RtcRegionResponse} from '@aethernet/schema/src/domains/channel/ChannelSchemas';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {makeAutoObservable} from 'mobx';

const logger = new Logger('RtcRegions');

class RtcRegions {
	private regions: Array<RtcRegionResponse> = [];

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	setRegions(regions: Array<RtcRegionResponse>): void {
		this.regions = regions;
		logger.debug(`Set RTC regions (${this.regions.length})`);
	}

	getRegions(): Array<RtcRegionResponse> {
		return this.regions;
	}
}

export default new RtcRegions();
