import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface GuideSection {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
}

function Screenshot({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-6">
      <img
        src={src}
        alt={alt}
        className="w-full rounded-xl border border-gray-200 shadow-lg dark:border-gray-700"
        loading="lazy"
      />
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function ProTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 flex items-start gap-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 px-4 py-3 border border-brand-200 dark:border-brand-800">
      <svg className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
      <p className="text-sm text-brand-800 dark:text-brand-200 leading-relaxed">{children}</p>
    </div>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="my-4 space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-xs font-bold text-brand-700 dark:text-brand-300">
            {i + 1}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

const SECTIONS: GuideSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '1',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          QualCanvas is a visual workspace for qualitative research. Sign up for free with Google or email, then create your first canvas to begin coding interview data.
        </p>
        <Screenshot src="/guide/01-login.png" alt="QualCanvas login page" caption="Sign in with Google, email, or an access code" />
        <Steps steps={[
          'Visit qualcanvas.com and click "Start Free" or "Sign In".',
          'Sign in with Google for the fastest setup, or create an email account.',
          'You\'ll land on the Canvas List page where you can create your first workspace.',
        ]} />
        <Screenshot src="/guide/03-new-canvas-templates.png" alt="Canvas template picker" caption="Choose a methodology template or start with a blank canvas" />
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Choose from six methodology templates (Thematic Analysis, Grounded Theory, IPA, Framework Analysis, Content Analysis) or start with a blank canvas. Each template comes with pre-configured starter codes.
        </p>
        <ProTip>The Thematic Analysis template is perfect for beginners — it sets up codes based on Braun & Clarke's framework.</ProTip>
      </>
    ),
  },
  {
    id: 'workspace',
    title: 'The Canvas Workspace',
    icon: '2',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The canvas workspace is where all your research happens. It's built on an infinite, zoomable canvas where you can arrange transcripts, codes, memos, and analysis nodes visually.
        </p>
        <Screenshot src="/guide/08-canvas-workspace.png" alt="Canvas workspace with data" caption="The canvas workspace with transcripts, codes, edges, memos, and analysis nodes" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">Key Areas</h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <li><strong>Toolbar (top):</strong> Primary data tools (Transcript, Survey, Code, Memo) plus dropdown menus for AI, Tools, Export, and Analysis.</li>
          <li><strong>Navigator (left sidebar):</strong> Shows all your codes and sources at a glance. Click any code to see its coded passages.</li>
          <li><strong>Canvas (center):</strong> The infinite workspace where you drag, connect, and arrange nodes.</li>
          <li><strong>Status bar (bottom):</strong> Shows document count, coding progress, collaboration status, and zoom level.</li>
          <li><strong>Controls (bottom-left):</strong> Zoom in/out, fit view, and toggle interactivity.</li>
        </ul>
        <Screenshot src="/guide/05-toolbar.png" alt="Toolbar with dropdown menus" caption="The toolbar with AI, Tools, and Export dropdown menus" />
        <ProTip>Press Ctrl+K anytime to open the Command Palette — search for any action instantly.</ProTip>
      </>
    ),
  },
  {
    id: 'transcripts',
    title: 'Adding Transcripts',
    icon: '3',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Everything starts with your data. Import interview transcripts by pasting text, uploading CSV files, or dragging .txt files directly onto the canvas.
        </p>
        <Steps steps={[
          'Click the "Transcript" button in the toolbar (or press Ctrl+K and type "transcript").',
          'Choose "Paste Text" to enter text directly, or "Import CSV" for batch import.',
          'Give your transcript a title (e.g., the participant\'s pseudonym).',
          'The transcript appears as a node on the canvas that you can drag and resize.',
        ]} />
        <Screenshot src="/guide/06-add-transcript.png" alt="Adding a transcript" caption="Click the Transcript button to add interview data to your canvas" />
        <ProTip>Import multiple interviews from a single CSV file — use columns for title and content.</ProTip>
      </>
    ),
  },
  {
    id: 'codes',
    title: 'Creating Codes',
    icon: '4',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Codes are the labels you use to tag themes in your data. Think of them as colored highlighters — each code marks a concept you want to track across interviews.
        </p>
        <Steps steps={[
          'Click the "Code" button in the toolbar.',
          'Type your code name (e.g., "Trust Issues", "Barriers to Care").',
          'Press Enter — a new code node appears on the canvas with a unique color.',
          'Create as many codes as you need. Pro plan users get unlimited codes.',
        ]} />
        <Screenshot src="/guide/12-navigator.png" alt="Canvas with codes in navigator" caption="Color-coded codes visible in the navigator sidebar with frequency bars" />
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Each code gets a distinct color so you can instantly see which themes appear where. You can organize codes into hierarchies using the Hierarchy tool in the Tools menu.
        </p>
        <ProTip>Use short, descriptive code names. You can always rename them later by double-clicking the code node.</ProTip>
      </>
    ),
  },
  {
    id: 'coding',
    title: 'Coding Your Data',
    icon: '5',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Coding is the core activity — you select text in a transcript and assign it to a code. Lines automatically connect transcripts to codes, creating a visual network of your analysis.
        </p>
        <Steps steps={[
          'Click on a transcript node to open it.',
          'Select (highlight) a passage of text that represents a theme.',
          'A popup appears — choose the code to assign.',
          'A colored edge connects the transcript to the code, showing the relationship.',
          'Repeat across all your transcripts to build a rich coding network.',
        ]} />
        <Screenshot src="/guide/07-transcript-node.png" alt="Transcript node with text visible" caption="A transcript node on the canvas — select text to start coding" />
        <ProTip>The more you code, the richer your visual network becomes. Codes with many connections indicate strong themes in your data.</ProTip>
      </>
    ),
  },
  {
    id: 'navigator',
    title: 'Code Navigator',
    icon: '6',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The Code Navigator in the left sidebar gives you a real-time overview of your codebook. It shows every code with a frequency bar indicating how often each code was used.
        </p>
        <Screenshot src="/guide/12-navigator.png" alt="Code navigator sidebar" caption="The Codes tab shows all codes sorted by frequency with color-coded bars" />
        <Steps steps={[
          'Click "Codes" tab to see all codes sorted by frequency or alphabetically.',
          'Click any code to highlight its connections on the canvas and see all coded passages.',
          'Click "Sources" tab to see all transcripts with their coding coverage.',
          'Use the filter box to search for specific codes.',
        ]} />
        <ProTip>Toggle between "By count" and "A-Z" sorting to see your most-used codes vs. alphabetical order.</ProTip>
      </>
    ),
  },
  {
    id: 'analysis',
    title: 'Analysis Tools',
    icon: '7',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          QualCanvas includes 10 analysis tools organized into three categories. Click the "Analyze" button in the toolbar to add analysis nodes to your canvas.
        </p>
        <Screenshot src="/guide/15-analyze-menu.png" alt="Analysis tools menu" caption="10 analysis types organized by category: Text, Coding, and Frameworks" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">Available Analysis Types</h3>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-4 mb-1">Text Analysis</p>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li><strong>Text Search:</strong> Find patterns across transcripts with regex support.</li>
          <li><strong>Word Cloud:</strong> Visualize word frequency across coded passages.</li>
          <li><strong>Sentiment:</strong> Positive/negative/neutral analysis of coded text.</li>
        </ul>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-4 mb-1">Coding Analysis</p>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li><strong>Statistics:</strong> Code frequency, distribution, and coverage metrics.</li>
          <li><strong>Co-occurrence:</strong> Matrix showing which codes appear together.</li>
          <li><strong>Coding Query:</strong> Boolean AND/OR/NOT queries on your codings.</li>
          <li><strong>Clustering:</strong> Group similar coded segments together.</li>
        </ul>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-4 mb-1">Frameworks & Comparison</p>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li><strong>Framework Matrix:</strong> Case x Question grid for structured analysis.</li>
          <li><strong>Comparison:</strong> Compare coding patterns across transcripts.</li>
          <li><strong>Theme Map:</strong> Visual theme proportions across your data.</li>
        </ul>
        <ProTip>Analysis nodes update live as you add more codings. Keep a word cloud on your canvas to see patterns emerge in real time.</ProTip>
      </>
    ),
  },
  {
    id: 'ai',
    title: 'AI Features',
    icon: '8',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          QualCanvas integrates with OpenAI, Anthropic, and Google AI to supercharge your analysis. Bring your own API key — you pay your AI provider directly.
        </p>
        <Screenshot src="/guide/13-ai-dropdown.png" alt="AI tools dropdown" caption="Four AI-powered tools in the AI menu" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">AI Tools</h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <li><strong>Auto-Code:</strong> Scan transcripts and apply codes by keyword or regex pattern.</li>
          <li><strong>AI Code:</strong> Get intelligent coding suggestions based on your existing codebook.</li>
          <li><strong>AI Chat:</strong> Ask questions about your data in natural language. Get answers with citations.</li>
          <li><strong>Summarize:</strong> Generate concise overviews of transcripts or coded passages.</li>
        </ul>
        <Steps steps={[
          'Go to Account Settings and add your API key (OpenAI, Anthropic, or Google).',
          'Click the "AI" dropdown in the toolbar.',
          'Choose the AI tool you want to use.',
          'Follow the prompts — AI suggestions are always reviewed by you before applying.',
        ]} />
        <ProTip>Try AI Chat with "What are the main themes across all interviews?" — it searches all your transcripts and synthesizes an answer.</ProTip>
      </>
    ),
  },
  {
    id: 'cases',
    title: 'Cases & Cross-Case',
    icon: '9',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Group transcripts into cases (e.g., by participant, site, or time period) and compare coding patterns across cases using the framework matrix.
        </p>
        <Steps steps={[
          'Open Tools > Cases from the toolbar.',
          'Create a new case and assign transcripts to it.',
          'Add attributes to cases (e.g., age, location, role).',
          'Use Tools > Cross-Case to compare coding patterns across cases.',
        ]} />
        <ProTip>Cases are powerful for multi-site studies — compare coding patterns between different research sites or participant groups.</ProTip>
      </>
    ),
  },
  {
    id: 'ethics',
    title: 'Ethics & Compliance',
    icon: '10',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          QualCanvas includes built-in ethics and compliance tools to help you manage consent, anonymize data, and maintain an audit trail for your research.
        </p>
        <Steps steps={[
          'Open Tools > Ethics from the toolbar.',
          'Record consent for each participant with status tracking.',
          'Set data retention dates and anonymization policies.',
          'Anonymize transcripts with automatic name/location replacement.',
          'View the full audit trail of all actions on your canvas.',
        ]} />
        <ProTip>Set up ethics compliance before adding data — it's easier to track consent from the start than to retroactively add it.</ProTip>
      </>
    ),
  },
  {
    id: 'export',
    title: 'Import & Export',
    icon: '11',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Export your work in multiple formats for publication, sharing, or interoperability with other qualitative analysis tools.
        </p>
        <Screenshot src="/guide/18-export-dropdown.png" alt="Export options" caption="Export PNG, HTML/MD reports, QDPX export and import" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">Export Formats</h3>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li><strong>PNG Image:</strong> Save your canvas as a high-resolution image.</li>
          <li><strong>HTML/Markdown Report:</strong> Generate a formatted analysis report with excerpts and statistics.</li>
          <li><strong>QDPX:</strong> Export for NVivo and ATLAS.ti interoperability (open standard).</li>
          <li><strong>CSV:</strong> Export codebook, codings, or excerpts as spreadsheets.</li>
          <li><strong>Codebook:</strong> Export your complete codebook with definitions and frequencies.</li>
        </ul>
        <ProTip>QDPX is the open standard for qualitative data exchange — use it to move projects between QualCanvas, NVivo, and ATLAS.ti.</ProTip>
      </>
    ),
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    icon: '12',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Team plan users can collaborate in real time on the same canvas. See who's online, where they're working, and what they're coding — all live.
        </p>
        <Screenshot src="/guide/19-share-modal.png" alt="Share canvas modal" caption="Generate share codes so collaborators can clone and work on your canvas" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">Collaboration Features</h3>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li><strong>Presence Avatars:</strong> See who's currently viewing the canvas.</li>
          <li><strong>Live Cursors:</strong> Watch other researchers' cursors move in real time.</li>
          <li><strong>Real-time Sync:</strong> All changes sync instantly via WebSocket.</li>
          <li><strong>Intercoder Reliability:</strong> Run Cohen's Kappa with one click (Team plan).</li>
          <li><strong>Share Codes:</strong> Generate share codes so collaborators can access your canvas.</li>
        </ul>
        <ProTip>Run intercoder reliability (Kappa) after independent coding sessions to measure agreement between researchers.</ProTip>
      </>
    ),
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    icon: '13',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Power users love keyboard shortcuts. QualCanvas has 20+ shortcuts that are fully customizable.
        </p>
        <Screenshot src="/guide/23-command-palette.png" alt="Command palette" caption="Press Ctrl+K to open the Command Palette — search any action, code, or transcript" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">Essential Shortcuts</h3>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300 font-mono">
          <li><kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">Ctrl+K</kbd> — Command Palette (search any action)</li>
          <li><kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">Ctrl+Z</kbd> — Undo</li>
          <li><kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">Ctrl+Shift+Z</kbd> — Redo</li>
          <li><kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">F</kbd> — Fit view (show all nodes)</li>
          <li><kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">?</kbd> — Show all keyboard shortcuts</li>
          <li><kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">Delete</kbd> — Delete selected nodes</li>
          <li><kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">Alt+Drag</kbd> — Duplicate a node</li>
        </ul>
        <ProTip>Press ? on the canvas to see all shortcuts. Every shortcut can be remapped in the shortcuts modal.</ProTip>
      </>
    ),
  },
  {
    id: 'billing',
    title: 'Account & Billing',
    icon: '14',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          QualCanvas offers three plans: Free, Pro ($12/mo), and Team ($29/mo per seat). Upgrade anytime from the Pricing page or Account settings.
        </p>
        <Screenshot src="/guide/20-pricing.png" alt="Pricing plans" caption="Free, Pro, and Team plans with feature comparison" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">Plan Comparison</h3>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li><strong>Free:</strong> 1 canvas, 2 transcripts, 5 codes, stats & word cloud only.</li>
          <li><strong>Pro ($12/mo):</strong> Unlimited everything, all 12 analysis tools, AI features, ethics panel, 5 share codes.</li>
          <li><strong>Team ($29/mo):</strong> Everything Pro + unlimited shares, intercoder reliability, team management.</li>
        </ul>
        <ProTip>Academic users with a .edu email get 40% off automatically at checkout. Annual billing saves 25%.</ProTip>
      </>
    ),
  },
  {
    id: 'mobile',
    title: 'Mobile & Accessibility',
    icon: '15',
    content: (
      <>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          QualCanvas works on any device — desktop, tablet, or phone. The interface adapts to your screen size, and dark mode is supported throughout.
        </p>
        <Screenshot src="/guide/25-dark-mode.png" alt="Dark mode canvas" caption="Full dark mode support — toggle via the moon/sun icon in the header" />
        <Screenshot src="/guide/24-mobile-canvas.png" alt="Mobile canvas view" caption="Responsive design on a 375px mobile viewport" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">Accessibility Features</h3>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li><strong>Dark Mode:</strong> Toggle via the moon icon in the header. Follows system preference on first visit.</li>
          <li><strong>Responsive Layout:</strong> Toolbar collapses into dropdown menus on small screens.</li>
          <li><strong>Touch Gestures:</strong> Pinch to zoom, swipe to pan on touch devices.</li>
          <li><strong>Keyboard Navigation:</strong> Full keyboard accessibility with skip links and focus management.</li>
          <li><strong>Offline Mode:</strong> Canvas data is cached locally for offline access.</li>
        </ul>
        <ProTip>Install QualCanvas as a PWA (Progressive Web App) for a native app experience — look for the install prompt in your browser.</ProTip>
      </>
    ),
  },
];

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = 'Guide — QualCanvas';
    return () => { document.title = 'QualCanvas - Qualitative Coding'; };
  }, []);

  // Track scroll position to highlight active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );

    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
              &larr; Home
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">QualCanvas Guide</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/pricing" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
              Pricing
            </Link>
            <Link to="/login" className="btn-primary px-4 py-1.5 text-sm">
              Get Started
            </Link>
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl flex">
        {/* Sidebar Navigation */}
        <nav className={`${sidebarOpen ? 'block' : 'hidden'} lg:block fixed lg:sticky top-14 z-30 w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 h-[calc(100vh-3.5rem)]`}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Contents</p>
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeSection === s.id
                      ? 'bg-brand-50 text-brand-700 font-medium dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
                    activeSection === s.id
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {s.icon}
                  </span>
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content */}
        <main className="flex-1 px-6 py-10 lg:px-12 max-w-4xl">
          {/* Hero */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Complete Guide to QualCanvas
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl">
              Learn how to use every feature of QualCanvas — from importing your first transcript to publishing your analysis. This guide covers the complete qualitative research workflow.
            </p>
          </div>

          {/* Sections */}
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="mb-16 scroll-mt-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                {section.title}
              </h2>
              {section.content}
            </section>
          ))}

          {/* CTA */}
          <div className="mt-16 mb-8 rounded-2xl bg-gradient-to-br from-brand-50 to-blue-50 dark:from-brand-900/20 dark:to-blue-900/20 p-8 text-center border border-brand-200 dark:border-brand-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ready to start coding?</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-5">Create your free account and begin analyzing qualitative data in minutes.</p>
            <Link to="/login" className="btn-primary px-6 py-2.5 text-sm inline-block">
              Create Free Account
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
