// FLOW — Activate: conducteur pricing, instrument tone.
// Stripe Payment Link v1 (no backend).

import { C, label } from "./theme";

const BULLETS = ["Lecture du champ", "Positionnement", "Fenêtres"] as const;

const PAYMENT_LINK_URL =
  import.meta.env.VITE_STRIPE_PAYMENT_LINK_URL || "https://buy.stripe.com/14AfZhdha0XLfXG2kV48009";

export function Activate() {
  const handleActivate = () => {
    const url = new URL(PAYMENT_LINK_URL);
    const flowRef = typeof localStorage !== "undefined" ? localStorage.getItem("flow_ref") : null;
    if (flowRef) url.searchParams.set("ref", flowRef);
    window.location.href = url.toString();
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: C.bg }}
    >
      <div className="flex flex-col items-center text-center max-w-md gap-8">
        <div>
          <h1
            className="uppercase tracking-[0.2em]"
            style={{ ...label, fontSize: "0.65rem", color: C.textGhost, letterSpacing: "0.25em" }}
          >
            FLOW
          </h1>
          <p
            className="mt-2 uppercase tracking-[0.12em]"
            style={{ ...label, fontSize: "1rem", color: C.text, fontWeight: 500 }}
          >
            Accès conducteur
          </p>
        </div>

        <ul className="flex flex-col gap-2 w-full text-left">
          {BULLETS.map((text) => (
            <li
              key={text}
              style={{ ...label, color: C.textDim, fontSize: "0.85rem" }}
            >
              {text}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1">
          <span style={{ ...label, fontSize: "1.5rem", color: C.text, fontWeight: 500 }}>
            49€ / mois
          </span>
          <span style={{ ...label, fontSize: "0.75rem", color: C.textDim }}>
            Prix fondateur — 90€ ensuite
          </span>
        </div>

        <button
          type="button"
          onClick={handleActivate}
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
          Activer Flow
        </button>

        {/* QR: alternative way to open Stripe checkout */}
        <a
          href={PAYMENT_LINK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-2 mt-2"
          style={{ color: "inherit", textDecoration: "none" }}
        >
          <img
            src="/qr-stripe-subscribe.png"
            alt="Scanner pour s'abonner"
            width={140}
            height={140}
            style={{ borderRadius: 8 }}
          />
          <span style={{ ...label, fontSize: "0.65rem", color: C.textGhost }}>
            Scanner pour s'abonner
          </span>
        </a>

        <p style={{ ...label, fontSize: "0.65rem", color: C.textGhost }}>
          Annulable à tout moment.
        </p>
      </div>
    </div>
  );
}
