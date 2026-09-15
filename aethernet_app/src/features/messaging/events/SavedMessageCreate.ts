// SPDX-License-Identifier: AGPL-3.0-or-later

import type {Message} from '@aethernet/schema/src/domains/message/MessageResponseSchemas';
import type {GatewayHandlerContext} from '@app/features/gateway/events/EventRouter';
import SavedMessages from '@app/features/messaging/state/SavedMessages';

export function handleSavedMessageCreate(data: Message, _context: GatewayHandlerContext): void {
	SavedMessages.handleMessageCreate(data);
}
