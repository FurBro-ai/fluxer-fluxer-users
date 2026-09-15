// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, expect, test} from 'vitest';
import {serviceEnvironment, serviceNames, sharedEnvironment} from './SelfHostingCompose';

describe('the shipped compose stack wires every service it starts', () => {
	test('no service sizes a pool for a connection it cannot make', () => {
		const pooledServices = serviceNames.filter(
			(name) => 'AETHERNET_POSTGRES_MAX_CONNECTIONS' in serviceEnvironment(name),
		);
		expect(pooledServices.length).toBeGreaterThan(0);
		for (const name of pooledServices) {
			expect(serviceEnvironment(name), name).toMatchObject({
				AETHERNET_DATABASE_BACKEND: 'postgres',
				AETHERNET_POSTGRES_HOST: expect.stringMatching(/\S/u),
				AETHERNET_POSTGRES_PORT: expect.stringMatching(/\S/u),
				AETHERNET_POSTGRES_DATABASE: expect.stringMatching(/\S/u),
				AETHERNET_POSTGRES_USERNAME: expect.stringMatching(/\S/u),
				AETHERNET_POSTGRES_PASSWORD: expect.stringMatching(/\S/u),
			});
		}
	});

	test('the shared block sets the client-IP trust the merged services read', () => {
		expect(sharedEnvironment).toMatchObject({
			AETHERNET_TRUST_CLIENT_IP_HEADER: `\${AETHERNET_TRUST_CLIENT_IP_HEADER:-true}`,
			AETHERNET_CLIENT_IP_HEADER_NAME: `\${AETHERNET_CLIENT_IP_HEADER_NAME:-x-forwarded-for}`,
		});
	});
});
