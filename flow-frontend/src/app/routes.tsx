import { createBrowserRouter } from "react-router";
import { Onboarding } from "./components/Onboarding";
import { Dashboard } from "./components/Dashboard";
import { FlowApp } from "./components/FlowApp";
import { Replay } from "./components/Replay";
import { LandingHero } from "./components/LandingHero";
import { DemoPage } from "./components/DemoPage";
import { Activate } from "./components/Activate";
import { Success } from "./components/Success";

// FlowApp wrapper for route
function FlowPage() {
  return <FlowApp />;
}

export const router = createBrowserRouter([
  { path: "/", Component: LandingHero },
  { path: "/onboarding", Component: Onboarding },
  { path: "/demo", Component: DemoPage },
  { path: "/activate", Component: Activate },
  { path: "/success", Component: Success },
  { path: "/flow", Component: FlowPage },
  { path: "/flow-legacy", Component: Dashboard }, // Keep old dashboard accessible
  { path: "/replay", Component: Replay },
  { path: "*", Component: LandingHero },
]);
