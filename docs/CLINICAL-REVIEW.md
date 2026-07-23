# Clinical Review Record

The triage logic in this product tells frightened people where to seek medical
care. It must be reviewed by a clinician, and that review must be recorded.

---

## Review status

| Version | Date | Reviewer | Credential | Outcome |
|---|---|---|---|---|
| 1.0 | — | **NOT YET REVIEWED** | — | Pending |

> **Current state: the triage content has not been clinically reviewed.**
>
> It was written conservatively, follows the standard public-facing emergency
> warning signs used by Canadian health authorities, and is engineered to fail
> toward higher acuity. That is not the same as clinical review. Complete this
> before any public promotion.

---

## What must be reviewed

| File | Contents |
|---|---|
| `app/src/lib/triage/engine.ts` | Red-flag lists, routing logic, escalation rules, all user-facing outcome wording |
| `app/src/lib/care-options.ts` | Care option descriptions, what each handles, phone numbers |

---

## Design principles the reviewer should verify

The tool is built to be wrong in one direction only. Ask the reviewer to confirm
each of these actually holds:

1. **Red flags short-circuit everything.** Selecting any stage-1 flag returns "Call
   911" immediately, before the rest of the form is even completed, and suppresses
   the hospital list so nothing competes with dialling.
2. **Uncertainty escalates.** "I'm not sure how serious this is" always raises the
   outcome level. There is no path where hesitation lowers acuity.
3. **Modifiers only ever raise acuity.** Pregnancy, infancy, and age 75+ can move a
   result up. Nothing moves it down.
4. **The floor is never "do nothing."** The lowest possible outcome still directs
   the user to a pharmacist, their doctor, or 811, and still tells them to return
   if anything worsens.
5. **Nothing diagnoses.** Every output names a *destination*, never a condition.

---

## Questions to put to the reviewer

1. **Is any red flag missing from the 911 list?** This is the most important
   question in this document.
2. Is anything on the ER list that belongs on the 911 list?
3. Is any wording ambiguous to a frightened non-clinician at 2am?
4. Is the infant threshold correct? Currently: **any fever in an infant under 3
   months → emergency department**.
5. Is the adult-only exclusion correct? We hide departments whose AHS note matches
   a pattern like "for patients 15 and older" when the patient is a child.
6. Does the pediatric preference behave sensibly? A children's ER wins ties within
   a 20-minute band; beyond that, total time wins.
7. Are the care-option descriptions accurate about what each service handles —
   particularly the scope of pharmacist prescribing?
8. Does anything read as medical advice rather than navigation?

---

## Current triage content

### Stage 1 — Call 911 immediately

- Unconscious, unresponsive, or very hard to wake
- Not breathing, choking, or struggling to breathe
- Chest pain, pressure, or tightness
- Sudden face drooping, arm weakness, or trouble speaking
- Heavy bleeding that will not stop with firm pressure
- An active seizure, or a first-ever seizure
- Severe allergic reaction
- Major injury — a serious fall, a car crash, or a deep wound
- Suspected overdose or poisoning
- In immediate danger of harming themselves or someone else

### Stage 2 — Emergency department

- A baby under 3 months old with any fever *(infants only)*
- A child who is unusually drowsy, floppy, or will not drink *(infants and children)*
- Fever with a stiff neck, or a rash that does not fade when pressed
- A head injury with vomiting, confusion, or loss of consciousness
- Severe pain that is unbearable or rapidly getting worse
- Severe abdominal pain, especially with fever or vomiting blood
- A limb that is visibly deformed, or a bone through the skin
- Pregnancy with bleeding, severe pain, or reduced fetal movement
- Cannot keep any fluids down, or has not passed urine all day
- Thoughts of suicide or self-harm without immediate danger

### Stage 3 — Urgent care, pharmacist, or family doctor

- A possible sprain or broken bone that you can still move
- A cut that may need stitches
- A fever lasting more than three days
- A wound or skin area that is red, hot, swollen, or oozing
- Persistent vomiting or diarrhea, but keeping some fluids down
- Significant ear pain, sore throat, or sinus pain
- Burning when passing urine, or needing to go constantly
- A red, painful, or discharging eye
- A new rash that is spreading or uncomfortable
- Ran out of an essential medication, or need a refill

### Escalation rules

| Condition | Effect |
|---|---|
| Any stage-1 flag | → Call 911, immediately, list suppressed |
| Any stage-2 flag | → Emergency department |
| "Not sure" + any stage-3 flag | → Emergency department |
| Pregnancy + any stage-3 flag | → Emergency department |
| Infant + any stage-3 flag | → Emergency department |
| Age 75+ with two or more stage-3 flags | → Emergency department |
| "Not sure" alone | → Call 811 |
| Stage-3 flags only | → Urgent care / pharmacist / doctor |
| Nothing selected | → Alternatives, plus "come back if it changes" |

---

## After review

1. Apply every change the reviewer asks for. Do not negotiate on clinical content.
2. Add a row to the table at the top: version, date, reviewer name, credential,
   outcome.
3. Re-run the test suite. If a change breaks a safety test, the *test* was encoding
   the wrong assumption — update it deliberately and note why.
4. Consider crediting the reviewer publicly, with their permission. It is a genuine
   trust signal.

**Re-review annually, and on any change to triage content.**
