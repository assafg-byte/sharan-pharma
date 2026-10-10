"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_THRESHOLDS, type TrafficLightThresholds } from "./trafficLight";

// Module-level store shared by every schedule table on the page: fetched once,
// and a save from the settings editor pushes the new thresholds to all mounted
// tables immediately (no reload).
let current: TrafficLightThresholds = DEFAULT_THRESHOLDS;
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function setTrafficLightThresholds(t: TrafficLightThresholds) {
  current = t;
  loaded = true;
  listeners.forEach(l => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useTrafficLightThresholds(): TrafficLightThresholds {
  const thresholds = useSyncExternalStore(subscribe, () => current, () => DEFAULT_THRESHOLDS);

  useEffect(() => {
    if (loaded || inflight) return;
    inflight = fetch("/api/traffic-light")
      .then(r => (r.ok ? r.json() : null))
      .then((t: TrafficLightThresholds | null) => { if (t) setTrafficLightThresholds(t); })
      .catch(() => { /* keep defaults */ })
      .finally(() => { inflight = null; });
  }, []);

  return thresholds;
}
