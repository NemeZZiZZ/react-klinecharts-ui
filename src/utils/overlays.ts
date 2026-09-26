import type { Chart } from "klinecharts";

/**
 * klinecharts v10 filter semantics (`StoreImp.getOverlaysByFilter`): a valid
 * `id` SHORT-CIRCUITS the filter — `groupId` and `name` are ignored. So
 * `removeOverlay({ id, groupId })` removes the overlay with that id in ANY
 * group, and `overrideOverlay({ id, groupId, ... })` additionally merges the
 * foreign `groupId` into the victim (silently re-homing it into our group).
 *
 * These helpers restore the scoping call sites actually intend: the id is
 * honored only when the matched overlay also belongs to `groupId`, and the
 * groupId never leaks into the override payload.
 */

export interface ScopedOverlayFilter {
  id: string;
  groupId: string;
}

interface OverlayLike {
  id: string;
  groupId?: string;
}

/** Overlays matching `id` that ALSO belong to `groupId`. */
export function getOverlaysScoped<T extends OverlayLike = OverlayLike>(
  chart: Chart,
  filter: ScopedOverlayFilter,
): T[] {
  const found = (chart.getOverlays({ id: filter.id }) ??
    []) as unknown as T[];
  return found.filter((o) => o.groupId === filter.groupId);
}

/**
 * Remove the overlay only when it belongs to `groupId`.
 * Returns whether anything was removed.
 */
export function removeOverlayScoped(
  chart: Chart,
  filter: ScopedOverlayFilter,
): boolean {
  if (getOverlaysScoped(chart, filter).length === 0) return false;
  chart.removeOverlay({ id: filter.id });
  return true;
}

/**
 * Override the overlay only when it belongs to `groupId`. The `groupId` key
 * is stripped from the override payload (klinecharts would merge it into the
 * victim overlay). Returns whether anything was overridden.
 */
export function overrideOverlayScoped(
  chart: Chart,
  filter: ScopedOverlayFilter & Record<string, unknown>,
): boolean {
  const { id, groupId, ...rest } = filter;
  if (getOverlaysScoped(chart, { id, groupId }).length === 0) return false;
  chart.overrideOverlay({
    id,
    ...rest,
  } as Parameters<Chart["overrideOverlay"]>[0]);
  return true;
}
