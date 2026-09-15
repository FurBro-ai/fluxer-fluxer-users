// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ConnectionListResponse} from '@aethernet/schema/src/domains/connection/ConnectionSchemas';
import UserConnection from '@app/features/connection/state/UserConnection';
import type {GatewayHandlerContext} from '@app/features/gateway/events/EventRouter';

export function handleUserConnectionsUpdate(
	data: {
		connections: ConnectionListResponse;
	},
	_context: GatewayHandlerContext,
): void {
	UserConnection.setConnections(data.connections);
}
