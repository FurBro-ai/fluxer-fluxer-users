// SPDX-License-Identifier: AGPL-3.0-or-later

import {CommunicationDisabledError} from '@aethernet/errors/src/domains/moderation/CommunicationDisabledError';
import type {GuildMemberResponse} from '@aethernet/schema/src/domains/guild/GuildMemberSchemas';
import {isGuildMemberTimedOut} from '../guild/GuildModel';

export function assertGuildMemberCanCommunicate(member?: GuildMemberResponse | null): void {
	if (isGuildMemberTimedOut(member)) {
		throw new CommunicationDisabledError();
	}
}
