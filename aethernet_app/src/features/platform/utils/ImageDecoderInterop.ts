// SPDX-License-Identifier: AGPL-3.0-or-later

export interface AethernetImageDecoderInit {
	data: ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView;
	type: string;
	preferAnimation?: boolean;
}

export interface AethernetImageDecoderDecodedFrame {
	image: VideoFrame;
	complete: boolean;
}

export interface AethernetImageDecoderTrack {
	animated: boolean;
	frameCount: number;
	repetitionCount?: number;
}

export interface AethernetImageDecoderInstance {
	decode(options?: {frameIndex?: number; completeFramesOnly?: boolean}): Promise<AethernetImageDecoderDecodedFrame>;
	tracks: {
		selectedTrack: AethernetImageDecoderTrack | null;
	};
	completed: Promise<void>;
	close(): void;
}

export interface AethernetImageDecoderConstructor {
	new (init: AethernetImageDecoderInit): AethernetImageDecoderInstance;
	isTypeSupported(type: string): Promise<boolean>;
}

export type Canvas2DContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function isImageDecoderConstructor(value: unknown): value is AethernetImageDecoderConstructor {
	if (typeof value !== 'function') return false;
	const candidate = value as {isTypeSupported?: unknown};
	return typeof candidate.isTypeSupported === 'function';
}

export function getImageDecoderConstructor(): AethernetImageDecoderConstructor | null {
	const candidate: unknown = Reflect.get(globalThis, 'ImageDecoder');
	return isImageDecoderConstructor(candidate) ? candidate : null;
}

export function drawVideoFrameToCanvas(ctx: Canvas2DContext, image: VideoFrame, x = 0, y = 0): void {
	ctx.drawImage(image as VideoFrame & CanvasImageSource, x, y);
}
