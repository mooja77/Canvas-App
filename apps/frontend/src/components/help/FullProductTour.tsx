import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useCanvasStore } from '../../stores/canvasStore';

interface TourStep {
  target: string; // data-tour attribute value or 'center'
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon:
    | 'wave'
    | 'transcript'
    | 'code'
    | 'highlight'
    | 'ai'
    | 'collab'
    | 'link'
    | 'chart'
    | 'sidebar'
    | 'status'
    | 'search'
    | 'rocket'
    | 'import'
    | 'memo'
    | 'case';
  tip?: string;
  duration?: number; // Auto-advance time in ms (default 5000)
  action?: () => Promise<void>; // Async action to run when entering this step
}

// Sample interview data for demo
const DEMO_TRANSCRIPT_1 = `Interviewer: Can you tell me about your experience with the healthcare system?

Participant: Honestly, it's been frustrating. I feel like every time I go in, I'm starting from scratch. The doctors don't seem to have my records, and I have to explain my whole history again. It really affects my trust in the system.

Interviewer: That sounds difficult. Can you give me a specific example?

Participant: Last month, I went to see a specialist about my ongoing back pain. They had no idea about the MRI I'd already had done. I had to wait another three weeks for a new one. It felt like a complete waste of time and made me question whether they really care about patient outcomes.

Interviewer: How has this affected your overall attitude toward seeking care?

Participant: I've become much more hesitant. I now keep my own folder of medical records, which I bring to every appointment. But honestly, there have been times when I've just avoided going to the doctor because I didn't want to deal with the hassle. The positive experiences I've had were always when one particular nurse took the time to actually listen and follow up.`;

const DEMO_TRANSCRIPT_2 = `Interviewer: What barriers have you encountered when accessing healthcare services?

Participant: The biggest barrier for me is cost. Even with insurance, the copays add up quickly. I had to choose between filling a prescription and paying my electricity bill last winter. That shouldn't happen.

Interviewer: Beyond cost, are there other challenges?

Participant: Transportation is a huge issue. The nearest specialist is 45 minutes away, and I don't always have reliable transportation. There's also the wait times \u2014 I once waited three months for a routine appointment. By then, my condition had gotten much worse.

Interviewer: Have you found anything that helps overcome these barriers?

Participant: Telehealth has been a game-changer for me. Being able to do a video call instead of driving an hour saves time and money. I also found a community health worker who helps me navigate the system. Having someone advocate for you makes a real difference.`;

