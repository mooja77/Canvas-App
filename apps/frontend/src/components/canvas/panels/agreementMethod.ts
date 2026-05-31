// Which intercoder-agreement coefficient applies for a given number of coders.
//
// Cohen's κ is defined for exactly two raters. For three or more, Krippendorff's
// α is the appropriate generalisation (Fleiss' κ and Light's κ have known
// instabilities — see the methodology chapter). Fewer than two coders cannot
// produce an agreement statistic at all.

export type AgreementMethod = 'cohen' | 'krippendorff';

export interface AgreementChoice {
  canCompute: boolean;
  method: AgreementMethod | null;
  label: string;
}

export function chooseAgreementMethod(nCoders: number): AgreementChoice {
  if (nCoders < 2) {
    return { canCompute: false, method: null, label: 'Select at least 2 coders' };
  }
  if (nCoders === 2) {
    return { canCompute: true, method: 'cohen', label: "Cohen's κ" };
  }
  return { canCompute: true, method: 'krippendorff', label: "Krippendorff's α" };
}
