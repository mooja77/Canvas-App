export const trainingCategories = [
  'Start here',
  'Everyday coding',
  'Analysis',
  'Working together',
  'Privacy & control',
  'Export & handoff',
  'Workspace & scale',
  'Researcher tours',
] as const;

export type TrainingCategory = (typeof trainingCategories)[number];

export interface TrainingVideo {
  id: string;
  videoId: string | null;
  title: string;
  shortTitle: string;
  outcome: string;
  category: TrainingCategory;
  duration: string;
  thumbnail: string;
}

export const youtubeChannelUrl = 'https://www.youtube.com/@QualCanvas';

export const trainingPlaylists = [
  {
    title: 'Start with QualCanvas',
    outcome: 'Product overview, first-project setup and the complete transcript-to-report workflow.',
    url: 'https://www.youtube.com/playlist?list=PLCrDpx1xmA1U',
  },
  {
    title: 'Everyday QualCanvas Training',
    outcome: 'Focused help for importing, coding, memoing, organising and exporting research work.',
    url: 'https://www.youtube.com/playlist?list=PLCIvfQECYZZc',
  },
  {
    title: 'Analysis, Collaboration & Control',
    outcome: 'Queries, cases, sharing, intercoder review, AI controls, QDPX and research repositories.',
    url: 'https://www.youtube.com/playlist?list=PLO7hzf3lVeSU',
  },
  {
    title: 'QualCanvas for Researchers, Teams & Teaching',
    outcome: 'Role-specific tours for doctoral, teaching, team, UX and applied-research contexts.',
    url: 'https://www.youtube.com/playlist?list=PLTEqAy8MO9D8',
  },
] as const;

