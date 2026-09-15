// SPDX-License-Identifier: AGPL-3.0-or-later

import {DismissedUpsellsSchema} from '@aethernet/schema/src/gen/aethernet/user/preferences/v1/preferences_pb';
import {makeSyncedField} from '@app/features/user/state/SyncedField';
import {makeAutoObservable} from 'mobx';

class DismissedUpsell {
	pickerPremiumUpsellDismissed = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		this.initPersistence();
	}

	private async initPersistence(): Promise<void> {
		await makeSyncedField(this, {
			field: 'dismissedUpsells',
			schema: DismissedUpsellsSchema,
			persist: ['pickerPremiumUpsellDismissed'],
			toMessage: (s) => ({pickerPremium: s.pickerPremiumUpsellDismissed}),
			applyMessage: (s, m) => {
				s.pickerPremiumUpsellDismissed = m.pickerPremium;
			},
		});
	}

	dismissPickerPremiumUpsell(): void {
		this.pickerPremiumUpsellDismissed = true;
	}
}

export default new DismissedUpsell();