function getDemoActions(canvasId: string | null): Record<number, () => Promise<void>> {
  const getState = useCanvasStore.getState;
  const canvas = () => getState().activeCanvas;
  // Helper: check if a transcript with this title already exists
  const hasTranscript = (title: string) => {
    const c = canvas();
    return c?.transcripts.some((t: { title: string }) => t.title === title);
  };
  // Helper: check if a code with this text already exists
  const hasCode = (text: string) => {
    const c = canvas();
    return c?.questions.some((q: { text: string }) => q.text === text);
  };
  // Helper: validate canvas context hasn't changed during tour
  const validateCanvas = () => {
    const currentId = getState().activeCanvasId;
    if (currentId !== canvasId) {
      console.warn('[Tour] Canvas changed during tour, skipping action');
      return false;
    }
    return true;
  };
  return {
    // Step 2: Add first transcript
    2: async () => {
      if (!canvasId || !validateCanvas() || hasTranscript('Patient Interview - Sarah')) return;
      try {
        await getState().addTranscript('Patient Interview - Sarah', DEMO_TRANSCRIPT_1);
      } catch {
        /* ignore */
      }
    },
    // Step 3: Add second transcript
    3: async () => {
      if (!canvasId || !validateCanvas() || hasTranscript('Patient Interview - Michael')) return;
      try {
        await getState().addTranscript('Patient Interview - Michael', DEMO_TRANSCRIPT_2);
      } catch {
        /* ignore */
      }
    },
    // Step 5: Create first code
    5: async () => {
      if (!canvasId || !validateCanvas() || hasCode('Trust Issues')) return;
      try {
        await getState().addQuestion('Trust Issues', '#ef4444');
      } catch {
        /* ignore */
      }
    },
    // Step 6: Create second code
    6: async () => {
      if (!canvasId || !validateCanvas() || hasCode('Barriers to Care')) return;
      try {
        await getState().addQuestion('Barriers to Care', '#f59e0b');
      } catch {
        /* ignore */
      }
    },
    // Step 7: Create third code
    7: async () => {
      if (!canvasId || !validateCanvas() || hasCode('Positive Experience')) return;
      try {
        await getState().addQuestion('Positive Experience', '#22c55e');
      } catch {
        /* ignore */
      }
    },
    // Step 9: Create coding (connect transcript to code)
    9: async () => {
      if (!canvasId || !validateCanvas()) return;
      const c = canvas();
      if (!c || c.codings.length >= 1 || c.transcripts.length === 0 || c.questions.length === 0) return;
      const t =
        c.transcripts.find((t: { title: string }) => t.title === 'Patient Interview - Sarah') || c.transcripts[0];
      const q = c.questions.find((q: { text: string }) => q.text === 'Trust Issues') || c.questions[0];
      if (!t || !q) return;
      try {
        await getState().createCoding(t.id, q.id, 256, 345, 'It really affects my trust in the system');
      } catch {
        /* ignore */
      }
    },
    // Step 10: Create second coding
    10: async () => {
      if (!canvasId || !validateCanvas()) return;
      const c = canvas();
      if (!c || c.codings.length >= 2 || c.transcripts.length < 2 || c.questions.length < 2) return;
      const t =
        c.transcripts.find((t: { title: string }) => t.title === 'Patient Interview - Michael') || c.transcripts[1];
      const q = c.questions.find((q: { text: string }) => q.text === 'Barriers to Care') || c.questions[1];
      if (!t || !q) return;
      try {
        await getState().createCoding(t.id, q.id, 95, 195, 'The biggest barrier for me is cost');
      } catch {
        /* ignore */
      }
    },
    // Step 11: Create third coding
    11: async () => {
      if (!canvasId || !validateCanvas()) return;
      const c = canvas();
      if (!c || c.codings.length >= 3) return;
      const t =
        c.transcripts.find((t: { title: string }) => t.title === 'Patient Interview - Sarah') || c.transcripts[0];
      const q = c.questions.find((q: { text: string }) => q.text === 'Positive Experience') || c.questions[2];
      if (!t || !q) return;
      try {
        await getState().createCoding(
          t.id,
          q.id,
          780,
          900,
          'one particular nurse took the time to actually listen and follow up',
        );
      } catch {
        /* ignore */
      }
    },
  };
}

