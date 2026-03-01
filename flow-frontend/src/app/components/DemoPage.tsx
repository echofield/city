// FLOW — Demo page: dashboard in aperçu mode for landing flow.

import { Dashboard } from "./Dashboard";

export function DemoPage() {
  return (
    <Dashboard
      demoMode
      pollIntervalMs={10000}
      showActivationOverlayAfterMs={75000}
    />
  );
}
