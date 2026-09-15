// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ThemeType} from '@aethernet/constants/src/UserConstants';
import {ThemeTypes} from '@aethernet/constants/src/UserConstants';
import Theme from '@app/features/theme/state/Theme';
import {THEME_STUDIO_DARK_DEFAULT_VARIABLE_VALUES, THEME_STUDIO_LIGHT_DEFAULT_VARIABLE_VALUES} from './ThemeConstants';

export interface ThemeHydrationResult {
	systemPrefersDark: boolean;
	defaultVariableValues: Readonly<Record<string, string>>;
}

export function useThemeHydration(themePreference: ThemeType): ThemeHydrationResult {
	const systemPrefersDark = Theme.systemPrefersDark;
	const resolvedTheme =
		themePreference === ThemeTypes.SYSTEM ? (systemPrefersDark ? ThemeTypes.DARK : ThemeTypes.LIGHT) : themePreference;
	const defaultVariableValues =
		resolvedTheme === ThemeTypes.LIGHT
			? THEME_STUDIO_LIGHT_DEFAULT_VARIABLE_VALUES
			: THEME_STUDIO_DARK_DEFAULT_VARIABLE_VALUES;
	return {systemPrefersDark, defaultVariableValues};
}
