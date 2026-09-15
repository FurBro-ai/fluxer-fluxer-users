// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserPartial} from '@aethernet/schema/src/domains/user/UserResponseSchemas';
import Channels from '@app/features/channel/state/Channels';
import type {GatewayHandlerContext} from '@app/features/gateway/events/EventRouter';
import QuickSwitcher from '@app/features/search/state/QuickSwitcher';

interface ChannelRecipientPayload {
	channel_id: string;
	user: UserPartial;
}

export function handleChannelRecipientRemove(data: ChannelRecipientPayload, _context: GatewayHandlerContext): void {
	Channels.handleChannelRecipientRemove({
		channelId: data.channel_id,
		user: data.user,
	});
	QuickSwitcher.recomputeIfOpen();
}
