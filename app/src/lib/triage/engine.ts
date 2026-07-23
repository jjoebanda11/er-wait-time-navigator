/**
 * Symptom triage.
 *
 * This is a navigation aid, not a diagnostic tool, and it is built to be wrong
 * in one direction only. Every design decision below trades false alarms for
 * missed emergencies:
 *
 *  1. Red flags are evaluated before anything else and short-circuit the flow.
 *  2. "Not sure" always counts as a yes. Uncertainty escalates.
 *  3. Age and pregnancy modifiers can only raise acuity, never lower it.
 *  4. The lowest possible outcome still offers a nurse line, never "stay home".
 *
 * The wording of red flags follows the standard public-facing emergency warning
 * signs used by Canadian health authorities. Any change to this file should be
 * reviewed by a clinician before it ships — see docs/CLINICAL-REVIEW.md.
 */

import type { CareLevel } from '../care-options';

export type PatientAgeBand = 'infant' | 'child' | 'adult' | 'senior';

export interface TriageInput {
  ageBand: PatientAgeBand;
  /** IDs of red flags the user selected, from any stage. */
  selected: string[];
  /** Pregnancy escalates several otherwise-moderate symptoms. */
  pregnant?: boolean;
  /** The user explicitly said they are unsure — always escalates. */
  unsure?: boolean;
}

export type TriageLevel = 'call-911' | 'emergency' | 'urgent-care' | 'self-care';

export interface TriageFlag {
  id: string;
  label: string;
  /** Restrict a flag to certain ages, e.g. infant fever. */
  ageBands?: PatientAgeBand[];
  /** Extra context shown under the label. */
  hint?: string;
}

export interface TriageStage {
  id: string;
  level: TriageLevel;
  title: string;
  instruction: string;
  flags: TriageFlag[];
}

/**
 * Stage 1 — call an ambulance. These are the classic time-critical
 * presentations where transport method changes the outcome.
 */
const STAGE_911: TriageStage = {
  id: 'stage-911',
  level: 'call-911',
  title: 'First, the most serious signs',
  instruction:
    'Select anything that applies right now. If you are not certain, select it anyway.',
  flags: [
    {
      id: 'unresponsive',
      label: 'Unconscious, unresponsive, or very hard to wake',
    },
    {
      id: 'not-breathing',
      label: 'Not breathing, choking, or struggling to breathe',
      hint: 'Gasping, unable to speak a full sentence, or lips turning blue',
    },
    {
      id: 'chest-pain',
      label: 'Chest pain, pressure, or tightness',
      hint: 'Especially with sweating, nausea, or pain spreading to the arm, neck, or jaw',
    },
    {
      id: 'stroke-signs',
      label: 'Sudden face drooping, arm weakness, or trouble speaking',
      hint: 'Also sudden confusion, vision loss, or a severe unexplained headache',
    },
    {
      id: 'severe-bleeding',
      label: 'Heavy bleeding that will not stop with firm pressure',
    },
    {
      id: 'seizure',
      label: 'An active seizure, or a first-ever seizure',
    },
    {
      id: 'anaphylaxis',
      label: 'Severe allergic reaction',
      hint: 'Swelling of the face, lips, or throat, hives with breathing trouble',
    },
    {
      id: 'major-trauma',
      label: 'Major injury — a serious fall, a car crash, or a deep wound',
    },
    {
      id: 'overdose',
      label: 'Suspected overdose or poisoning',
      hint: 'If the person is awake and alert, PADIS at 1-800-332-1414 can advise immediately',
    },
    {
      id: 'self-harm-immediate',
      label: 'In immediate danger of harming themselves or someone else',
    },
  ],
};

