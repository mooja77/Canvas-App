export interface CourseQuizQuestion {
  id: string;
  prompt: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
}

export interface CourseModule {
  id: string;
  number: number;
  title: string;
  durationMinutes: number;
  summary: string;
  videoIds: readonly string[];
  outcomes: readonly string[];
  steps: readonly string[];
  exerciseTitle: string;
  exercisePrompt: string;
  quiz: readonly CourseQuizQuestion[];
}

export const COURSE_MODULES: readonly CourseModule[] = [
  {
    id: 'prepare-study',
    number: 1,
    title: 'Prepare your study and protect participant privacy',
    durationMinutes: 15,
    summary:
      'Set up a clean canvas, de-identify interview transcripts before upload, and organise files so every quote traces back to its source.',
    videoIds: ['01', '02', '03'],
    outcomes: [
      'Create a structured project canvas with clear naming.',
      'Remove direct identifiers before importing transcripts.',
      'Organise interviews and case metadata so later comparison stays accurate.',
    ],
    steps: [
      'Open a new canvas and name it after your research question and study phase.',
      'Replace participant names, workplaces, and dates with consistent pseudonyms (for example, P01, Clinic A) before importing.',
      'Import one transcript at a time and check speaker turns so every coded passage keeps clear context.',
      'Record your anonymisation rules in a project memo on day one so collaborators follow the same conventions.',
    ],
    exerciseTitle: 'Practice: De-identify a synthetic interview excerpt',
    exercisePrompt:
      'Take a short synthetic interview transcript, replace two identifying details with neutral labels, import it into a practice canvas, and write a three-line setup memo describing your naming convention.',
    quiz: [
      {
        id: 'm1-q1',
        prompt: 'When should direct participant identifiers be removed from an interview transcript?',
        options: [
          'Before importing the transcript into your analysis workspace',
          'Only after writing the final dissertation or report',
          'Never, because pseudonyms make coding impossible',
        ],
        correctIndex: 0,
        explanation:
          'Removing direct identifiers before import keeps sensitive personal details out of shared workspaces and exports from the start.',
      },
      {
        id: 'm1-q2',
        prompt: 'Why write a short setup memo at the start of a project?',
        options: [
          'To replace the need for a codebook',
          'To record naming, anonymisation, and early scope decisions while they are fresh',
          'To automatically generate themes from raw text',
        ],
        correctIndex: 1,
        explanation:
          'Early memos preserve your methodological decisions so you can explain them clearly to supervisors, reviewers, or teammates later.',
      },
    ],
  },
  {
    id: 'codebook-and-coding',
    number: 2,
    title: 'Build a codebook and code your first passages',
    durationMinutes: 15,
    summary:
      'Move from raw transcript lines to clear, well-defined codes that capture meaning without drowning in duplicate labels.',
    videoIds: ['04'],
    outcomes: [
      'Write a plain-language definition for each code.',
      'Apply codes to meaningful passages while keeping surrounding context.',
      'Spot when a code is too broad and split it cleanly.',
    ],
    steps: [
      'Read the first transcript through once without coding so you see the full arc of the interview.',
      'Create 4 to 6 starter codes with clear names and a one-sentence inclusion rule.',
      'Highlight a complete thought (usually one to three sentences) rather than single isolated words.',
      'Review your first 10 coded passages and merge or tighten any codes that overlap.',
    ],
    exerciseTitle: 'Practice: Code five passages with clear inclusion rules',
    exercisePrompt:
      'Create three codes in a practice canvas, write a one-sentence definition for each, and apply them to five passages in a synthetic transcript. Check that every passage still makes sense when read on its own.',
    quiz: [
      {
        id: 'm2-q1',
        prompt: 'How much text should a coded excerpt usually include?',
        options: [
          'A single word with no surrounding sentence',
          'Enough of the sentence or paragraph so the quote still makes sense out of context',
          'The entire 45-minute transcript as one excerpt',
        ],
        correctIndex: 1,
        explanation:
          'Coding a complete thought ensures that when you review excerpts in a theme view or report, the meaning is clear without reopening the whole file.',
      },
      {
        id: 'm2-q2',
        prompt: 'What is the main purpose of writing a one-sentence definition for every code?',
        options: [
          'To keep coding consistent across transcripts and across team members',
          'To increase the word count of the project',
          'To lock the codebook so it can never be revised',
        ],
        correctIndex: 0,
        explanation:
          'Clear definitions reduce drift over time and give teammates a shared rule for when to apply or skip a code.',
      },
    ],
  },
  {
    id: 'themes-and-memos',
    number: 3,
    title: 'Group codes into themes and write analytical memos',
    durationMinutes: 15,
    summary:
      'Turn a flat list of codes into a coherent thematic structure, link related concepts, and document your analytical reasoning.',
    videoIds: ['05', '06'],
    outcomes: [
      'Organise codes into parent themes and sub-codes.',
      'Connect related codes with explicit semantic relationships.',
      'Write analytical memos that bridge raw quotes and findings.',
    ],
    steps: [
      'Arrange related codes near each other on the canvas and look for shared patterns or tensions.',
      'Group closely linked codes under a parent theme that states an analytical idea, not just a topic label.',
      'Add explicit relationships (such as "causes", "supports", or "contrasts with") between codes when participants describe a link.',
      'Write an analytical memo for each candidate theme listing supporting quotes and any counter-examples.',
    ],
    exerciseTitle: 'Practice: Build one theme and its counter-example memo',
    exercisePrompt:
      'Group three related codes under a parent theme, connect two of them with a semantic relationship, and write a short memo noting one passage that fits the theme and one that complicates it.',
    quiz: [
      {
        id: 'm3-q1',
        prompt: 'Why should an analytical memo include counter-examples as well as supporting quotes?',
        options: [
          'To test the boundary of a theme and avoid cherry-picking evidence',
          'Because counter-examples must be deleted before writing up',
          'Only quantitative studies look at exceptions',
        ],
        correctIndex: 0,
        explanation:
          'Examining exceptions sharpens your theme definitions and makes your final argument much stronger under peer or examiner review.',
      },
      {
        id: 'm3-q2',
        prompt: 'What makes a strong theme name compared with a simple topic label?',
        options: [
          'A single vague noun like "Communication"',
          'A short phrase that states the pattern or tension found in the data',
          'A random code number',
        ],
        correctIndex: 1,
        explanation:
          'A theme explains what is happening across participants rather than merely naming the interview question that was asked.',
      },
    ],
  },
  {
    id: 'cases-and-patterns',
    number: 4,
    title: 'Compare across cases and inspect patterns carefully',
    durationMinutes: 15,
    summary:
      'Attach participant or site attributes to transcripts, run cross-case matrices and queries, and verify every count back to the underlying quotes.',
    videoIds: ['05'],
    outcomes: [
      'Create cases with clean participant or site attributes.',
      'Run a code-by-case matrix to compare themes across groups.',
      'Verify quantitative patterns by reading the actual coded text behind every cell.',
    ],
    steps: [
      'Create a case for each participant, site, or role and attach attributes such as cohort, setting, or experience level.',
      'Link each transcript to its matching case.',
      'Open a cross-case matrix or co-occurrence view to spot where themes cluster or diverge between groups.',
      'Click through to the underlying excerpts before drawing a conclusion so a high count is never mistaken for consensus.',
    ],
    exerciseTitle: 'Practice: Compare two synthetic participant groups',
    exercisePrompt:
      'Assign two synthetic transcripts to different cases (for example, Early-career vs Senior), run a cross-case comparison, and note one difference you can back up with a direct quote from each group.',
    quiz: [
      {
        id: 'm4-q1',
        prompt: 'If a code appears 12 times in Group A and 4 times in Group B, what should you do next?',
        options: [
          'Report that Group A cares three times more without reading the quotes',
          'Inspect the underlying excerpts and check whether one speaker repeated the same point',
          'Delete the code from Group B',
        ],
        correctIndex: 1,
        explanation:
          'Counts point you where to look, not what to conclude. Checking the excerpts tells you whether a pattern is broad or driven by a single transcript.',
      },
      {
        id: 'm4-q2',
        prompt: 'What are cases used for in qualitative analysis?',
        options: [
          'Grouping transcripts by participant, site, or unit of analysis with shared attributes',
          'Replacing interview transcripts with numbers',
          'Hiding coded segments from exports',
        ],
        correctIndex: 0,
        explanation:
          'Cases connect transcripts to structured attributes so you can compare themes across roles, locations, or time points.',
      },
    ],
  },
  {
    id: 'teams-and-ai-control',
    number: 5,
    title: 'Work in a team, check agreement, and keep researcher control over AI',
    durationMinutes: 15,
    summary:
      'Share workspaces with clear roles, use intercoder agreement to guide codebook conversations, and keep human review on every AI suggestion.',
    videoIds: ['07', '08'],
    outcomes: [
      'Choose the right collaborator role (viewer vs coder) when sharing.',
      'Use intercoder agreement scores as a prompt for codebook alignment.',
      'Document and verify any AI-assisted coding so provenance stays transparent.',
    ],
    steps: [
      'Share a snapshot or workspace with explicit roles so supervisors can read without accidental edits.',
      'Have two coders independently code the same sample transcript using the agreed codebook definitions.',
      'Review intercoder agreement together, focusing on passages where coders disagreed and refining the code rules.',
      'If you use optional AI suggestions, inspect every proposed passage in context and keep provenance records for methods disclosure.',
    ],
    exerciseTitle: 'Practice: Run a codebook alignment check',
    exercisePrompt:
      'Pick two overlapping codes from your practice canvas and write down two edge-case rules that would help a second coder decide cleanly between them.',
    quiz: [
      {
        id: 'm5-q1',
        prompt: 'How should a research team use an intercoder agreement check?',
        options: [
          'As a structured way to spot ambiguous code definitions and discuss disagreements in context',
          'As a way to avoid ever talking about the codebook',
          'Only after the paper is published',
        ],
        correctIndex: 0,
        explanation:
          'Disagreements reveal where code definitions are fuzzy; discussing them improves reliability and shared understanding.',
      },
      {
        id: 'm5-q2',
        prompt: 'What is required when optional AI assistance is used during qualitative coding?',
        options: [
          'Accept all suggestions automatically without reading the transcript',
          'Human review of each suggestion in context and transparent methods disclosure',
          'Hiding whether AI was used',
        ],
        correctIndex: 1,
        explanation:
          'Qualitative findings belong to the researcher. Reviewing suggestions in context and keeping provenance records protects methodological integrity.',
      },
    ],
  },
  {
    id: 'export-and-handoff',
    number: 6,
    title: 'Export a defensible methods trail and final report',
    durationMinutes: 15,
    summary:
      'Package your codebook, coded excerpts, memos, and portable QDPX archive so supervisors, teammates, and future readers can verify your work.',
    videoIds: ['09', '10'],
    outcomes: [
      'Pick the right export format for writing, supervision, or long-term archiving.',
      'Include codebook definitions, excerpt provenance, and key memos in your handoff.',
      'Export a standard QDPX package so your project is never locked into one tool.',
    ],
    steps: [
      'Export your codebook with full definitions and frequencies as an appendix for your methods section.',
      'Generate a structured Markdown or HTML report containing each theme, its analytical memo, and linked quotes.',
      'Export a REFI-QDA QDPX archive at major milestones so your coded project remains portable across tools.',
      'Keep a short final audit note recording your software version, date, and coding workflow.',
    ],
    exerciseTitle: 'Practice: Assemble a complete handoff checklist',
    exercisePrompt:
      'Review your practice canvas and verify you have three outputs ready: a clean codebook with definitions, a theme-by-theme excerpt summary, and a QDPX backup file.',
    quiz: [
      {
        id: 'm6-q1',
        prompt: 'Why export a REFI-QDA QDPX package at project milestones?',
        options: [
          'It keeps your transcripts, codes, and codings portable in an open standard format',
          'It strips out all code definitions',
          'It only works as a screenshot image',
        ],
        correctIndex: 0,
        explanation:
          'QDPX is the open exchange standard for qualitative data analysis software, ensuring long-term access and portability.',
      },
      {
        id: 'm6-q2',
        prompt: 'Which set of outputs gives an examiner or client the clearest audit trail?',
        options: [
          'Only a list of theme titles with no quotes',
          'The codebook definitions, analytical memos, and theme-linked excerpts traced to source transcripts',
          'Raw uncoded transcripts with no notes',
        ],
        correctIndex: 1,
        explanation:
          'Showing definitions, memos, and traceable quotes lets any reader follow how you moved from raw interviews to final claims.',
      },
    ],
  },
];
