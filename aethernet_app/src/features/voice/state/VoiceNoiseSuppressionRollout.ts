// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	resolveVoiceNoiseSuppressionForCall,
	type VoiceNoiseSuppressionAssignmentResponse,
	type VoiceNoiseSuppressionBackend,
	type VoiceNoiseSuppressionResolution,
} from '@aethernet/schema/src/domains/admin/VoiceNoiseSuppressionSchemas';
import {readVoiceNoiseSuppressionAssignment} from '@aethernet/schema/src/domains/experiment/ExperimentSchemas';
import ExperimentAssignments from '@app/features/experiment/state/ExperimentAssignments';
import {Logger} from '@app/features/platform/utils/AppLogger';

const logger = new Logger('VoiceNoiseSuppressionRollout');

class VoiceNoiseSuppressionRolloutSelector {
	get assignment(): VoiceNoiseSuppressionAssignmentResponse {
		return readVoiceNoiseSuppressionAssignment(ExperimentAssignments.response);
	}

	resolveForCall(
		guildId: string | null,
		userPreference: VoiceNoiseSuppressionBackend | null,
	): VoiceNoiseSuppressionResolution | null {
		try {
			return resolveVoiceNoiseSuppressionForCall(this.assignment, guildId, userPreference);
		} catch (err) {
			logger.warn('Failed to resolve noise suppression for call:', err);
			return null;
		}
	}
}

export const VoiceNoiseSuppressionRollout = new VoiceNoiseSuppressionRolloutSelector();

export default VoiceNoiseSuppressionRollout;
