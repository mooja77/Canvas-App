// Sprint F seed templates. These ship as the starter gallery on the Screen 2
// onboarding step. Each one bundles a sample transcript + 4-5 starter codes
// so a new user can produce their first coded excerpt in <90 seconds.

export interface TemplateSeed {
  name: string;
  description: string;
  category: string;
  method: string;
  sampleQuestions: { text: string; color: string }[];
  sampleTranscript: string;
  sampleMemos?: { title: string; content: string }[];
}

export const TEMPLATES: TemplateSeed[] = [
  {
    name: 'Thematic Analysis (Braun & Clarke)',
    description: 'Reflexive 6-phase thematic analysis. Pre-seeded with starter codes and a reflexive memo prompt.',
    category: 'methodology',
    method: 'interviews',
    sampleQuestions: [
      { text: 'Pain Point', color: '#EF4444' },
      { text: 'Strategy/Workaround', color: '#F59E0B' },
      { text: 'Emotional Reaction', color: '#8B5CF6' },
      { text: 'Surprise / Aha', color: '#10B981' },
      { text: 'Question / Confusion', color: '#3B82F6' },
    ],
    sampleTranscript: `Interviewer: Tell me about the last time you felt frustrated using your team's research tools.

Participant: Oh, that was just yesterday. I was trying to share a coding scheme with my advisor and I couldn't figure out how to export it in a way she could open. So I just took screenshots and emailed them. Which is, like, 2010 behavior, you know?

Interviewer: What did you end up doing?

Participant: I asked her to download the trial version of the software I was using. That took an extra week because she had to get IT approval. By the time we actually got on a call about the codes, I'd already moved on to the next phase of analysis. So her feedback came late, and I had to redo about two days of work.

Interviewer: How did that make you feel?

Participant: Honestly, defeated. Like the tool was working against me instead of with me. I'm supposed to be focusing on my research questions, not babysitting file formats. And the irony is that I picked this tool BECAUSE it was supposed to be collaborative.

Interviewer: Has that changed how you choose tools now?

Participant: Yeah, a hundred percent. The first thing I ask now is "can I share this with one click, even with someone who doesn't have an account?" If the answer is no, it's a hard pass. I don't have time to teach colleagues new software just to give me 30 minutes of feedback.`,
    sampleMemos: [
      {
        title: 'Reflexive memo prompt',
        content:
          "What assumptions did you bring to this transcript? What expectations were confirmed or disconfirmed? Where might your own positionality shape how you read the participant's frustration?",
      },
    ],
  },
  {
    name: 'Grounded Theory',
    description: 'Open / axial / selective coding workflow with constant comparison memos.',
    category: 'methodology',
    method: 'interviews',
    sampleQuestions: [
      { text: 'Open code', color: '#3B82F6' },
      { text: 'Axial category', color: '#8B5CF6' },
      { text: 'Selective theme', color: '#EF4444' },
      { text: 'In vivo quote', color: '#10B981' },
    ],
    sampleTranscript: `Interviewer: Walk me through how you decide which study to prioritize on any given day.

Participant: It's mostly reactive, if I'm being honest. I check Slack first thing, see what's on fire, and that pretty much sets my agenda. The work I planned the night before? Maybe I get to half of it.

Interviewer: Is that frustrating?

Participant: It used to be. Now I just expect it. I block 9 to 11 AM for deep work and tell everyone I'll respond after that. Most people respect it. The PMs don't, but I've started using "do not disturb" mode and that mostly fixes it.

Interviewer: How do you decide what counts as deep work versus something you can do reactively?

Participant: Deep work is anything that needs more than one tab open. Synthesis, writing up insights, planning a study. Reactive is email, async reviews, picking interview times. If I can do it on my phone, it's not deep work.

Interviewer: That's a useful test. Has the boundary moved over time?

Participant: A little. Early in my career I thought everything was deep work and got nothing done. Now I'm more honest about what's actually cognitively expensive.`,
    sampleMemos: [
      {
        title: 'Constant comparison',
        content:
          'Compare this participant\'s definition of "deep work" to other transcripts. Where does the definition converge? Where does it diverge? What categories are emerging?',
      },
    ],
  },
  {
    name: 'UXR Pain-Points',
    description: 'User research interviews focused on usability and emotional response.',
    category: 'ux',
    method: 'interviews',
    sampleQuestions: [
      { text: 'Pain Point', color: '#EF4444' },
      { text: 'Goal', color: '#10B981' },
      { text: 'Quote', color: '#3B82F6' },
      { text: 'Surprise', color: '#F59E0B' },
      { text: 'Question', color: '#8B5CF6' },
    ],
    sampleTranscript: `Moderator: Show me what you'd do first when you open the dashboard.

Participant: OK, so... I'd probably just look for the search bar? Because I never remember where anything is. Yeah, top right, there it is. I'd type the project name. "Q2 onboarding study." Hit enter.

Moderator: What do you expect to see?

Participant: A list of relevant projects. Maybe the most recent one I touched at the top. Oh — this is showing me everything that mentions "onboarding" anywhere. Including a help article. That's not what I wanted.

Moderator: How do you usually deal with that?

Participant: I scroll. I find the actual project. It's like the third result, here. Click it. Now I'm in. But I lost maybe 15 seconds to filter through noise. Multiply that by, you know, twenty times a day, and it adds up.

Moderator: Have you tried the filters?

Participant: I didn't know there were filters. Oh — yeah. "Type: Project." OK so this works. I just never noticed it before because the filter dropdown looks like a label, not a button.

Moderator: That's useful. Anything else you'd flag?

Participant: The empty state when there's no results. It just says "no results." I'd love a "did you mean..." or even just suggested alternative searches. Right now I just feel stuck.`,
    sampleMemos: [
      {
        title: 'Severity rubric',
        content:
          'Tag each Pain Point with a severity (P0 blocker / P1 friction / P2 nice-to-have). Look for patterns: which pain points repeat across participants? Those are the leverage points.',
      },
    ],
  },
  {
    name: 'Support-Ticket Mining',
    description: 'Mine open-ended support tickets for recurring themes and root causes.',
    category: 'ops',
    method: 'open_ended_survey',
    sampleQuestions: [
      { text: 'Root cause', color: '#EF4444' },
      { text: 'Workaround', color: '#F59E0B' },
      { text: 'Feature request', color: '#3B82F6' },
      { text: 'Sentiment', color: '#8B5CF6' },
    ],
    sampleTranscript: `Ticket #4821: I can't export my project to PDF. The button is grayed out. I've tried Chrome, Firefox, and Edge. Nothing.

Ticket #4822: How do I share a project with a teammate who doesn't have an account? Right now I'm just emailing them screenshots which feels wrong in 2025.

Ticket #4823: Hi! Loving the product. One ask — when I duplicate a project, can the duplicate include the comments? Right now the comments stay on the original which means I lose context.

Ticket #4824: PDF export is broken AGAIN. This is the third time this month. I'm losing client trust because deliverables are late.

Ticket #4825: Feature request: bulk archive. I have 200+ stale projects from last year and going one by one is insane.

Ticket #4826: My collaborator can edit my project but can't add new pages. The permission says "editor." Is that a bug or by design? Either way it's confusing.

Ticket #4827: PDF export hangs on big projects. 50+ pages just spins forever. I had to chunk the export which took an extra hour.`,
    sampleMemos: [
      {
        title: 'Recurring themes',
        content:
          'Three tickets mention PDF export issues — group them under a single root cause. Two mention sharing/permissions friction. What does the priority queue look like by volume?',
      },
    ],
  },
  {
    name: 'NPS Theme Extraction',
    description: 'Extract themes from open-ended NPS comments to explain promoter vs detractor scores.',
    category: 'product',
    method: 'open_ended_survey',
    sampleQuestions: [
      { text: 'Reason for score', color: '#3B82F6' },
      { text: 'Promoter signal', color: '#10B981' },
      { text: 'Detractor signal', color: '#EF4444' },
      { text: 'Feature mention', color: '#8B5CF6' },
    ],
    sampleTranscript: `Score: 9 — "The collaborative coding is something I literally couldn't get from any other tool. My PI and I worked through a 200-page transcript together last week and it was magical."

Score: 6 — "It's fine. Does what it says on the tin. I'd like to see better export options — right now I can only get CSV and PDF, and my journal wants .docx."

Score: 10 — "I switched from a competitor last quarter and the AI suggestions have saved me probably 40 hours since then. Best money my lab has spent this year."

Score: 4 — "Crashed twice during a recording session and I lost 20 minutes of work. Until that's fixed I can't recommend it for real projects."

Score: 8 — "Great onboarding, smooth UI, fair pricing. The reason it's not a 10 is the mobile experience — it's basically unusable on my iPad which is where I'd love to be reading transcripts."

Score: 9 — "I evaluated five tools and this was the only one that actually understood qualitative research. Most are just spreadsheets with extra steps."

Score: 3 — "I cannot figure out how to delete a project. There's no obvious way. I have like a dozen test projects cluttering my dashboard and customer support said 'use the trash icon' but I don't see one anywhere."

Score: 10 — "The Cohen's Kappa calculator alone is worth the price. I used to do this in Excel and it was always a disaster."`,
    sampleMemos: [
      {
        title: 'Score-by-theme matrix',
        content:
          "For each theme, what's the average NPS score? Promoters mention AI and collaboration; detractors mention crashes and missing delete buttons. The promoters tell you what to amplify; the detractors tell you what to fix first.",
      },
    ],
  },
];
