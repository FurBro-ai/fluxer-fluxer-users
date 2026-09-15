// SPDX-License-Identifier: AGPL-3.0-or-later

import type {LimitKey} from '@aethernet/constants/src/LimitConfigMetadata';
import {applyRuleToResolvedLimits} from '@aethernet/limits/src/LimitRuleRuntime';
import type {EvaluationContext, LimitRule} from '@aethernet/limits/src/LimitTypes';

export function mergeRuleIntoResolved(
	resolved: Record<LimitKey, number>,
	rule: LimitRule,
	evaluationContext: EvaluationContext,
): void {
	applyRuleToResolvedLimits(resolved, rule, evaluationContext);
}
