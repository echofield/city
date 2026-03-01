// FLOW — Success: post-payment thank you. Stripe Payment Link v1 (no backend).

import { useNavigate } from "react-router";
import { C, label } from "./theme";

export function Success() {
  const navigate = useNavigate();
  const flowRef =
    typeof localStorage !== "undefined" ? localStorage.getItem("flow_ref") : null;

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: C.bg }}
    >
      <div className="flex flex-col items-center text-center max-w-sm gap-8">
        <p
          style={{
            ...label,
            fontSize: "1.1rem",
            color: C.text,
            fontWeight: 500,
          }}
        >
          Accès activé.
        </p>
        <button
          type="button"
          onClick={() => navigate("/flow")}
          className="uppercase tracking-[0.2em] py-3 px-8 font-medium transition-opacity hover:opacity-90"
          style={{
            ...label,
            fontSize: "0.75rem",
            color: C.bg,
            backgroundColor: C.green,
            border: "none",
            borderRadius: 3,
            cursor: "pointer",
          }}
        >
          Entrer →
        </button>
        {flowRef && (
          <span
            style={{
              ...label,
              fontSize: "0.6rem",
              color: C.textGhost,
            }}
          >
            Invité par {flowRef}
          </span>
        )}
      </div>
    </div>
  );
}
