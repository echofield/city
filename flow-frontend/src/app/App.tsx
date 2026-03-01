// FLOW — Temporal field instrument for chauffeurs VTC Paris
// Onboarding → Dashboard → Replay

import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  return <RouterProvider router={router} />;
}
