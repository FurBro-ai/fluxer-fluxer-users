// SPDX-License-Identifier: AGPL-3.0-or-later

import {InvalidApiOriginError} from '@aethernet/errors/src/domains/core/InvalidApiOriginError';
import type {Context, Next} from 'hono';

export async function BlockAppOriginMiddleware(ctx: Context, next: Next) {
	const origin = ctx.req.header('origin');
	if (origin === 'https://web.aethernet.app' || origin === 'https://web.canary.aethernet.app') {
		throw new InvalidApiOriginError();
	}
	await next();
}
