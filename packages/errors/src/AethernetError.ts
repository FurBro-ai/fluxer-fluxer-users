// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ErrorResponse} from '@aethernet/schema/src/domains/common/ErrorSchemas';
import {HTTPException} from 'hono/http-exception';

export type AethernetErrorData = Record<string, unknown>;
export type AethernetErrorStatus = HTTPException['status'];

interface AethernetErrorOptions {
	code: string;
	message?: string;
	status: AethernetErrorStatus;
	data?: AethernetErrorData;
	headers?: Record<string, string>;
	messageVariables?: Record<string, unknown>;
	cause?: Error;
}

export class AethernetError extends HTTPException {
	readonly code: string;
	override readonly message: string;
	override readonly status: AethernetErrorStatus;
	readonly data?: AethernetErrorData;
	readonly headers?: Record<string, string>;
	readonly messageVariables?: Record<string, unknown>;

	constructor(options: AethernetErrorOptions) {
		const resolvedMessage = options.message ?? options.code;
		super(options.status, {message: resolvedMessage, cause: options.cause});
		this.code = options.code;
		this.message = resolvedMessage;
		this.status = options.status;
		this.data = options.data;
		this.headers = options.headers;
		this.messageVariables = options.messageVariables;
		this.name = 'AethernetError';
	}

	override getResponse(): Response {
		return new Response(JSON.stringify(this.toJSON()), {
			status: this.status,
			headers: {
				'Content-Type': 'application/json',
				...this.headers,
			},
		});
	}

	toJSON(): ErrorResponse {
		return {
			code: this.code,
			message: this.message,
			...this.data,
		};
	}
}
