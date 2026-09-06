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
  /**
   * Further transcripts seeded alongside sampleTranscript, so the starter
   * canvas looks like a small study rather than a single file. Index 0 in
   * sampleCodings is sampleTranscript; index 1.. are these, in order.
   */
  additionalTranscripts?: { title: string; content: string }[];
  /**
   * Coded excerpts seeded on the sample transcripts, so a new researcher sees
   * a coded canvas before bringing any data of their own. `text` must occur
   * verbatim in the referenced transcript (a test asserts this); `question`
   * indexes sampleQuestions. Instantiated with source 'sample', which the
   * activation checklist and plan caps ignore.
   */
  sampleCodings?: { transcript: number; question: number; text: string; note?: string }[];
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
    additionalTranscripts: [
      {
        title: 'Interview 2 — postdoc, health sciences',
        content: `Interviewer: Tell me about the last time you felt frustrated using your team's research tools.

Participant: Last month. We had three of us coding the same twelve interviews and the software only let one person have the project open at a time. So we set up a rota. Monday was mine, Tuesday was Priya's, and so on. If you thought of something on someone else's day you wrote it on a sticky note and hoped you would remember what you meant.

Interviewer: What happened to the sticky notes?

Participant: Half of them ended up in the codebook and half of them ended up in the bin. Nobody knows which half. That is the bit that bothers me, honestly, more than the waiting. We cannot show a reviewer how a code came to exist.

Interviewer: Did you raise it with anyone?

Participant: With the lab manager, yes. The answer was that the licence is what it is and there is no budget until the next grant cycle. So we work around it. Everyone works around it.

Interviewer: If you could change one thing?

Participant: I would want the disagreement to be visible. Not resolved for us, just visible. When Priya and I code the same passage differently, that difference is the interesting part. Right now it disappears into whoever saved last.`,
      },
      {
        title: 'Interview 3 — second-year PhD, education',
        content: `Interviewer: Tell me about the last time you felt frustrated using your team's research tools.

Participant: I am not sure frustrated is the word. Lost, maybe. I did a two-day training course on the software in September and by November I had forgotten most of it. So I went back to Word. Highlighter colours, one colour per theme, comments in the margin.

Interviewer: How is that working?

Participant: It works until it doesn't. I had eleven colours at one point and I could not tell the yellows apart. My supervisor asked me how many excerpts I had under one theme and I genuinely did not know. I had to count them by hand.

Interviewer: What did you do?

Participant: I made a spreadsheet. Theme, quote, page number. Which is basically what the software does, except now I maintain it by hand and it is always slightly out of date.

Interviewer: Is there anything about the Word approach you prefer?

Participant: I can see the whole transcript. The software kept chopping it into segments and I lost the sense of the conversation. That surprised me. I thought I wanted structure and it turns out I wanted the page.`,
      },
    ],
    sampleCodings: [
      { transcript: 0, question: 0, text: "I couldn't figure out how to export it in a way she could open" },
      { transcript: 0, question: 1, text: 'So I just took screenshots' },
      { transcript: 0, question: 2, text: 'Honestly, defeated.' },
      { transcript: 1, question: 1, text: 'So we set up a rota.' },
      { transcript: 1, question: 0, text: 'We cannot show a reviewer how a code came to exist.' },
      { transcript: 1, question: 3, text: 'that difference is the interesting part' },
      { transcript: 2, question: 1, text: 'Highlighter colours, one colour per theme, comments in the margin.' },
      { transcript: 2, question: 3, text: 'I thought I wanted structure and it turns out I wanted the page.' },
    ],
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
    additionalTranscripts: [
      {
        title: 'Interview 2 — design researcher, fintech',
        content: `Interviewer: Walk me through how you decide which study to prioritize on any given day.

Participant: There is a spreadsheet. Every request gets a row: who asked, what decision it unblocks, when that decision is being made. If there is no decision attached I push back. Politely. "What will you do differently depending on the answer?" If they cannot say, it goes to the bottom.

Interviewer: Does that hold up under pressure?

Participant: Mostly. The exception is anything the CEO asks for. That jumps the queue whether or not there is a decision behind it, and I have stopped pretending otherwise.

Interviewer: How do you feel about that?

Participant: Pragmatic, I suppose. It is one request a quarter. If I spent my credibility fighting it I would have none left for the requests that matter.

Interviewer: What counts as a request that matters?

Participant: One where the team is genuinely split. If everyone already agrees, research is theatre. If they disagree and the disagreement is about users, that is where a week of interviews changes something.`,
      },
      {
        title: 'Interview 3 — research lead, public sector',
        content: `Interviewer: Walk me through how you decide which study to prioritize on any given day.

Participant: I don't, really. The roadmap does. We plan research a quarter ahead against the service roadmap, and my day is whatever phase the current study is in. Recruitment week, fieldwork week, analysis week.

Interviewer: What happens when something urgent comes in?

Participant: It waits for the next planning round, unless it is a safety issue. People find that rigid at first. Then they notice that the studies actually finish, which was not true before we did it this way.

Interviewer: What did it look like before?

Participant: Six studies open, none of them written up. Everyone busy, nothing landed. I could show you the folder. It is a graveyard of discussion guides.

Interviewer: How did you make the change?

Participant: I stopped saying yes. That was the whole intervention. It took about three months for people to believe I meant it.`,
      },
    ],
    sampleCodings: [
      { transcript: 0, question: 0, text: "It's mostly reactive, if I'm being honest." },
      { transcript: 0, question: 3, text: 'Deep work is anything that needs more than one tab open.' },
      { transcript: 1, question: 0, text: 'Every request gets a row' },
      { transcript: 1, question: 3, text: 'If everyone already agrees, research is theatre.' },
      { transcript: 2, question: 0, text: 'The roadmap does.' },
      { transcript: 2, question: 1, text: 'I stopped saying yes.' },
    ],
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
    additionalTranscripts: [
      {
        title: 'Session 2 — analyst, agency side',
        content: `Moderator: Show me what you'd do first when you open the dashboard.

Participant: Recent projects. I live in the recent list. If it is not in the top five I have to go looking, and looking means the sidebar, which I do not love.

Moderator: What is it about the sidebar?

Participant: It folds. Every time I come back it has folded itself up again and I have to open the section I was in. Small thing. Twenty times a day small thing.

Moderator: Try finding last quarter's usability study for me.

Participant: OK. Not in recents. Sidebar, Studies, and... it is sorted by name. I do not remember the name. I remember it was March. Can I sort by date? There, sort by date. Found it. That was four clicks for something I expected to be one.

Moderator: What would one click look like?

Participant: A search that understands "March" or "usability". Or honestly just remembering how I sorted it last time.`,
      },
      {
        title: 'Session 3 — product manager, first week',
        content: `Moderator: Show me what you'd do first when you open the dashboard.

Participant: I would panic slightly. There is a lot here. I think I would click the big blue button because it is the big blue button. "New project." Hm, I do not want a new project, I want to find the one the team already made.

Moderator: Where would you look?

Participant: I am going to try the search. "onboarding". OK, a lot of results. Some of these are people's names? Oh, it is searching everything. I only wanted projects.

Moderator: What would you expect instead?

Participant: Projects first, then everything else in a separate section. Or a filter I can actually see. I found the filter now, but only because you asked me to keep looking. On my own I would have messaged someone on the team and asked for the link.

Moderator: Is that what you usually do?

Participant: In the first week, always. It is faster than learning the tool, and nobody minds. By month two it starts to feel embarrassing.`,
      },
    ],
    sampleCodings: [
      { transcript: 0, question: 0, text: 'I never remember where anything is' },
      { transcript: 0, question: 3, text: "I didn't know there were filters." },
      { transcript: 0, question: 2, text: 'Right now I just feel stuck.' },
      { transcript: 1, question: 0, text: 'It folds.' },
      { transcript: 1, question: 1, text: 'A search that understands "March" or "usability".' },
      { transcript: 2, question: 0, text: 'it is searching everything. I only wanted projects.' },
      { transcript: 2, question: 2, text: 'By month two it starts to feel embarrassing.' },
    ],
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
    additionalTranscripts: [
      {
        title: 'Tickets — week 2',
        content: `Ticket #4901: PDF export worked yesterday and today it is greyed out again. Same project, same browser. I have a client review at 3.

Ticket #4902: Is there a way to give someone view-only access? I do not want my stakeholders editing, just reading.

Ticket #4903: Small thing: the duplicate project button copies everything except the tags. I re-tag by hand every time.

Ticket #4904: Feature request: let me archive a whole folder. I asked about bulk archive before and was told it was coming.

Ticket #4905: The editor role is confusing. My colleague is an editor and cannot rename pages. Please either fix the role or rename it.`,
      },
      {
        title: 'Tickets — week 3',
        content: `Ticket #5010: Export to PDF fails silently on projects with more than about forty pages. No error, just nothing. I split the project in two to get around it.

Ticket #5011: Thank you for the view-only link, that fixed my stakeholder problem. Would be even better if the link could expire.

Ticket #5012: Bulk archive, again. It has been three months.

Ticket #5013: Comments vanish when I duplicate a project. I have now lost the same thread twice.`,
      },
    ],
    sampleCodings: [
      { transcript: 0, question: 0, text: "I can't export my project to PDF. The button is grayed out." },
      { transcript: 0, question: 1, text: "I'm just emailing them screenshots" },
      { transcript: 0, question: 2, text: 'Feature request: bulk archive.' },
      { transcript: 1, question: 0, text: 'PDF export worked yesterday and today it is greyed out again.' },
      { transcript: 1, question: 2, text: 'let me archive a whole folder' },
      { transcript: 2, question: 1, text: 'I split the project in two to get around it.' },
      { transcript: 2, question: 3, text: 'It has been three months.' },
    ],
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
    additionalTranscripts: [
      {
        title: 'NPS comments — Q2',
        content: `Score: 7 — "Solid. The collaboration features are the reason we stay. The export options are the reason I keep a second tool around."

Score: 2 — "Lost a session's work to a crash. Support was kind but the work is gone. I will come back when it is stable."

Score: 9 — "Inter-rater reliability out of the box. My methods chapter practically wrote itself."

Score: 5 — "Fine on a laptop, painful on a tablet. Half my reading happens on a tablet."

Score: 10 — "The AI suggestions are eerily good and, more importantly, easy to reject when they are not."`,
      },
      {
        title: 'NPS comments — Q3',
        content: `Score: 8 — "Deleting projects is still weirdly hidden, but everything else has improved. Docx export was the thing I asked for and it arrived."

Score: 3 — "Two crashes this month. I now save every ten minutes out of fear, which is not a feature."

Score: 9 — "Best tool I have used for team coding. Pricing is fair for a lab."

Score: 10 — "Switched from spreadsheets. Never going back."`,
      },
    ],
    sampleCodings: [
      { transcript: 0, question: 1, text: 'The collaborative coding is something I literally couldn' },
      { transcript: 0, question: 2, text: 'Crashed twice during a recording session' },
      { transcript: 0, question: 3, text: 'better export options' },
      { transcript: 1, question: 2, text: "Lost a session's work to a crash." },
      { transcript: 1, question: 1, text: 'Inter-rater reliability out of the box.' },
      { transcript: 2, question: 3, text: 'Docx export was the thing I asked for and it arrived.' },
      { transcript: 2, question: 1, text: 'Switched from spreadsheets. Never going back.' },
    ],
    sampleMemos: [
      {
        title: 'Score-by-theme matrix',
        content:
          "For each theme, what's the average NPS score? Promoters mention AI and collaboration; detractors mention crashes and missing delete buttons. The promoters tell you what to amplify; the detractors tell you what to fix first.",
      },
    ],
  },
];
