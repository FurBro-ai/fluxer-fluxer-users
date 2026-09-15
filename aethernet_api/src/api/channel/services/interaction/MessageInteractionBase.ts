// SPDX-License-Identifier: AGPL-3.0-or-later

import {TEXT_BASED_CHANNEL_TYPES} from '@aethernet/constants/src/ChannelConstants';
import {CannotSendMessageToNonTextChannelError} from '@aethernet/errors/src/domains/channel/CannotSendMessageToNonTextChannelError';
import type {GuildResponse} from '@aethernet/schema/src/domains/guild/GuildResponseSchemas';
import type {IGatewayService} from '../../../infrastructure/IGatewayService';
import type {Channel} from '../../../models/Channel';

export interface ParsedEmoji {
	id?: string;
	name: string;
	animated?: boolean;
}

export abstract class MessageInteractionBase {
	constructor(protected gatewayService: IGatewayService) {}

	protected isOperationDisabled(guild: GuildResponse | null, operation: number): boolean {
		if (!guild) return false;
		return (guild.disabled_operations & operation) !== 0;
	}

	protected ensureTextChannel(channel: Channel): void {
		if (!TEXT_BASED_CHANNEL_TYPES.has(channel.type)) {
			throw new CannotSendMessageToNonTextChannelError();
		}
	}
}
