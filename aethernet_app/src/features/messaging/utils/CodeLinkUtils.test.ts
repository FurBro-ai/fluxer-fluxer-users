// SPDX-License-Identifier: AGPL-3.0-or-later

import {type CodeLinkConfig, findCodes, findSpoileredCodeMatches} from '@app/features/messaging/utils/CodeLinkUtils';
import {describe, expect, it} from 'vitest';

const INVITE_CONFIG: CodeLinkConfig = {
	path: 'invite',
	urlBases: ['https://aethernet.app/invite', 'https://aethernet.gg', 'https://aethernet.gg/invite'],
};

describe('CodeLinkUtils', () => {
	it('finds spoilered code-link matches with the same URL rules as code extraction', () => {
		const content = [
			'https://aethernet.app/invite/visible',
			'||https://aethernet.app/invite/secret||',
			'||aethernet.gg/short||',
			'||https://aethernet.gg/invite/pathlink||',
			'||https://aethernet.app/invite/secret https://aethernet.gg/secret||',
			'||<https://aethernet.app/invite/suppressed>||',
		].join(' ');
		expect(findCodes(content, INVITE_CONFIG)).toEqual(['visible', 'secret', 'short', 'pathlink']);
		expect(findSpoileredCodeMatches(content, INVITE_CONFIG).map((match) => match.code)).toEqual([
			'secret',
			'short',
			'pathlink',
			'secret',
			'secret',
		]);
	});
});