/** Stage 2 — needs an emergency department, but can usually travel by car. */
const STAGE_ER: TriageStage = {
  id: 'stage-er',
  level: 'emergency',
  title: 'Next, serious symptoms',
  instruction: 'Select anything that applies.',
  flags: [
    {
      id: 'infant-fever',
      label: 'A baby under 3 months old with any fever',
      hint: 'Fever in a newborn always needs an emergency assessment, even if they seem well',
      ageBands: ['infant'],
    },
    {
      id: 'child-lethargy',
      label: 'A child who is unusually drowsy, floppy, or will not drink',
      ageBands: ['infant', 'child'],
    },
    {
      id: 'stiff-neck-rash',
      label: 'Fever with a stiff neck, or a rash that does not fade when pressed',
    },
    {
      id: 'head-injury',
      label: 'A head injury with vomiting, confusion, or loss of consciousness',
    },
    {
      id: 'severe-pain',
      label: 'Severe pain that is unbearable or rapidly getting worse',
    },
    {
      id: 'severe-abdominal',
      label: 'Severe abdominal pain, especially with fever or vomiting blood',
    },
    {
      id: 'deformity',
      label: 'A limb that is visibly deformed, or a bone through the skin',
    },
    {
      id: 'pregnancy-complication',
      label: 'Pregnancy with bleeding, severe pain, or reduced fetal movement',
    },
    {
      id: 'dehydration',
      label: 'Cannot keep any fluids down, or has not passed urine all day',
    },
    {
      id: 'suicidal-thoughts',
      label: 'Thoughts of suicide or self-harm without immediate danger',
      hint: 'The 988 Suicide Crisis Helpline is free, 24/7, by call or text',
    },
  ],
};

/** Stage 3 — genuine same-day need, appropriate for urgent care. */
const STAGE_URGENT: TriageStage = {
  id: 'stage-urgent',
  level: 'urgent-care',
  title: 'Now, same-day concerns',
  instruction: 'Select anything that applies.',
  flags: [
    { id: 'possible-fracture', label: 'A possible sprain or broken bone that you can still move' },
    { id: 'wound-stitches', label: 'A cut that may need stitches' },
    { id: 'moderate-fever', label: 'A fever lasting more than three days' },
    { id: 'infection', label: 'A wound or skin area that is red, hot, swollen, or oozing' },
    { id: 'vomiting-diarrhea', label: 'Persistent vomiting or diarrhea, but keeping some fluids down' },
    { id: 'ear-throat-pain', label: 'Significant ear pain, sore throat, or sinus pain' },
    { id: 'urinary', label: 'Burning when passing urine, or needing to go constantly' },
    { id: 'eye-problem', label: 'A red, painful, or discharging eye' },
    { id: 'rash', label: 'A new rash that is spreading or uncomfortable' },
    { id: 'medication-issue', label: 'Ran out of an essential medication, or need a refill' },
  ],
};

export const TRIAGE_STAGES: TriageStage[] = [STAGE_911, STAGE_ER, STAGE_URGENT];

export interface TriageOutcome {
  level: TriageLevel;
  /** Headline, written as an instruction rather than a diagnosis. */
  title: string;
  message: string;
  /** Why we landed here, so the user can sanity-check our reasoning. */
  reasons: string[];
  /** Which care options to surface. */
  careLevel: CareLevel;
  /** Whether to show the ranked facility board beneath the result. */
  showFacilities: boolean;
  /** Restrict the board to pediatric-appropriate sites. */
  childPatient: boolean;
  /** Emphasised call-to-action, if any. */
  phone?: string;
}

const ALL_FLAGS: TriageFlag[] = TRIAGE_STAGES.flatMap((stage) => stage.flags);

function labelFor(id: string): string {
  return ALL_FLAGS.find((flag) => flag.id === id)?.label ?? id;
}

function flagsInStage(stage: TriageStage, selected: string[]): string[] {
  const ids = new Set(stage.flags.map((f) => f.id));
  return selected.filter((id) => ids.has(id));
}

/**
 * Resolve a triage outcome.
 *
 * Evaluation is strictly ordered by severity and returns at the first match, so
 * selecting a stage-1 flag can never be overridden by anything selected later.
 */
