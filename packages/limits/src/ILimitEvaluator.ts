// SPDX-License-Identifier: AGPL-3.0-or-later

import type {LimitKey} from '@aethernet/constants/src/LimitConfigMetadata';
import type {LimitEvaluationOptions, LimitEvaluationResult, LimitMatchContext} from '@aethernet/limits/src/LimitTypes';

export interface ILimitEvaluator {
	resolveAll(ctx: LimitMatchContext, options?: LimitEvaluationOptions): LimitEvaluationResult;
	resolveOne(ctx: LimitMatchContext, key: LimitKey, options?: LimitEvaluationOptions): number;
}