export const trainingVideos: readonly TrainingVideo[] = [
  {
    id: '01',
    videoId: 'i1s8kRRDoLE',
    title: 'QualCanvas in 2 Minutes | From Transcript to Defensible Theme',
    shortTitle: 'QualCanvas in two minutes',
    outcome: 'Understand how transcripts, codes, themes, memos and exports stay connected in one visual workflow.',
    category: 'Start here',
    duration: '1:40',
    thumbnail: '/training/thumbnails/01-qualcanvas-in-two-minutes.jpg',
  },
  {
    id: '02',
    videoId: '8UHG5rxYEHM',
    title: 'Start Your First QualCanvas Project | A Calm Beginner Walkthrough',
    shortTitle: 'Start your first project',
    outcome: 'Create a first canvas, choose a sensible starting structure and know where to get help.',
    category: 'Start here',
    duration: '1:39',
    thumbnail: '/training/thumbnails/02-start-your-first-project.jpg',
  },
  {
    id: '03',
    videoId: 'X9czENGbCg8',
    title: 'Add Interview Transcripts in QualCanvas | Import, Organise & Protect Data',
    shortTitle: 'Add interview transcripts',
    outcome: 'Add a transcript, keep sources organised and apply the right privacy checks before import.',
    category: 'Everyday coding',
    duration: '1:43',
    thumbnail: '/training/thumbnails/03-add-interview-transcripts.jpg',
  },
  {
    id: '04',
    videoId: 'hzt6Rbmf0Fg',
    title: 'Create a Codebook and Code Your First Passage in QualCanvas',
    shortTitle: 'Code your first passage',
    outcome: 'Create a meaningful code, apply it to a passage and review the developing codebook.',
    category: 'Everyday coding',
    duration: '1:34',
    thumbnail: '/training/thumbnails/04-code-your-first-passage.jpg',
  },
  {
    id: '05',
    videoId: 'rNqv14ez28M',
    title: 'Find Patterns with QualCanvas Analysis Tools | Queries, Clusters & Frameworks',
    shortTitle: 'Find patterns with analysis tools',
    outcome: 'Choose the right analysis view for a question without treating an output as an automatic finding.',
    category: 'Analysis',
    duration: '1:40',
    thumbnail: '/training/thumbnails/05-find-patterns-analysis-tools.jpg',
  },
  {
    id: '06',
    videoId: null,
    title: 'Write Research Memos and Keep an Audit Trail in QualCanvas',
    shortTitle: 'Memos and audit trail',
    outcome: 'Write useful analytical memos and document decisions, ethics boundaries and changes over time.',
    category: 'Analysis',
    duration: '1:40',
    thumbnail: '/training/thumbnails/06-research-memos-audit-trail.jpg',
  },
  {
    id: '07',
    videoId: null,
    title: 'Share a QualCanvas Project and Check Intercoder Agreement',
    shortTitle: 'Share and check agreement',
    outcome: 'Share the right workspace safely, align the codebook and use agreement as a prompt for discussion.',
    category: 'Working together',
    duration: '1:39',
    thumbnail: '/training/thumbnails/07-share-and-intercoder-agreement.jpg',
  },
  {
    id: '08',
    videoId: null,
    title: 'Use AI in QualCanvas Without Giving Up Researcher Control',
    shortTitle: 'AI privacy and control',
    outcome: 'Understand what AI actions do, what data is sent and what the researcher must review and disclose.',
    category: 'Privacy & control',
    duration: '1:52',
    thumbnail: '/training/thumbnails/08-ai-privacy-and-control.jpg',
  },
  {
    id: '09',
    videoId: null,
    title: 'Export QualCanvas Work for a Dissertation, Report or Handoff',
    shortTitle: 'Export for writing or handoff',
    outcome: 'Choose an export format that preserves the evidence and context needed by the next reader.',
    category: 'Export & handoff',
    duration: '1:43',
    thumbnail: '/training/thumbnails/09-export-for-dissertation-or-handoff.jpg',
  },
  {
    id: '10',
    videoId: null,
    title: 'The Complete QualCanvas Workflow | Transcript to Research Report',
    shortTitle: 'Complete transcript-to-report workflow',
    outcome: 'See the full sequence from project setup and coding through analysis, memoing, review and export.',
    category: 'Start here',
    duration: '2:01',
    thumbnail: '/training/thumbnails/10-complete-qualitative-workflow.jpg',
  },
  {
    id: '11',
    videoId: null,
    title: 'QualCanvas for PhD and Dissertation Research | A Defensible Analysis Trail',
    shortTitle: 'QualCanvas for PhD research',
    outcome: 'Organise a method, analysis trail, supervision handoff and final dissertation outputs.',
    category: 'Researcher tours',
    duration: '1:42',
    thumbnail: '/training/thumbnails/11-qualcanvas-for-phd-research.jpg',
  },
  {
    id: '12',
    videoId: null,
    title: 'QualCanvas for Methods Teaching and Research Teams',
    shortTitle: 'Methods teaching and research teams',
    outcome: 'Use shared definitions, visible evidence and structured review to teach coding or coordinate a team.',
    category: 'Researcher tours',
    duration: '1:42',
    thumbnail: '/training/thumbnails/12-methods-teaching-and-research-teams.jpg',
  },
  {
    id: '13',
    videoId: null,
    title: 'Import Open-Text Survey Data into QualCanvas',
    shortTitle: 'Import open-text survey data',
    outcome: 'Import a CSV of open-text responses, map useful columns and prepare responses for safe coding.',
    category: 'Everyday coding',
    duration: '1:50',
    thumbnail: '/training/thumbnails/13-import-open-text-survey-data.jpg',
  },
  {
    id: '14',
    videoId: null,
    title: 'Build Cases and Compare Participants in QualCanvas',
    shortTitle: 'Cases and cross-case analysis',
    outcome:
      'Create analytical cases and compare patterns across participants, sites or groups without losing context.',
    category: 'Analysis',
    duration: '1:44',
    thumbnail: '/training/thumbnails/14-cases-and-cross-case-analysis.jpg',
  },
  {
    id: '15',
    videoId: null,
    title: 'Move Qualitative Projects with QDPX | QualCanvas Import and Export',
    shortTitle: 'Move projects with QDPX',
    outcome: 'Use QDPX to transfer a qualitative project, then verify the result in the destination tool.',
    category: 'Export & handoff',
    duration: '1:51',
    thumbnail: '/training/thumbnails/15-move-projects-with-qdpx.jpg',
  },
  {
    id: '16',
    videoId: null,
    title: 'Organise a Busy QualCanvas Workspace | Layout and Shortcuts',
    shortTitle: 'Organise a busy visual canvas',
    outcome: 'Use layout, navigation and shortcut controls to keep a growing visual workspace readable.',
    category: 'Workspace & scale',
    duration: '1:39',
    thumbnail: '/training/thumbnails/16-organise-a-busy-visual-canvas.jpg',
  },
  {
    id: '17',
    videoId: null,
    title: 'Build a Research Repository Across QualCanvas Projects',
    shortTitle: 'Research repository across projects',
    outcome: 'Curate carefully written insights across projects while preserving links back to the source analysis.',
    category: 'Workspace & scale',
    duration: '1:44',
    thumbnail: '/training/thumbnails/17-research-repository-across-projects.jpg',
  },
  {
    id: '18',
    videoId: null,
    title: 'QualCanvas for UX, Service and Applied Research',
    shortTitle: 'UX, service and applied research',
    outcome: 'Combine interviews, open-text responses, visible analysis and memos in an applied-research workflow.',
    category: 'Researcher tours',
    duration: '1:46',
    thumbnail: '/training/thumbnails/18-qualcanvas-for-ux-service-applied-research.jpg',
  },
] as const;

export const firstProjectLearningPath = ['01', '02', '03', '04', '05', '06', '09', '10'] as const;
