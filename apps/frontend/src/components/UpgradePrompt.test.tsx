import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { PLAN_LIMITS, type PlanTier } from '@qualcanvas/shared';
import UpgradePrompt from './UpgradePrompt';

const TIERS: PlanTier[] = ['free', 'student', 'pro', 'team'];

function fire(error: string) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('plan-limit-exceeded', {
        detail: { error, code: 'PLAN_LIMIT_EXCEEDED', limit: 'maxCanvases', current: 2, max: 2, upgrade: true },
      }),
    );
  });
}

function show(error = 'You are using all 2 canvases included in the Free plan.') {
  render(
    <MemoryRouter>
      <UpgradePrompt />
    </MemoryRouter>,
  );
  fire(error);
}

beforeEach(() => {
  // The component suppresses itself for 5 minutes after each showing.
  sessionStorage.clear();
});

describe('UpgradePrompt', () => {
  it("repeats the server's reason verbatim", () => {
    show('cooccurrence analysis is available on the Student, Pro, and Team plans.');
    expect(
      screen.getByText('cooccurrence analysis is available on the Student, Pro, and Team plans.'),
    ).toBeInTheDocument();
  });

  it('does not upsell Pro for what Student includes', () => {
    show();
    const dialog = screen.getByRole('alertdialog');
    // The old copy read "Upgrade to Pro from $12/mo on annual billing" and
    // never mentioned Student, so a verified .edu user was quoted $15 for
    // features Student has in full (see PLAN_LIMITS.student below).
    expect(dialog).not.toHaveTextContent(/^Upgrade to Pro from/m);
    expect(dialog).toHaveTextContent(/\$5\/mo/);
    expect(dialog).toHaveTextContent(/Student/);
  });

  it('attributes each capability to the cheapest tier that actually has it', () => {
    show();
    const dialog = screen.getByRole('alertdialog');

    const analysisCount = PLAN_LIMITS.student.allowedAnalysisTypes.length;
    expect(dialog).toHaveTextContent(new RegExp(`All ${analysisCount} analysis tools`));

    // "Student and up" is only honest if Student really has these.
    expect(PLAN_LIMITS.student.autoCodeEnabled).toBe(true);
    expect(PLAN_LIMITS.student.ethicsEnabled).toBe(true);
    expect(PLAN_LIMITS.student.casesEnabled).toBe(true);
    for (const fmt of ['csv', 'png', 'html', 'md', 'docx', 'xlsx', 'qdpx']) {
      expect(PLAN_LIMITS.student.allowedExportFormats).toContain(fmt);
    }

    // "Unlimited canvases — Pro and Team".
    expect(TIERS.filter((t) => PLAN_LIMITS[t].maxCanvases === Infinity)).toEqual(['pro', 'team']);
    expect(dialog).toHaveTextContent(/Unlimited canvases/);
    // "Intercoder agreement — Team".
    expect(TIERS.filter((t) => PLAN_LIMITS[t].intercoderEnabled)).toEqual(['team']);
    expect(dialog).toHaveTextContent(/Intercoder agreement/);
  });

  it('offers a route to the plans', () => {
    show();
    expect(screen.getByRole('button', { name: 'View Plans' })).toBeInTheDocument();
  });
});
