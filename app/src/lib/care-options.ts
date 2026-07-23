/**
 * Alberta care options outside the emergency department.
 *
 * Everything here is a real, publicly listed Alberta service. Details were
 * verified in July 2026; `docs/DATA-SOURCES.md` records where each came from
 * and when it must be re-checked. Nothing in this file may be invented — a
 * wrong phone number on a crisis line is the worst bug this product could ship.
 */

export type CareLevel = 'emergency' | 'urgent' | 'semi-urgent' | 'non-urgent' | 'advice';

export interface CareOption {
  id: string;
  name: string;
  /** One line a stressed reader can act on immediately. */
  summary: string;
  detail: string;
  typicalWait: string;
  cost: string;
  phone?: string;
  url?: string;
  /** Lowest urgency this option is appropriate for. */
  suitableFor: CareLevel[];
  availability: string;
  /** Ordering hint; lower sorts first. */
  priority: number;
}

export const CARE_OPTIONS: CareOption[] = [
  {
    id: '911',
    name: 'Call 911',
    summary: 'For anything life- or limb-threatening. Do not drive yourself.',
    detail:
      'Paramedics begin treatment on arrival and en route, and the emergency department is prepared before you get there. Arriving by ambulance for a genuine emergency is not "jumping the queue" — triage is by severity, and a critically ill patient is seen immediately regardless of how they arrive.',
    typicalWait: 'Immediate',
    cost: 'Ambulance fees may apply; care itself is covered',
    phone: '911',
    suitableFor: ['emergency'],
    availability: '24/7',
    priority: 0,
  },
  {
    id: 'health-link-811',
    name: 'Health Link 811',
    summary: 'Free 24/7 advice from a registered nurse on what level of care you need.',
    detail:
      'Alberta’s nurse advice line, run by Primary Care Alberta. A registered nurse assesses your symptoms and tells you whether to go to an emergency department, an urgent care centre, a pharmacy, or wait and monitor at home. Some callers are offered Virtual MD, which connects you with a physician by phone or video. If you are unsure whether your situation warrants an ER visit, this is the single best first call — it costs nothing and can save an entire night.',
    typicalWait: 'Minutes to ~30 minutes on hold',
    cost: 'Free',
    phone: '811',
    url: 'https://www.primarycarealberta.ca/page14176.aspx',
    suitableFor: ['urgent', 'semi-urgent', 'non-urgent', 'advice'],
    availability: '24/7',
    priority: 1,
  },
  {
    id: 'health-information-chat',
    name: 'Health Information Chat & nurse callback',
    summary: 'Chat online with a nurse, or request a callback, instead of holding on the phone.',
    detail:
      'Primary Care Alberta offers a live online chat with a registered nurse, and a callback request option, as alternatives to waiting on hold at 811. Explicitly not for urgent or emergency concerns — if your situation is urgent, call 811, go to an emergency department, or call 911 instead.',
    typicalWait: 'Same day',
    cost: 'Free',
    url: 'https://www.primarycarealberta.ca/',
    suitableFor: ['non-urgent', 'advice'],
    availability: 'Seven days a week, 8 a.m. – 10 p.m.',
    priority: 2,
  },
  {
    id: 'prescribing-pharmacist',
    name: 'Pharmacist assessment and prescription',
    summary:
      'Alberta pharmacists can assess and prescribe for many minor ailments — often in under 30 minutes.',
    detail:
      'Alberta gives pharmacists the broadest prescribing scope in Canada. A prescribing pharmacist can assess and prescribe for things like urinary tract infections, cold sores, pink eye, mild skin infections, seasonal allergies, acid reflux, and can renew most existing prescriptions. For Albertans with a valid Alberta Health card the assessment is covered by AHCIP; without one it is typically around $25. Many pharmacies take walk-ins and some are open late or 24 hours. Phone ahead to confirm a prescribing pharmacist is on shift.',
    typicalWait: '15–45 minutes',
    cost: 'Covered by AHCIP with a valid Alberta Health card',
    suitableFor: ['semi-urgent', 'non-urgent'],
    availability: 'Pharmacy hours; some locations 24/7',
    priority: 3,
  },
  {
    id: 'urgent-care',
    name: 'Urgent care centre',
    summary: 'For real but non-life-threatening problems: sprains, minor fractures, stitches.',
    detail:
      'Urgent care centres handle conditions that need same-day attention but are not emergencies — minor fractures and sprains, wounds needing stitches, infections, moderate pain. They usually move considerably faster than a full emergency department. They do not handle chest pain, stroke symptoms, major trauma, or anything else immediately life-threatening; those must go to an ER.',
    typicalWait: '1–3 hours',
    cost: 'Covered by AHCIP',
    suitableFor: ['urgent', 'semi-urgent'],
    availability: 'Varies by site; see the live board',
    priority: 4,
  },
  {
    id: 'family-doctor',
    name: 'Your family doctor or a walk-in clinic',
    summary: 'Best for anything that can safely wait for an appointment.',
    detail:
      'If you have a family physician, their office is almost always faster and better than an emergency department for non-urgent problems, because they know your history. Many clinics hold same-day slots. If you do not have a family doctor, Primary Care Alberta can help you find one, and walk-in clinics take patients without a regular provider.',
    typicalWait: 'Same day to a few days',
    cost: 'Covered by AHCIP',
    url: 'https://www.primarycarealberta.ca/',
    suitableFor: ['semi-urgent', 'non-urgent'],
    availability: 'Clinic hours',
    priority: 5,
  },
  {
    id: 'mental-health-crisis',
    name: 'Mental health crisis support',
    summary: 'Free, immediate, confidential help — by phone or text, 24/7.',
    detail:
      'For suicidal thoughts, self-harm, or a mental health crisis. The 988 Suicide Crisis Helpline is available across Canada by call or text, 24/7. Alberta’s Mental Health Help Line offers 24/7 support and referral. In Edmonton, Access 24/7 provides assessment, referral, and crisis support. If someone is in immediate physical danger, call 911.',
    typicalWait: 'Immediate',
    cost: 'Free',
    phone: '988',
    suitableFor: ['emergency', 'urgent', 'semi-urgent', 'advice'],
    availability: '24/7',
    priority: 6,
  },
  {
    id: 'poison-drug-info',
    name: 'Poison & Drug Information Service (PADIS)',
    summary: 'Call before going anywhere if you suspect a poisoning or overdose.',
    detail:
      'PADIS gives immediate expert guidance on poisonings, medication errors, and overdoses, 24/7. Many exposures can be managed safely at home under their direction, and when a hospital is needed they tell you exactly where to go and what to bring. If the person is unconscious, seizing, or not breathing, call 911 first.',
    typicalWait: 'Immediate',
    cost: 'Free',
    phone: '1-800-332-1414',
    suitableFor: ['emergency', 'urgent', 'advice'],
    availability: '24/7',
    priority: 7,
  },
  {
    id: 'kids-help-phone',
    name: 'Kids Help Phone',
    summary: 'Counselling and support for young people, 24/7.',
    detail:
      'Free, confidential support for children and youth by phone, text, or live chat. Text CONNECT to 686868, or call 1-800-668-6868.',
    typicalWait: 'Immediate',
    cost: 'Free',
    phone: '1-800-668-6868',
    url: 'https://kidshelpphone.ca/',
    suitableFor: ['semi-urgent', 'non-urgent', 'advice'],
    availability: '24/7',
    priority: 8,
  },
];

/** Crisis numbers surfaced prominently wherever a user might need them fast. */
export const CRISIS_CONTACTS = [
  { label: 'Life-threatening emergency', value: '911', href: 'tel:911' },
  { label: 'Suicide Crisis Helpline (call or text)', value: '988', href: 'tel:988' },
  {
    label: 'Alberta Mental Health Help Line',
    value: '1-877-303-2642',
    href: 'tel:18773032642',
  },
  {
    label: 'Access 24/7 (Edmonton mental health)',
    value: '780-424-2424',
    href: 'tel:7804242424',
  },
  { label: 'Poison & Drug Information (PADIS)', value: '1-800-332-1414', href: 'tel:18003321414' },
  { label: 'Health Link nurse advice', value: '811', href: 'tel:811' },
] as const;

export function optionsForLevel(level: CareLevel): CareOption[] {
  return CARE_OPTIONS.filter((option) => option.suitableFor.includes(level)).sort(
    (a, b) => a.priority - b.priority,
  );
}

export function getCareOption(id: string): CareOption | undefined {
  return CARE_OPTIONS.find((option) => option.id === id);
}