const TOUR_STEPS: TourStep[] = [
  // === PHASE 1: WELCOME ===
  {
    target: 'center',
    title: 'Welcome to QualCanvas!',
    description:
      'This interactive tour shows you how to go from raw interview transcripts to meaningful research insights \u2014 all on a visual canvas.',
    position: 'center',
    icon: 'wave',
    tip: 'Click Auto-play to watch the full demo, or navigate step by step.',
    duration: 6000,
  },

  // === PHASE 2: ADDING DATA ===
  {
    target: 'canvas-btn-transcript',
    title: 'Step 1: Add Your Transcripts',
    description:
      'Everything starts with your data. Click the Transcript button to paste text, import a CSV, or drag and drop .txt files directly onto the canvas.',
    position: 'bottom',
    icon: 'transcript',
    tip: 'You can import multiple interviews from a single CSV file.',
    duration: 5000,
  },
  {
    target: 'canvas-flow-area',
    title: 'Transcript Added!',
    description:
      'Your first interview transcript now appears as a node on the canvas. You can drag it anywhere, resize it, and scroll through the full text inside.',
    position: 'center',
    icon: 'transcript',
    tip: "Watch \u2014 we'll add a second transcript now.",
    duration: 5000,
  },
  {
    target: 'canvas-flow-area',
    title: 'Multiple Transcripts',
    description:
      'Each interview gets its own node on the canvas. You can arrange them however you like \u2014 by participant, by topic, or chronologically.',
    position: 'center',
    icon: 'transcript',
    tip: 'Double-click anywhere on the canvas background for a quick-add menu.',
    duration: 5000,
  },

  // === PHASE 3: CREATING CODES ===
  {
    target: 'canvas-btn-question',
    title: 'Step 2: Create Your Codes',
    description:
      'Codes are the labels you use to tag themes in your data. Think of them as colored highlighters \u2014 each code marks a concept you want to track across interviews.',
    position: 'bottom',
    icon: 'code',
    tip: 'We\'re creating "Trust Issues" as our first code.',
    duration: 5000,
  },
  {
    target: 'canvas-flow-area',
    title: 'Code: Trust Issues',
    description:
      'A red code node appears on the canvas. Each code gets a distinct color so you can instantly see which themes appear where.',
    position: 'center',
    icon: 'code',
    tip: 'Let\'s add "Barriers to Care" next.',
    duration: 4000,
  },
  {
    target: 'canvas-flow-area',
    title: 'Code: Barriers to Care',
    description:
      'Your second code is amber-colored. As your codebook grows, you can organize codes into hierarchies using the Hierarchy tool.',
    position: 'center',
    icon: 'code',
    tip: 'One more \u2014 "Positive Experience".',
    duration: 4000,
  },
  {
    target: 'canvas-flow-area',
    title: 'Your Codebook is Taking Shape',
    description:
      'Three codes created! In a real project, you might have 20-50 codes. QualCanvas handles unlimited codes on Pro and Team plans.',
    position: 'center',
    icon: 'code',
    tip: 'Now comes the exciting part \u2014 connecting your data to your codes.',
    duration: 5000,
  },

  // === PHASE 4: CODING DATA ===
  {
    target: 'canvas-flow-area',
    title: 'Step 3: Code Your Data',
    description:
      'In the transcript, you select text and assign it to a code. A line automatically connects the transcript to the code, showing the relationship visually.',
    position: 'center',
    icon: 'highlight',
    tip: 'Watch \u2014 we\'re tagging "It really affects my trust in the system" with Trust Issues.',
    duration: 6000,
  },
  {
    target: 'canvas-flow-area',
    title: 'Connections Form Automatically',
    description:
      "See the line connecting the transcript to the code? That's a coding. Each line represents a tagged passage. The more you code, the richer your visual network becomes.",
    position: 'center',
    icon: 'link',
    tip: "Let's add another coding from the second interview.",
    duration: 5000,
  },
  {
    target: 'canvas-flow-area',
    title: 'Cross-Interview Patterns',
    description:
      "Now both transcripts are connected to codes. You can instantly see which themes appear across multiple interviews \u2014 that's the power of visual coding.",
    position: 'center',
    icon: 'link',
    tip: 'Codes with many connections indicate strong themes in your data.',
    duration: 5000,
  },

  // === PHASE 5: NAVIGATOR ===
  {
    target: 'canvas-navigator',
    title: 'The Code Navigator',
    description:
      'This sidebar shows your complete codebook at a glance. Click any code to see all its coded passages. The frequency bar shows how often each code was used.',
    position: 'right',
    icon: 'sidebar',
    tip: 'Toggle between Codes and Sources views to explore your data from different angles.',
    duration: 5000,
  },

  // === PHASE 6: ANALYSIS ===
  {
    target: 'canvas-btn-query',
    title: 'Step 4: Analyze Your Findings',
    description:
      'Click Analyze to add analysis nodes \u2014 word clouds, co-occurrence matrices, sentiment analysis, statistics, treemaps, and more. Each analysis runs live on your coded data.',
    position: 'bottom',
    icon: 'chart',
    tip: '10 analysis tools available on Pro and Team plans.',
    duration: 5000,
  },

  // === PHASE 7: AI TOOLS ===
  {
    target: 'canvas-btn-ai',
    title: 'AI-Powered Tools',
    description:
      'The AI menu gives you four powerful tools: Auto-Code to apply codes by pattern, AI Code for intelligent suggestions, AI Chat to ask questions about your data, and Summarize for concise overviews.',
    position: 'bottom',
    icon: 'ai',
    tip: 'Bring your own API key (OpenAI, Anthropic, or Google) to enable AI features.',
    duration: 6000,
  },

  // === PHASE 8: ADDITIONAL TOOLS ===
  {
    target: 'canvas-btn-memo',
    title: 'Research Memos',
    description:
      'Memos let you record your analytical thoughts, theoretical notes, and methodological decisions right on the canvas alongside your data.',
    position: 'bottom',
    icon: 'memo',
    tip: 'Good qualitative research is built on reflexive memo-writing.',
    duration: 4000,
  },
  {
    target: 'canvas-toolbar',
    title: 'Import, Export & Tools',
    description:
      'The toolbar puts everything at your fingertips. The Export button saves your work as QDPX, HTML reports, or PNG images. The Tools menu has cases, ethics, codebook, and more.',
    position: 'bottom',
    icon: 'import',
    tip: 'QDPX is the open standard for qualitative data exchange with NVivo and ATLAS.ti.',
    duration: 5000,
  },

  // === PHASE 9: CASES, ETHICS & SHARING ===
  {
    target: 'canvas-toolbar',
    title: 'Cases & Cross-Case Analysis',
    description:
      'Use Cases to group transcripts by participant or site. The cross-case view lets you compare how themes manifest across different cases \u2014 essential for multi-site studies.',
    position: 'bottom',
    icon: 'case',
    tip: 'Cases are available on Pro and Team plans.',
    duration: 5000,
  },
  {
    target: 'canvas-toolbar',
    title: 'Ethics & Audit Trail',
    description:
      'The Ethics panel helps you document informed consent, track IRB approvals, and maintain a full audit trail of your coding decisions \u2014 critical for research integrity.',
    position: 'bottom',
    icon: 'memo',
    tip: 'Ethics features are available on Pro and Team plans.',
    duration: 5000,
  },
  {
    target: 'canvas-toolbar',
    title: 'Share Your Canvas',
    description:
      'Generate a share code to let colleagues clone your canvas. They get a complete copy of your transcripts, codes, and codings to review or extend your analysis independently.',
    position: 'bottom',
    icon: 'collab',
    tip: 'Up to 5 shares on Pro, unlimited on Team plans.',
    duration: 5000,
  },

  // === PHASE 10: COLLABORATION & STATUS ===
  {
    target: 'canvas-status-bar',
    title: 'Real-Time Collaboration',
    description:
      "Team plan users see live presence avatars and cursors. The green dot shows you're connected. Multiple researchers can code the same canvas simultaneously.",
    position: 'top',
    icon: 'collab',
    tip: "Run Cohen's Kappa intercoder reliability with one click on Team plans.",
    duration: 5000,
  },

  // === PHASE 10: KEYBOARD & SHORTCUTS ===
  {
    target: 'canvas-toolbar',
    title: 'Keyboard Shortcuts & Command Palette',
    description:
      'Press Ctrl+K to open the command palette \u2014 search for any action instantly. Press ? to see all keyboard shortcuts. Every shortcut is fully customizable.',
    position: 'bottom',
    icon: 'search',
    tip: "Power users love Ctrl+K \u2014 it's the fastest way to find any tool.",
    duration: 5000,
  },

  // === FINALE ===
  {
    target: 'center',
    title: "You're Ready to Research!",
    description:
      "You've seen the full QualCanvas workflow: import transcripts, create codes, tag your data, and analyze patterns \u2014 all on one visual canvas. Start free and upgrade when your research grows.",
    position: 'center',
    icon: 'rocket',
    tip: 'Start free at qualcanvas.com \u2014 no credit card required.',
    duration: 7000,
  },
];

