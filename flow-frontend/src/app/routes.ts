import { createBrowserRouter } from "react-router";
import { Onboarding } from "./components/Onboarding";
import { Dashboard } from "./components/Dashboard";
import { Replay } from "./components/Replay";

export const router = createBrowserRouter([
  { path: "/", Component: Onboarding },
  { path: "/flow", Component: Dashboard },
  { path: "/replay", Component: Replay },
  { path: "*", Component: Onboarding },
]);
