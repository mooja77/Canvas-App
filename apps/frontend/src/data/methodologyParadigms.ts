/**
 * Methodology paradigms for the guided wizard.
 *
 * Each paradigm describes a recognized qualitative approach and breaks its
 * workflow into ordered steps, each mapped to concrete QualCanvas actions.
 * The wizard is guidance, not enforcement — researchers can follow, skip, or
 * dismiss it. Content is intentionally method-aware but not prescriptive about
 * findings.
 */

export interface ParadigmStep {
  /** Short step title (e.g. "Generate initial codes"). */
  title: string;
  /** What this stage means methodologically (1-3 sentences). */
  guidance: string;
  /** How to do it in QualCanvas (references real features). */
  inCanvas: string;
}

export interface MethodologyParadigm {
  key: string;
  name: string;
  /** One-line summary shown on the selection screen. */
  tagline: string;
  /** When a researcher would choose this approach. */
  bestFor: string;
  /** Whether intercoder-reliability metrics are conventionally appropriate. */
  icrNote: string;
  steps: ParadigmStep[];
}

export const METHODOLOGY_PARADIGMS: MethodologyParadigm[] = [
  {
    key: 'reflexive-ta',
    name: 'Reflexive Thematic Analysis',
    tagline: 'Braun & Clarke — flexible, interpretive theme development.',
    bestFor: 'Most interview/focus-group studies where you build themes inductively and value researcher subjectivity.',
    icrNote:
      'Intercoder reliability is generally NOT appropriate — coding divergence reflects interpretation, not error. Keep ICR off.',
    steps: [
      {
        title: '1. Familiarize yourself with the data',
        guidance: 'Read and re-read each transcript before coding. Note early impressions; immersion comes first.',
        inCanvas: 'Open each transcript node and read it. Drop a Memo node for first impressions per transcript.',
      },
      {
        title: '2. Generate initial codes',
        guidance:
          'Code freely and inductively across the whole dataset. Do not force a hierarchy yet — capture anything analytically interesting.',
        inCanvas:
          'Select text in a transcript and apply codes via the Quick Code popover. Let codes proliferate; you will organize later.',
      },
      {
        title: '3. Construct candidate themes',
        guidance:
          'Cluster related codes into broader patterns of shared meaning. Themes are actively constructed, not "found".',
        inCanvas:
          'Drag related code nodes together and wrap them in a Group, then "collapse as theme". Rename the group to your candidate theme.',
      },
      {
        title: '4. Review themes',
        guidance:
          'Check each theme against its codes and the full dataset. Split, merge, or discard themes that do not cohere.',
        inCanvas:
          'Expand theme groups to inspect member codes and their coded segments; regroup as needed. Use the Co-occurrence / Matrix nodes to sense-check.',
      },
      {
        title: '5. Define & name themes',
        guidance: 'Write a crisp definition for each theme — its scope, what it captures, and what it excludes.',
        inCanvas: 'Add a Memo node beside each theme with its definition. Keep names evocative and precise.',
      },
      {
        title: '6. Write up (reflexively)',
        guidance: 'Produce the analytic narrative, weaving quotes with interpretation and your reflexive positioning.',
        inCanvas:
          'Use Presentation mode to walk themes with top quotes; export an AI disclosure if you used AI assistance.',
      },
    ],
  },
  {
    key: 'grounded-theory',
    name: 'Grounded Theory',
    tagline: 'Build theory from data via iterative, comparative coding.',
    bestFor: 'Studies aiming to develop a theory or process model grounded in the data, collecting data iteratively.',
    icrNote: 'ICR is usually not the goal; rigor comes from constant comparison, memoing, and theoretical saturation.',
    steps: [
      {
        title: '1. Open coding',
        guidance: 'Code line-by-line, staying close to the data with descriptive, often in-vivo codes.',
        inCanvas: 'Use In-Vivo coding in the Quick Code popover to capture participants’ own words as codes.',
      },
      {
        title: '2. Constant comparison',
        guidance:
          'Continuously compare new segments to existing codes — refine, merge, and split as concepts stabilize.',
        inCanvas:
          'Run a Coding Query or Co-occurrence node to compare how a code is used across transcripts; merge codes that overlap.',
      },
      {
        title: '3. Axial coding',
        guidance:
          'Relate categories to each other — conditions, actions, consequences — to assemble a conceptual structure.',
        inCanvas:
          'Draw relation edges between code nodes (e.g. "leads to", "is a condition for") to model the emerging structure.',
      },
      {
        title: '4. Theoretical sampling',
        guidance:
          'Let gaps in the emerging theory drive what data you collect next — sample to develop categories, not for representativeness.',
        inCanvas:
          'Add a Memo flagging the theoretical gap, then import the new transcript(s) you collected to address it.',
      },
      {
        title: '5. Selective coding & core category',
        guidance: 'Identify a core category that integrates the others into a coherent theory.',
        inCanvas: 'Promote the integrating code to a central node and connect categories to it with relation edges.',
      },
      {
        title: '6. Toward saturation',
        guidance: 'Continue until new data yields no new properties or categories — theoretical saturation.',
        inCanvas:
          'Watch the Statistics node: when new transcripts stop adding new codes/coverage, you are approaching saturation. Record the judgment in a Memo.',
      },
    ],
  },
  {
    key: 'framework',
    name: 'Framework Analysis',
    tagline: 'Matrix-based analysis — strong for applied health & policy research.',
    bestFor:
      'Applied/policy/health studies with a team and a defined set of questions; produces a case-by-theme matrix.',
    icrNote: 'A shared, well-defined framework (codebook) matters; ICR can be used when coding deductively.',
    steps: [
      {
        title: '1. Familiarization',
        guidance: 'Immerse in a subset of transcripts to grasp range and depth before fixing the framework.',
        inCanvas: 'Read several transcript nodes; jot a Memo of recurring topics.',
      },
      {
        title: '2. Identify a thematic framework',
        guidance: 'Agree a set of codes/categories (a priori from aims + emergent from data). This is your codebook.',
        inCanvas: 'Create your code nodes up front and organize them with the Hierarchy panel; this is your framework.',
      },
      {
        title: '3. Indexing (coding)',
        guidance: 'Systematically apply the framework across all transcripts.',
        inCanvas:
          'Code each transcript against the framework codes. For teams, use blind coding + the Intercoder panel on a subset.',
      },
      {
        title: '4. Charting (the matrix)',
        guidance: 'Summarize data by case (rows) and theme (columns) — the framework matrix.',
        inCanvas: 'Add a Matrix (framework) computed node: cases × codes with the supporting excerpts in each cell.',
      },
      {
        title: '5. Mapping & interpretation',
        guidance: 'Compare across cases, find associations, and interpret patterns against your questions.',
        inCanvas: 'Use Cross-case analysis and the Comparison node to read patterns across the matrix.',
      },
    ],
  },
  {
    key: 'ipa',
    name: 'Interpretative Phenomenological Analysis (IPA)',
    tagline: 'Deep, idiographic analysis of lived experience.',
    bestFor: 'Small, homogeneous samples where you analyze each case in depth before any cross-case comparison.',
    icrNote: 'ICR is inappropriate — IPA is interpretive and idiographic. Analyze one case fully before the next.',
    steps: [
      {
        title: '1. Read & re-read one case',
        guidance: 'Work with a single transcript at a time. Immerse fully before moving on — do not compare cases yet.',
        inCanvas: 'Focus on one transcript node. Resist coding across transcripts until this case is complete.',
      },
      {
        title: '2. Initial noting',
        guidance: 'Annotate descriptive, linguistic, and conceptual observations close to the text.',
        inCanvas: 'Apply codes and use per-segment annotations to capture exploratory notes on this case.',
      },
      {
        title: '3. Develop emergent themes (within case)',
        guidance: 'Turn your notes into concise experiential themes for this participant.',
        inCanvas: 'Group this case’s codes into emergent-theme groups; keep them scoped to this case.',
      },
      {
        title: '4. Connect into superordinate themes',
        guidance: 'Cluster emergent themes into superordinate themes for the case.',
        inCanvas: 'Nest theme groups to reflect superordinate/subordinate structure.',
      },
      {
        title: '5. Next case, then cross-case',
        guidance: 'Repeat fully for each participant. Only then look for patterns and divergences across cases.',
        inCanvas:
          'Create a separate region/group per case; once all are done, use Comparison to surface shared and divergent themes.',
      },
    ],
  },
  {
    key: 'content-analysis',
    name: 'Qualitative Content Analysis',
    tagline: 'Systematic coding of manifest and latent content.',
    bestFor: 'Communication/health research needing systematic, often quantifiable, categorization of content.',
    icrNote: 'For deductive/quantitative content analysis, ICR (Cohen’s kappa / Krippendorff’s alpha) is expected.',
    steps: [
      {
        title: '1. Define the unit of analysis',
        guidance: 'Decide what you code — words, sentences, paragraphs, or whole responses.',
        inCanvas: 'Choose a consistent selection grain when coding (e.g. paragraph-level via the popover).',
      },
      {
        title: '2. Develop the coding scheme',
        guidance: 'Build categories deductively (from theory) and/or inductively (from data), with clear definitions.',
        inCanvas: 'Create code nodes with definitions in attached Memos; organize with the Hierarchy panel.',
      },
      {
        title: '3. Code manifest & latent content',
        guidance: 'Apply categories — manifest (explicit) and, where relevant, latent (interpretive) content.',
        inCanvas: 'Code systematically across transcripts; AI suggestions can speed first-pass coding (review each).',
      },
      {
        title: '4. Check reliability',
        guidance: 'For deductive schemes, have a second coder code a subset and compute agreement.',
        inCanvas:
          'Use the Intercoder Reliability panel (Cohen’s kappa / Krippendorff’s alpha) on a 15–20% double-coded subset.',
      },
      {
        title: '5. Quantify & interpret',
        guidance: 'Report category frequencies and interpret patterns relative to your questions.',
        inCanvas: 'Use Statistics and Word Cloud nodes for frequencies; interpret alongside exemplar quotes.',
      },
    ],
  },
  {
    key: 'discourse-narrative',
    name: 'Discourse / Narrative Analysis',
    tagline: 'Analyze language, rhetoric, and the structure of accounts.',
    bestFor: 'Media, policy, education, oral-history, and organizational research where how something is said matters.',
    icrNote: 'ICR is not appropriate. Sequence and context of the text must be preserved.',
    steps: [
      {
        title: '1. Select and contextualize texts',
        guidance: 'Choose texts and document their context (speaker, setting, audience).',
        inCanvas: 'Import transcripts; record speaker/context in each transcript’s metadata or a Memo.',
      },
      {
        title: '2. Read for structure & rhetoric',
        guidance: 'Attend to how accounts are built — narrative arc, positioning, rhetorical moves.',
        inCanvas: 'Code segments for discursive/structural features; keep the text in original order.',
      },
      {
        title: '3. Annotate linguistic features',
        guidance: 'Mark devices: metaphors, pronoun use, agency, modality, turn-taking.',
        inCanvas: 'Use per-segment annotations to tag specific linguistic devices alongside codes.',
      },
      {
        title: '4. Interpret in context',
        guidance: 'Read patterns against social/institutional context; preserve the whole account, not just fragments.',
        inCanvas: 'Avoid fragmenting the narrative — keep transcripts intact and reference sequence when interpreting.',
      },
    ],
  },
  {
    key: 'phenomenology',
    name: 'Descriptive Phenomenology',
    tagline: 'Husserlian — describe the essence of lived experience.',
    bestFor: 'Studies seeking the structure/essence of an experience, setting aside prior assumptions.',
    icrNote: 'ICR is inappropriate. Bracket (epoché) your assumptions before and during analysis.',
    steps: [
      {
        title: '1. Bracketing (epoché)',
        guidance: 'Set aside prior theories and assumptions to meet the phenomenon freshly.',
        inCanvas: 'Write a bracketing Memo documenting your pre-understandings before coding.',
      },
      {
        title: '2. Identify meaning units',
        guidance: 'Demarcate units of meaning within each contiguous account.',
        inCanvas: 'Code meaning units in sequence within each transcript; keep them anchored to the text.',
      },
      {
        title: '3. Cluster into themes',
        guidance: 'Group meaning units into themes that capture the experience.',
        inCanvas: 'Group related meaning-unit codes into theme groups.',
      },
      {
        title: '4. Textural & structural description',
        guidance: 'Describe what was experienced (textural) and how (structural).',
        inCanvas: 'Capture textural and structural descriptions in paired Memos per theme.',
      },
      {
        title: '5. Synthesize the essence',
        guidance: 'Integrate descriptions into a statement of the experience’s essence.',
        inCanvas: 'Add a central Memo synthesizing the essence; link it to the contributing themes.',
      },
    ],
  },
  {
    key: 'mixed-methods',
    name: 'Mixed Methods',
    tagline: 'Integrate qualitative themes with quantitative data.',
    bestFor: 'Studies combining qual and quant, where integration (not just side-by-side reporting) is the goal.',
    icrNote: 'Use ICR if the qualitative strand is deductive; the priority is genuine integration.',
    steps: [
      {
        title: '1. Plan the integration',
        guidance: 'Decide how strands connect — sequential, concurrent, embedded — and where they integrate.',
        inCanvas: 'Add a Memo stating your integration design and the point(s) of integration.',
      },
      {
        title: '2. Code the qualitative strand',
        guidance: 'Develop codes/themes as you would in your chosen qualitative approach.',
        inCanvas: 'Code transcripts and build themes via grouping (see Reflexive TA / Framework steps).',
      },
      {
        title: '3. Attach quantitative attributes',
        guidance: 'Bring in case-level variables (demographics, scores) to enable comparison.',
        inCanvas: 'Use Cases with typed attributes; assign transcripts to cases for subgroup comparison.',
      },
      {
        title: '4. Build a joint display',
        guidance: 'Place qualitative themes alongside quantitative results to read them together.',
        inCanvas:
          'Use the Matrix (case × theme) and Comparison nodes; navigate from a quantitative pattern to the verbatim that explains it.',
      },
      {
        title: '5. Integrate findings',
        guidance: 'Draw integrated inferences (meta-inferences) that neither strand yields alone.',
        inCanvas: 'Summarize integrated findings in a Memo; export results for your mixed-methods write-up.',
      },
    ],
  },
];

export function getParadigm(key: string): MethodologyParadigm | undefined {
  return METHODOLOGY_PARADIGMS.find((p) => p.key === key);
}

// Whether intercoder-reliability metrics are conventionally appropriate for a
// paradigm. Interpretivist approaches (reflexive TA, IPA, phenomenology,
// discourse/narrative) treat coder divergence as legitimate interpretation,
// not error, so ICR is "inappropriate". Deductive content analysis "expects"
// it; the rest are "optional". Used to surface guidance on the ICR panel.
export type IcrStance = 'inappropriate' | 'optional' | 'expected';

const ICR_STANCE: Record<string, IcrStance> = {
  'reflexive-ta': 'inappropriate',
  'grounded-theory': 'optional',
  framework: 'optional',
  ipa: 'inappropriate',
  'content-analysis': 'expected',
  'discourse-narrative': 'inappropriate',
  phenomenology: 'inappropriate',
  'mixed-methods': 'optional',
};

export function getIcrStance(key: string | null | undefined): IcrStance | null {
  return key ? (ICR_STANCE[key] ?? null) : null;
}
