// SPDX-License-Identifier: AGPL-3.0-or-later

import type {Invite} from '@aethernet/schema/src/domains/invite/InviteSchemas';
import type {GatewayHandlerContext} from '@app/features/gateway/events/EventRouter';
import Invites from '@app/features/invite/state/Invites';

export function handleInviteCreate(data: Invite, _context: GatewayHandlerContext): void {
	Invites.handleInviteCreate(data);
}
