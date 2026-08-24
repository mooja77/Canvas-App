// Which intercoder-agreement coefficient applies for a given number of coders.
//
// This module used to promise **Cohen's κ for exactly two coders** and
// Krippendorff's α for three or more. The server has only ever implemented one
// coefficient: `POST /canvas/:id/intercoder/agreement` calls
// `computeKrippendorffAlpha` unconditionally and returns
// `method: "Krippendorff's α"` for every request
// (apps/backend/src/routes/codingRoutes.ts:765).
//
// So for the two-coder case — the commonest one by far — the panel named a
// statistic that was never computed, and a researcher could carry "Cohen's κ"
// into a methods section on the strength of it. The number itself was correct;
// only the name was wrong. Naming the coefficient you actually ran is the whole
// point of a reliability report.
//
// α is not a fallback here: for two coders with nominal data it is a proper
// generalisation of κ, and unlike κ it handles missing judgements. There is no
// need to implement Cohen's κ to make this honest — only to stop claiming it.

export type AgreementMethod = 'krippendorff';

export interface AgreementChoice {
  canCompute: boolean;
  method: AgreementMethod | null;
  label: string;
}

export function chooseAgreementMethod(nCoders: number): AgreementChoice {
  if (nCoders < 2) {
    return { canCompute: false, method: null, label: 'Select at least 2 coders' };
  }
  return { canCompute: true, method: 'krippendorff', label: "Krippendorff's α" };
}
