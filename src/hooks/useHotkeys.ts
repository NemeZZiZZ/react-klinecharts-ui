import { useCallback } from "react";
import {
  registerHotkey as registerHotkeyGlobal,
  getHotkey as getHotkeyGlobal,
  getSupportedHotkeys,
} from "react-klinecharts";
import type { HotkeyTemplate, Hotkey } from "react-klinecharts";
import { useKlinechartsUI } from "../provider/ChartTerminalContext";

export type { HotkeyTemplate, Hotkey } from "react-klinecharts";
export type { HotkeyActionParams } from "react-klinecharts";

export interface UseHotkeysReturn {
  /**
   * Register a custom hotkey globally. Idempotent per `template.name` — calling
   * again with the same name replaces the previous handler. The `action`
   * callback receives the chart instance, the keyboard event and the matched
   * hotkey template (see klinecharts `HotkeyActionParams`).
   */
  registerHotkey: (template: HotkeyTemplate) => void;
  /** Look up a registered hotkey template by name (built-in or custom). */
  getHotkey: (name: string) => HotkeyTemplate | null;
  /** Names of every registered hotkey (built-in + custom). */
  supportedHotkeys: string[];
  /**
   * Enable or disable hotkey handling for the current chart. Pass `exclude`
   * to keep hotkeys on but silence specific ones by name.
   */
  setHotkeysEnabled: (enabled: boolean, exclude?: string[]) => void;
  /** The current hotkey config (`{ enabled, exclude }`) for the chart, or null. */
  getHotkeysConfig: () => Hotkey | null;
}

/**
 * Headless hook for klinecharts v10 keyboard shortcuts (added in
 * klinecharts 10.0.0-beta3).
 *
 * Custom hotkeys are registered **globally** via klinecharts `registerHotkey`,
 * so a shortcut defined here is shared by every chart in the page; the
 * per-chart enable/exclude switches operate on the provider's chart instance.
 */
export function useHotkeys(): UseHotkeysReturn {
  const { state } = useKlinechartsUI();

  const registerHotkey = useCallback((template: HotkeyTemplate) => {
    registerHotkeyGlobal(template);
  }, []);

  const getHotkey = useCallback(
    (name: string) => getHotkeyGlobal(name) ?? null,
    [],
  );

  const setHotkeysEnabled = useCallback(
    (enabled: boolean, exclude?: string[]) => {
      state.chart?.setHotkey(
        exclude ? { enabled, exclude } : { enabled },
      );
    },
    [state.chart],
  );

  const getHotkeysConfig = useCallback(
    () => state.chart?.getHotkey() ?? null,
    [state.chart],
  );

  return {
    registerHotkey,
    getHotkey,
    supportedHotkeys: getSupportedHotkeys(),
    setHotkeysEnabled,
    getHotkeysConfig,
  };
}
