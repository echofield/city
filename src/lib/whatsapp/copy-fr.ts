/**
 * WhatsApp French Copy — v1.6
 *
 * All messages in French for VTC drivers.
 * Numeric opt-in protocol.
 */

// ════════════════════════════════════════════════════════════════
// MAIN MENU
// ════════════════════════════════════════════════════════════════

export const MENU_MAIN = `🔔 FLOW — Alertes Chauffeur (Paris)

Je peux t'envoyer *des alertes utiles* (pics, fermetures métro, pluie, sorties de salles) *max 3/nuit*.

Réponds avec un chiffre :
*1* = ✅ OUI, j'accepte les alertes FLOW sur WhatsApp
*2* = ❌ NON
*3* = ⚙️ Réglages (corridors / horaires)
*4* = ℹ️ Voir un exemple d'alerte`

// ════════════════════════════════════════════════════════════════
// OPT-IN / OPT-OUT CONFIRMATIONS
// ════════════════════════════════════════════════════════════════

export const CONFIRM_OPT_IN = `✅ Parfait. Tu es inscrit.

Tu recevras *max 3 alertes par nuit* quand un signal est *fiable*.

Pour arrêter à tout moment : réponds *0* (STOP).`

export const CONFIRM_OPT_OUT = `Compris. Je ne t'enverrai rien.

Si tu changes d'avis, réponds *1*.`

export const CONFIRM_STOP = `✅ STOP confirmé.

Tu ne receveras plus d'alertes.

(Tu peux réactiver avec *1*.)`

// ════════════════════════════════════════════════════════════════
// SETTINGS MENU
// ════════════════════════════════════════════════════════════════

export const MENU_SETTINGS = `⚙️ Réglages FLOW

Réponds :
*31* = Nord (CDG / Saint-Denis / GdN)
*32* = Est (Bastille / Montreuil)
*33* = Sud (Orly / Montparnasse)
*34* = Ouest (La Défense / Opéra)

*35* = 22h–02h seulement
*36* = 00h–05h seulement
*37* = Toutes les heures

*39* = Retour menu`

export function confirmCorridorToggle(corridor: string, enabled: boolean): string {
  const corridorNames: Record<string, string> = {
    nord: 'Nord (CDG / Saint-Denis / GdN)',
    est: 'Est (Bastille / Montreuil)',
    sud: 'Sud (Orly / Montparnasse)',
    ouest: 'Ouest (La Défense / Opéra)',
  }
  const name = corridorNames[corridor] || corridor
  return enabled
    ? `✅ Corridor *${name}* activé.`
    : `❌ Corridor *${name}* désactivé.`
}

export function confirmTimeWindow(window: string): string {
  const windowNames: Record<string, string> = {
    '22h-02h': '22h–02h',
    '00h-05h': '00h–05h',
    'all': 'Toutes les heures',
  }
  return `✅ Horaires: *${windowNames[window] || window}*`
}

// ════════════════════════════════════════════════════════════════
// EXAMPLE ALERT
// ════════════════════════════════════════════════════════════════

export const EXAMPLE_ALERT = `Exemple d'alerte :

🔥 *BOUGER → République (Est)*
Fenêtre: *20 min*
Pourquoi: *Sorties Gare du Nord + métro réduit*
Estimé: *28–38 €/h*

Pour activer : réponds *1*`

// ════════════════════════════════════════════════════════════════
// ALERT TEMPLATES
// ════════════════════════════════════════════════════════════════

export interface AlertParams {
  zone: string
  arrondissement?: string
  minutes?: number
  reason: string
  eurLow?: number
  eurHigh?: number
  corridor?: string
}

/** 🔥 Action now — driver should move immediately */
export function alertActionNow(params: AlertParams): string {
  const { zone, arrondissement, minutes, reason, eurLow, eurHigh, corridor } = params
  const zoneDisplay = arrondissement ? `${zone} (${arrondissement})` : zone
  const corridorDisplay = corridor ? ` (${corridor.charAt(0).toUpperCase() + corridor.slice(1)})` : ''

  let msg = `🔥 *FLOW*

*BOUGER → ${zoneDisplay}*${corridorDisplay}`

  if (minutes && minutes > 0) {
    msg += `\nFenêtre: *${minutes} min*`
  }

  msg += `\nPourquoi: *${reason}*`

  if (eurLow && eurHigh) {
    msg += `\nEstimé: *${eurLow}–${eurHigh} €/h*`
  }

  return msg
}

/** ⏳ Upcoming peak — driver should prepare */
export function alertUpcomingPeak(params: AlertParams): string {
  const { zone, minutes, reason } = params

  return `⏳ *FLOW*

Pic dans *${minutes} min*

Zone: *${zone}*
Cause: *${reason}*

Prépare-toi.`
}

/** Metro closing alert */
export function alertMetroClosing(minutesLeft: number): string {
  if (minutesLeft <= 0) {
    return `🚇 *FLOW*

*Métro fermé* — Demande maximale

Zones actives: Bastille, République, Pigalle

Opportunité: *+60% demande VTC*`
  }

  return `🚇 *FLOW*

Derniers métros dans *${minutesLeft} min*

Demande VTC: *+40%* attendu

Prépare-toi pour les sorties.`
}

/** Rain starting alert */
export function alertRainStarting(minutes: number): string {
  return `🌧️ *FLOW*

Pluie prévue dans *${minutes} min*

Effet: *+20-30% demande*, trajets courts

Reste en centre (Châtelet / Marais / Bastille)`
}

/** Calm state — no strong signal */
export function alertCalmState(nextCheckTime: string): string {
  return `*FLOW*

Pas de signal fort pour le moment.

Prochaine vérification: *${nextCheckTime}*.`
}

// ════════════════════════════════════════════════════════════════
// ERROR / FALLBACK MESSAGES
// ════════════════════════════════════════════════════════════════

export const MSG_UNKNOWN_INPUT = `Je n'ai pas compris.

Réponds avec un chiffre :
*1* = Activer alertes
*2* = Désactiver
*3* = Réglages
*0* = STOP`

export const MSG_ALREADY_OPTED_IN = `Tu es déjà inscrit aux alertes FLOW.

Pour arrêter : réponds *0*
Pour réglages : réponds *3*`

export const MSG_NOT_OPTED_IN = `Tu n'es pas encore inscrit.

Pour recevoir des alertes : réponds *1*`