// Icons for each step
function StepIcon({ type, className }: { type: TourStep['icon']; className?: string }) {
  const c = className || 'h-6 w-6';
  switch (type) {
    case 'wave':
      return (
        <span className="text-2xl" role="img" aria-label="wave">
          &#128075;
        </span>
      );
    case 'transcript':
      return (
        <svg className={`${c} text-blue-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
      );
    case 'code':
      return (
        <svg className={`${c} text-purple-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
        </svg>
      );
    case 'highlight':
      return (
        <svg className={`${c} text-amber-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"
          />
        </svg>
      );
    case 'ai':
      return (
        <svg className={`${c} text-violet-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
          />
        </svg>
      );
    case 'collab':
      return (
        <svg className={`${c} text-sky-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
          />
        </svg>
      );
    case 'import':
      return (
        <svg className={`${c} text-orange-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 7.5h-.75A2.25 2.25 0 0 0 4.5 9.75v7.5a2.25 2.25 0 0 0 2.25 2.25h7.5a2.25 2.25 0 0 0 2.25-2.25v-7.5a2.25 2.25 0 0 0-2.25-2.25h-.75m0-3-3-3m0 0-3 3m3-3v11.25m6-2.25h.75a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25h-7.5a2.25 2.25 0 0 1-2.25-2.25v-.75"
          />
        </svg>
      );
    case 'link':
      return (
        <svg className={`${c} text-cyan-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
          />
        </svg>
      );
    case 'chart':
      return (
        <svg
          className={`${c} text-emerald-500`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
          />
        </svg>
      );
    case 'sidebar':
      return (
        <svg className={`${c} text-indigo-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
      );
    case 'status':
      return (
        <svg className={`${c} text-teal-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
        </svg>
      );
    case 'search':
      return (
        <svg className={`${c} text-rose-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
          />
        </svg>
      );
    case 'memo':
      return (
        <svg className={`${c} text-green-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
          />
        </svg>
      );
    case 'case':
      return (
        <svg className={`${c} text-pink-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
          />
        </svg>
      );
    case 'rocket':
      return (
        <span className="text-2xl" role="img" aria-label="rocket">
          &#128640;
        </span>
      );
    default:
      return null;
  }
}

export default function FullProductTour() {
  // Sprint F: the tour is no longer auto-fired; it now only opens when the
  // user picks "Take the full product tour" from the Help menu. We keep the
  // legacy `onboardingComplete` flag in sync (true while tour is closed) so
  // existing telemetry / replay-tour buttons keep working.
  const showFullProductTour = useUIStore((s) => s.showFullProductTour);
  const closeFullProductTour = useUIStore((s) => s.closeFullProductTour);
  const completeOnboarding = closeFullProductTour;
  const onboardingComplete = !showFullProductTour;
  const canvasId = useCanvasStore((s) => s.activeCanvasId);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [animating, setAnimating] = useState(false);
  const [demoMode, setDemoMode] = useState(() => {
    // Auto-start demo mode if ?demo=true URL param is present
    try {
      return new URLSearchParams(window.location.search).get('demo') === 'true';
    } catch {
      return false;
    }
  });
  const [demoPaused, setDemoPaused] = useState(false);
  const [actionRunning, setActionRunning] = useState(false);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoActionsRef = useRef(getDemoActions(canvasId));

  // Keep demo actions in sync with canvasId
  useEffect(() => {
    demoActionsRef.current = getDemoActions(canvasId);
  }, [canvasId]);

  // Reset to step 0 whenever the tour becomes visible again (e.g. replay)
  useEffect(() => {
    if (!onboardingComplete) {
      setStep(0);
      setAnimating(false);
      setDemoMode(false);
      setDemoPaused(false);
    }
  }, [onboardingComplete]);

  const currentStep = TOUR_STEPS[step];
  const isLastStep = step === TOUR_STEPS.length - 1;
  const isCenter = currentStep.target === 'center' || currentStep.position === 'center';

  // Run demo action when step changes
  useEffect(() => {
    const action = demoActionsRef.current[step];
    if (action && canvasId) {
      setActionRunning(true);
      action().finally(() => setActionRunning(false));
    }
  }, [step, canvasId]);

  // Demo mode auto-advance with per-step timing
  useEffect(() => {
    if (!demoMode || demoPaused || onboardingComplete || isLastStep || actionRunning) {
      if (demoTimerRef.current) {
        clearTimeout(demoTimerRef.current);
        demoTimerRef.current = null;
      }
      return;
    }

    const duration = currentStep.duration || 5000;
    demoTimerRef.current = setTimeout(() => {
      setAnimating(true);
      setTimeout(() => {
        setStep((prev) => {
          const next = prev + 1;
          if (next >= TOUR_STEPS.length - 1) {
            setDemoMode(false);
            setDemoPaused(false);
          }
          return Math.min(next, TOUR_STEPS.length - 1);
        });
        setAnimating(false);
      }, 150);
    }, duration);

    return () => {
      if (demoTimerRef.current) {
        clearTimeout(demoTimerRef.current);
        demoTimerRef.current = null;
      }
    };
  }, [demoMode, demoPaused, onboardingComplete, isLastStep, actionRunning, step, currentStep.duration]);

  // Find target element
  useEffect(() => {
    if (onboardingComplete) return;
    if (isCenter) {
      setTargetRect(null);
      return;
    }
    // Small delay to let DOM settle after step change
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [step, currentStep.target, isCenter, onboardingComplete]);

  // Animate step transitions
  const goToStep = useCallback((next: number) => {
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 150);
  }, []);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      completeOnboarding();
    } else {
      goToStep(step + 1);
    }
  }, [isLastStep, completeOnboarding, step, goToStep]);

  const handleBack = useCallback(() => {
    if (step > 0) goToStep(step - 1);
  }, [step, goToStep]);

  const handleSkip = useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);

  const toggleDemoMode = useCallback(() => {
    if (demoMode) {
      setDemoMode(false);
      setDemoPaused(false);
    } else {
      setDemoMode(true);
      setDemoPaused(false);
    }
  }, [demoMode]);

  const toggleDemoPause = useCallback(() => {
    setDemoPaused((prev) => !prev);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (onboardingComplete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        completeOnboarding();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handleBack();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onboardingComplete, completeOnboarding, handleNext, handleBack]);

  // Position the tooltip — clamp so the card never overflows the viewport
  const tooltipStyle = useMemo((): React.CSSProperties => {
    if (isCenter || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const gap = 16;
    const padding = 16;
    const cardWidth = Math.min(360, window.innerWidth - padding * 2);
    const halfCard = cardWidth / 2;

    // Clamp left so the card stays within [padding .. innerWidth - padding - cardWidth]
    const clampLeft = (idealCenter: number) =>
      Math.max(padding + halfCard, Math.min(idealCenter, window.innerWidth - padding - halfCard));

    switch (currentStep.position) {
      case 'bottom':
        return {
          position: 'fixed',
          top: Math.min(targetRect.bottom + gap, window.innerHeight - 300),
          left: clampLeft(targetRect.left + targetRect.width / 2),
          transform: 'translateX(-50%)',
        };
      case 'top': {
        // Card renders above the target. Estimate card height (~300px) and
        // clamp so the card doesn't go above the viewport.
        const cardHeight = 300;
        const idealTop = targetRect.top - gap - cardHeight;
        return {
          position: 'fixed',
          top: Math.max(padding, idealTop),
          left: clampLeft(targetRect.left + targetRect.width / 2),
          transform: 'translateX(-50%)',
        };
      }
      case 'right':
        return {
          position: 'fixed',
          top: Math.max(padding, Math.min(targetRect.top + targetRect.height / 2, window.innerHeight - padding - 150)),
          left: Math.min(targetRect.right + gap, window.innerWidth - padding - cardWidth),
          transform: 'translateY(-50%)',
        };
      case 'left':
        return {
          position: 'fixed',
          top: Math.max(padding, Math.min(targetRect.top + targetRect.height / 2, window.innerHeight - padding - 150)),
          left: Math.max(padding, targetRect.left - gap - cardWidth),
          transform: 'translateY(-50%)',
        };
      default:
        return {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  }, [isCenter, targetRect, currentStep.position]);

  // Don't render if already completed
  if (onboardingComplete) return null;

  return (
    <div className="fixed inset-0 z-[10000]">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 transition-opacity duration-300" />

      {/* Highlight target with spotlight effect */}
      {!isCenter && targetRect && (
        <div
          className="absolute rounded-xl bg-transparent z-10 transition-all duration-300 ease-out ring-2 ring-white/80"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55), 0 0 24px 4px rgba(99,102,241,0.3)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className={`z-20 transition-opacity duration-150 ${animating ? 'opacity-0' : 'opacity-100'}`}
        style={tooltipStyle}
      >
        <div
          className={`w-[calc(100vw-32px)] max-w-[360px] rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden ${step === 0 ? 'tour-tooltip-enter' : ''}`}
        >
          {/* Progress bar at top */}
          <div className="h-1 bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500 ease-out rounded-r-full"
              style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-5">
            {/* Icon + step number + demo badge */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <StepIcon type={currentStep.icon} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                    {currentStep.title}
                  </h3>
                  {demoMode && (
                    <span className="inline-flex items-center rounded-full bg-brand-100 dark:bg-brand-900/40 px-1.5 py-0.5 text-[9px] font-semibold text-brand-700 dark:text-brand-300">
                      Demo
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Step {step + 1} of {TOUR_STEPS.length}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed mb-1">
              {currentStep.description}
            </p>

            {/* Tip callout */}
            {currentStep.tip && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 px-3 py-2">
                <svg
                  className="h-4 w-4 text-brand-500 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                  />
                </svg>
                <p className="text-[12px] text-brand-700 dark:text-brand-300 leading-relaxed">{currentStep.tip}</p>
              </div>
            )}

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1 mt-4 mb-4">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToStep(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === step
                      ? 'h-2 w-6 bg-brand-500'
                      : i < step
                        ? 'h-2 w-2 bg-brand-300 hover:bg-brand-400'
                        : 'h-2 w-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                  title={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1"
              >
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    Back
                  </button>
                )}
                <button onClick={handleNext} className="flex items-center gap-1.5 btn-primary px-4 py-1.5 text-[12px]">
                  {isLastStep ? (
                    <>
                      Let's Go!
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                        />
                      </svg>
                    </>
                  ) : (
                    <>
                      Next
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Keyboard hint + auto-play toggle */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center min-w-[18px] rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 font-mono text-[9px]">
                    &larr;
                  </kbd>
                  <kbd className="inline-flex items-center justify-center min-w-[18px] rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 font-mono text-[9px]">
                    &rarr;
                  </kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 font-mono text-[9px]">
                    Esc
                  </kbd>
                  Skip
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {demoMode && (
                  <button
                    onClick={toggleDemoPause}
                    className="flex items-center justify-center h-5 w-5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={demoPaused ? 'Resume auto-play' : 'Pause auto-play'}
                  >
                    {demoPaused ? (
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    ) : (
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    )}
                  </button>
                )}
                <button
                  onClick={toggleDemoMode}
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
                    demoMode
                      ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500'
                  }`}
                  title={demoMode ? 'Stop auto-play' : 'Auto-play tour'}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                    />
                  </svg>
                  <span className="text-[9px] font-medium">Auto-play</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
