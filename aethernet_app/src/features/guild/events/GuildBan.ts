// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserPartial} from '@aethernet/schema/src/domains/user/UserResponseSchemas';
import type {GatewayHandlerContext} from '@app/features/gateway/events/EventRouter';
import GuildBans from '@app/features/guild/state/GuildBans';

interface GuildBanPayload {
	guild_id: string;
	user: UserPartial;
}

export function handleGuildBanAdd(data: GuildBanPayload, _context: GatewayHandlerContext): void {
	GuildBans.noteBan(data.guild_id, data.user.id);
}

export function handleGuildBanRemove(data: GuildBanPayload, _context: GatewayHandlerContext): void {
	GuildBans.noteUnban(data.guild_id, data.user.id);
}
