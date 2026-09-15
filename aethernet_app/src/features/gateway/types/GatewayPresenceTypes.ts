// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserPartial} from '@aethernet/schema/src/domains/user/UserResponseSchemas';
import type {GatewayCustomStatusPayload} from '@app/features/user/state/CustomStatus';

export interface PresenceRecord {
	readonly guild_id?: string | null;
	readonly user: UserPartial;
	readonly status?: string | null;
	readonly afk?: boolean;
	readonly mobile?: boolean;
	readonly custom_status?: GatewayCustomStatusPayload | null;
}

export type Presence = PresenceRecord;
