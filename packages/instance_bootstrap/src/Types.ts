// SPDX-License-Identifier: AGPL-3.0-or-later

import type {LimitConfigSnapshot, LimitConfigWireFormat} from '@aethernet/limits/src/LimitTypes';
import type {
	GeoEntry,
	GeolocationResponse as GeolocationWireResponse,
} from '@aethernet/schema/src/domains/geolocation/GeolocationSchemas';
import type {WellKnownAethernetResponse} from '@aethernet/schema/src/domains/instance/InstanceSchemas';

export type {GeoEntry} from '@aethernet/schema/src/domains/geolocation/GeolocationSchemas';
export type {
	InstanceAppPublic,
	InstanceCaptcha,
	InstanceCommunity,
	InstanceEndpoints,
	InstanceFeatures,
	InstanceGif,
	InstancePush,
	InstanceRegistration,
	InstanceServices,
	InstanceSso,
} from '@aethernet/schema/src/domains/instance/InstanceSchemas';

export interface InstanceDiscoveryResponse extends Omit<WellKnownAethernetResponse, 'limits'> {
	limits: LimitConfigSnapshot | LimitConfigWireFormat;
}

export interface GeolocationResponse extends Omit<GeolocationWireResponse, 'ageRestrictedGeos' | 'ageBlockedGeos'> {
	ageRestrictedGeos: ReadonlyArray<GeoEntry>;
	ageBlockedGeos: ReadonlyArray<GeoEntry>;
}