export function triage(input: TriageInput): TriageOutcome {
  const { ageBand, selected, pregnant = false, unsure = false } = input;
  const childPatient = ageBand === 'infant' || ageBand === 'child';

  const emergencyFlags = flagsInStage(STAGE_911, selected);
  if (emergencyFlags.length > 0) {
    return {
      level: 'call-911',
      title: 'Call 911 now',
      message:
        'Based on what you selected, this needs emergency medical help immediately. Call 911 rather than driving. Paramedics can start treatment right away, and the hospital will be ready before you arrive.',
      reasons: emergencyFlags.map(labelFor),
      careLevel: 'emergency',
      showFacilities: false,
      childPatient,
      phone: '911',
    };
  }

  const erFlags = flagsInStage(STAGE_ER, selected);
  if (erFlags.length > 0) {
    return {
      level: 'emergency',
      title: 'Go to an emergency department',
      message: childPatient
        ? 'This needs to be assessed in an emergency department today. A children’s emergency department is best if one is reasonably close. If your child gets worse on the way — becomes hard to wake, struggles to breathe, or stops responding — call 911 immediately.'
        : 'This needs to be assessed in an emergency department today. Below are the Alberta sites ranked by how long it should take to actually be seen, including the drive. If symptoms get worse on the way, call 911.',
      reasons: erFlags.map(labelFor),
      careLevel: 'urgent',
      showFacilities: true,
      childPatient,
    };
  }

  const urgentFlags = flagsInStage(STAGE_URGENT, selected);

  // Escalation modifiers. These only ever raise acuity.
  const escalations: string[] = [];
  if (unsure) escalations.push('You told us you are not sure how serious this is');
  if (pregnant && urgentFlags.length > 0) escalations.push('Pregnancy raises the risk of these symptoms');
  if (ageBand === 'infant' && urgentFlags.length > 0) {
    escalations.push('Infants can deteriorate quickly and are assessed sooner');
  }
  if (ageBand === 'senior' && urgentFlags.length > 1) {
    escalations.push('Several symptoms at once carry more risk over 75');
  }

  if (escalations.length > 0 && urgentFlags.length > 0) {
    return {
      level: 'emergency',
      title: 'Get assessed today — start with 811 or an emergency department',
      message:
        'Your symptoms on their own would usually suit urgent care, but there are factors here that raise the risk. Call Health Link at 811 now for a nurse assessment, or go to an emergency department. If anything worsens, call 911.',
      reasons: [...urgentFlags.map(labelFor), ...escalations],
      careLevel: 'urgent',
      showFacilities: true,
      childPatient,
      phone: '811',
    };
  }

  if (unsure) {
    return {
      level: 'urgent-care',
      title: 'Call Health Link at 811',
      message:
        'When you are not sure, a registered nurse can tell you exactly what level of care you need. It is free, available 24/7, and takes minutes. They will direct you to an emergency department if that is what this needs.',
      reasons: ['You told us you are not sure how serious this is'],
      careLevel: 'advice',
      showFacilities: true,
      childPatient,
      phone: '811',
    };
  }

  if (urgentFlags.length > 0) {
    return {
      level: 'urgent-care',
      title: 'Urgent care, a pharmacist, or your doctor — not the ER',
      message:
        'These symptoms usually need attention today, but an emergency department is likely to be the slowest way to get it. An urgent care centre, a prescribing pharmacist, or your family doctor will almost certainly see you sooner. Health Link at 811 can confirm which is right, free, 24/7.',
      reasons: urgentFlags.map(labelFor),
      careLevel: 'semi-urgent',
      showFacilities: true,
      childPatient,
    };
  }

  return {
    level: 'self-care',
    title: 'An emergency department is probably not the fastest help',
    message:
      'Nothing you selected suggests an emergency. A pharmacist, your family doctor, or Health Link at 811 will almost certainly help you faster than an emergency department would. If new symptoms appear or things get worse, start this again — and if anything on the first list appears, call 911.',
    reasons: [],
    careLevel: 'non-urgent',
    showFacilities: false,
    childPatient,
  };
}
