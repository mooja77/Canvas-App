import { Link } from 'react-router-dom';
import PageShell from '../components/marketing/PageShell';
import { YouTubeVideoCard } from '../components/training/YouTubeVideoCard';
import {
  firstProjectLearningPath,
  trainingCategories,
  trainingPlaylists,
  trainingVideos,
  youtubeChannelUrl,
} from '../data/trainingVideos';
import { usePageMeta } from '../hooks/usePageMeta';

const learningPath = firstProjectLearningPath.map((id) => {
  const video = trainingVideos.find((candidate) => candidate.id === id);
  if (!video) throw new Error(`Training video ${id} is missing`);
  return video;
});

const audienceRoutes = [
  {
    title: 'New to qualitative software',
    description: 'Start with the calm beginner walkthrough, then add one transcript and code one passage.',
    videoId: '02',
  },
  {
    title: 'PhD and dissertation research',
    description: 'Build a trail that can support supervision, methods writing and later examination.',
    videoId: '11',
  },
  {
    title: 'Research teams',
    description: 'Align roles and definitions, work independently, then review disagreement in context.',
    videoId: '07',
  },
  {
    title: 'Methods teaching',
    description: 'Use synthetic examples to make coding decisions visible and discussable with learners.',
    videoId: '12',
  },
  {
    title: 'UX, service and applied research',
    description: 'Connect interview and survey evidence to a visible, reviewable research handoff.',
    videoId: '18',
  },
] as const;

export function TrainingPage() {
  usePageMeta(
    'QualCanvas Training Centre — Short Qualitative Research Tutorials',
    'Learn QualCanvas with focused videos for first projects, transcripts, survey data, cases, analysis, repositories, collaboration, privacy, export and applied research.',
  );

  return (
    <PageShell>
      <section
        className="border-y border-gray-200 bg-slate-950 text-white dark:border-gray-800"
        aria-labelledby="training-heading"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              QualCanvas training centre
            </p>
            <h1 id="training-heading" className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              Learn one research outcome at a time.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Eighteen short, practical videos made from the real QualCanvas interface. Start with synthetic material,
              keep the evidence visible and build a process you can explain.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#learning-path"
                className="rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400"
              >
                Follow the first-project path
              </a>
              <a
                href="#video-library"
                className="rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold text-white hover:border-slate-400"
              >
                Browse all videos
              </a>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <div className="rounded-xl bg-slate-950/70 p-4">
              <dt className="text-xs uppercase tracking-wider text-slate-400">Videos</dt>
              <dd className="mt-1 text-3xl font-bold text-amber-400">18</dd>
            </div>
            <div className="rounded-xl bg-slate-950/70 p-4">
              <dt className="text-xs uppercase tracking-wider text-slate-400">Typical lesson</dt>
              <dd className="mt-1 text-3xl font-bold text-amber-400">1–2 min</dd>
            </div>
            <div className="col-span-2 rounded-xl bg-slate-950/70 p-4">
              <dt className="text-xs uppercase tracking-wider text-slate-400">Every example</dt>
              <dd className="mt-1 text-base font-semibold text-white">Fictional, synthetic and safe to learn from</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="learning-path" className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="learning-path-heading">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
            First-time user path
          </p>
          <h2 id="learning-path-heading" className="mt-2 text-3xl font-bold text-gray-950 dark:text-white">
            From first look to complete handoff
          </h2>
          <p className="mt-4 leading-7 text-gray-600 dark:text-gray-300">
            Follow these lessons in order for a calm first project. The sequence finishes with the complete workflow so
            you can connect each focused task.
          </p>
        </div>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {learningPath.map((video, index) => (
            <li
              key={video.id}
              className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950"
            >
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 font-semibold text-gray-950 dark:text-white">{video.shortTitle}</h3>
              <a
                className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                href={`#video-${video.id}`}
              >
                Go to lesson
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/60"
        aria-labelledby="audience-heading"
      >
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="audience-heading" className="text-3xl font-bold text-gray-950 dark:text-white">
            Choose the route that matches your work
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {audienceRoutes.map((route) => (
              <article
                key={route.title}
                className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
              >
                <h3 className="font-semibold text-gray-950 dark:text-white">{route.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{route.description}</p>
                <a
                  href={`#video-${route.videoId}`}
                  className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                >
                  Open this route
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="border-y border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
        aria-labelledby="youtube-playlists-heading"
      >
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
              Learn on YouTube
            </p>
            <h2 id="youtube-playlists-heading" className="mt-2 text-3xl font-bold text-gray-950 dark:text-white">
              Four paths through the video library
            </h2>
            <p className="mt-4 leading-7 text-gray-600 dark:text-gray-300">
              Save the path that fits your work now. Videos are added to these public playlists as each master and its
              English captions pass YouTube publishing checks.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {trainingPlaylists.map((playlist) => (
              <article
                key={playlist.url}
                className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950"
              >
                <h3 className="font-semibold text-gray-950 dark:text-white">{playlist.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{playlist.outcome}</p>
                <a
                  href={playlist.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                >
                  Open playlist on YouTube ↗
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="video-library" className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="library-heading">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
              Video library
            </p>
            <h2 id="library-heading" className="mt-2 text-3xl font-bold text-gray-950 dark:text-white">
              Focused help, grouped by outcome
            </h2>
          </div>
          <a
            href={youtubeChannelUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            Visit the QualCanvas YouTube channel ↗
          </a>
        </div>

        <div className="mt-12 space-y-16">
          {trainingCategories.map((category) => {
            const videos = trainingVideos.filter((video) => video.category === category);
            return (
              <section key={category} aria-labelledby={`category-${category.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
                <h3
                  id={`category-${category.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                  className="mb-5 text-2xl font-semibold text-gray-950 dark:text-white"
                >
                  {category}
                </h3>
                <div className={`grid gap-6 ${videos.length === 1 ? 'max-w-2xl' : 'md:grid-cols-2'}`}>
                  {videos.map((video) => (
                    <div
                      id={`video-${video.id}`}
                      key={video.id}
                      className={video.id === '01' ? 'scroll-mt-6 md:col-span-2' : 'scroll-mt-6'}
                    >
                      <YouTubeVideoCard video={video} featured={video.id === '01'} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <aside
        className="border-t border-gray-200 bg-amber-50 dark:border-gray-800 dark:bg-amber-950/20"
        aria-labelledby="video-privacy-heading"
      >
        <div className="mx-auto max-w-4xl px-4 py-12">
          <h2 id="video-privacy-heading" className="text-xl font-semibold text-gray-950 dark:text-white">
            Video privacy and research boundaries
          </h2>
          <p className="mt-3 leading-7 text-gray-700 dark:text-gray-300">
            Video thumbnails are stored by QualCanvas. YouTube is contacted only after you choose Play; the player then
            uses YouTube&apos;s privacy-enhanced domain and may receive your IP address, browser information and viewing
            activity. You can instead follow the direct YouTube link. See our{' '}
            <Link to="/privacy" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link to="/cookies" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Cookie Policy
            </Link>
            .
          </p>
          <p className="mt-3 leading-7 text-gray-700 dark:text-gray-300">
            Tutorials use synthetic material. For real research, your consent terms, ethics approval and institutional
            policy remain the controlling boundaries.
          </p>
        </div>
      </aside>
    </PageShell>
  );
}
