import { describe, expect, it } from 'vitest';
import { TRIAGE_STAGES, triage, type TriageInput } from './engine';

const base: TriageInput = { ageBand: 'adult', selected: [] };

describe('triage safety guarantees', () => {
  it('sends any stage-1 red flag straight to 911', () => {
    for (const flag of TRIAGE_STAGES[0].flags) {
      const outcome = triage({ ...base, selected: [flag.id] });
      expect(outcome.level, `flag ${flag.id} must trigger 911`).toBe('call-911');
      expect(outcome.phone).toBe('911');
      // We must not distract someone with a hospital list when they should be
      // dialling an ambulance.
      expect(outcome.showFacilities).toBe(false);
    }
  });

  it('never lets a lower-severity selection override a 911 flag', () => {
    const outcome = triage({
      ...base,
      selected: ['ear-throat-pain', 'medication-issue', 'chest-pain', 'rash'],
    });
    expect(outcome.level).toBe('call-911');
  });

  it('never lets an urgent-care selection override an ER flag', () => {
    const outcome = triage({ ...base, selected: ['rash', 'head-injury', 'urinary'] });
    expect(outcome.level).toBe('emergency');
  });

  it('routes every stage-2 flag to at least emergency level', () => {
    for (const flag of TRIAGE_STAGES[1].flags) {
      const ageBand = flag.ageBands?.[0] ?? 'adult';
      const outcome = triage({ ...base, ageBand, selected: [flag.id] });
      expect(['call-911', 'emergency'], `flag ${flag.id}`).toContain(outcome.level);
    }
  });

  it('escalates when the user says they are unsure', () => {
    const withoutDoubt = triage({ ...base, selected: ['ear-throat-pain'] });
    const withDoubt = triage({ ...base, selected: ['ear-throat-pain'], unsure: true });

    expect(withoutDoubt.level).toBe('urgent-care');
    expect(withDoubt.level).toBe('emergency');
  });

  it('points an unsure user with no symptoms at the nurse line, never at nothing', () => {
    const outcome = triage({ ...base, unsure: true });
    expect(outcome.phone).toBe('811');
    expect(outcome.level).toBe('urgent-care');
  });

  it('escalates urgent symptoms during pregnancy', () => {
    expect(triage({ ...base, selected: ['vomiting-diarrhea'] }).level).toBe('urgent-care');
    expect(triage({ ...base, selected: ['vomiting-diarrhea'], pregnant: true }).level).toBe(
      'emergency',
    );
  });

  it('escalates urgent symptoms in an infant', () => {
    expect(triage({ ...base, ageBand: 'adult', selected: ['moderate-fever'] }).level).toBe(
      'urgent-care',
    );
    expect(triage({ ...base, ageBand: 'infant', selected: ['moderate-fever'] }).level).toBe(
      'emergency',
    );
  });

  it('escalates multiple concurrent symptoms in a senior', () => {
    expect(
      triage({ ...base, ageBand: 'senior', selected: ['urinary', 'moderate-fever'] }).level,
    ).toBe('emergency');
    // A single symptom should not escalate, or the tool cries wolf constantly.
    expect(triage({ ...base, ageBand: 'senior', selected: ['urinary'] }).level).toBe('urgent-care');
  });

  it('treats fever in a newborn as an emergency', () => {
    const outcome = triage({ ...base, ageBand: 'infant', selected: ['infant-fever'] });
    expect(outcome.level).toBe('emergency');
    expect(outcome.childPatient).toBe(true);
  });

  it('marks child patients so the board can prefer pediatric sites', () => {
    for (const ageBand of ['infant', 'child'] as const) {
      expect(triage({ ...base, ageBand, selected: ['head-injury'] }).childPatient).toBe(true);
    }
    for (const ageBand of ['adult', 'senior'] as const) {
      expect(triage({ ...base, ageBand, selected: ['head-injury'] }).childPatient).toBe(false);
    }
  });

  it('still offers a route to help when nothing is selected', () => {
    const outcome = triage(base);
    expect(outcome.level).toBe('self-care');
    // The message must never read as "you are fine, do nothing".
    expect(outcome.message).toMatch(/811|pharmacist|doctor/i);
    expect(outcome.message).toMatch(/worse|911/i);
  });

  it('explains its reasoning back to the user', () => {
    const outcome = triage({ ...base, selected: ['chest-pain'] });
    expect(outcome.reasons.length).toBeGreaterThan(0);
    expect(outcome.reasons[0]).toMatch(/chest/i);
  });

  it('ignores unrecognized flag ids rather than failing open', () => {
    const outcome = triage({ ...base, selected: ['not-a-real-flag'] });
    expect(outcome.level).toBe('self-care');
  });
});

describe('triage content integrity', () => {
  it('has unique flag ids across all stages', () => {
    const ids = TRIAGE_STAGES.flatMap((s) => s.flags.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders stages from most to least severe', () => {
    expect(TRIAGE_STAGES.map((s) => s.level)).toEqual([
      'call-911',
      'emergency',
      'urgent-care',
    ]);
  });

  it('gives every flag a plain-language label', () => {
    for (const stage of TRIAGE_STAGES) {
      for (const flag of stage.flags) {
        expect(flag.label.length).toBeGreaterThan(10);
        // No clinical jargon that a panicking parent would have to look up.
        expect(flag.label).not.toMatch(/dyspnea|syncope|myocardial|pyrexia/i);
      }
    }
  });
});
