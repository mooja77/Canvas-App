import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { canvasApi } from '../services/api';
import toast from 'react-hot-toast';
import { usePageMeta } from '../hooks/usePageMeta';

interface Repository {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count?: { insights: number };
}

interface Insight {
  id: string;
  repositoryId: string;
  canvasId: string | null;
  title: string;
  content: string;
  tags: string;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
}

export default function RepositoryPage() {
  usePageMeta('Repository — QualCanvas', 'Manage your QualCanvas research repositories and insights.');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [repositoryError, setRepositoryError] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState(false);
  const repositoryRequest = useRef(0);
  const insightRequest = useRef(0);
  const repositoryRegion = useRef<HTMLDivElement>(null);
  const insightRegion = useRef<HTMLDivElement>(null);
  const focusRepositories = useRef(false);
  const focusInsights = useRef(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [newInsightTitle, setNewInsightTitle] = useState('');
  const [newInsightContent, setNewInsightContent] = useState('');
  const [showNewInsight, setShowNewInsight] = useState(false);

  const loadRepositories = useCallback(async () => {
    const request = ++repositoryRequest.current;
    setLoading(true);
    setRepositoryError(false);
    try {
      const res = await canvasApi.getRepositories();
      if (
        !Array.isArray(res.data.repositories) ||
        res.data.repositories.some(
          (repo: Repository) => !repo || typeof repo.id !== 'string' || typeof repo.name !== 'string',
        )
      ) {
        throw new Error('Invalid repository response');
      }
      if (request !== repositoryRequest.current) return;
      setRepositories(res.data.repositories);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (request !== repositoryRequest.current) return;
      setRepositoryError(true);
      if (err.response?.status !== 403) {
        toast.error('Failed to load repositories');
      }
    } finally {
      if (request === repositoryRequest.current) setLoading(false);
    }
  }, []);

  const loadInsights = useCallback(async (repoId: string) => {
    const request = ++insightRequest.current;
    setInsightLoading(true);
    setInsightError(false);
    setInsights([]);
    try {
      const res = await canvasApi.getInsights(repoId);
      if (
        !Array.isArray(res.data.insights) ||
        res.data.insights.some(
          (insight: Insight) =>
            !insight ||
            typeof insight.id !== 'string' ||
            typeof insight.title !== 'string' ||
            typeof insight.content !== 'string',
        )
      ) {
        throw new Error('Invalid insight response');
      }
      if (request !== insightRequest.current) return;
      setInsights(res.data.insights);
    } catch {
      if (request !== insightRequest.current) return;
      setInsightError(true);
      toast.error('Failed to load insights');
    } finally {
      if (request === insightRequest.current) setInsightLoading(false);
    }
  }, []);

  useEffect(() => {
    const repositoryCounter = repositoryRequest;
    const insightCounter = insightRequest;
    loadRepositories();
    return () => {
      repositoryCounter.current++;
      insightCounter.current++;
    };
  }, [loadRepositories]);

  useEffect(() => {
    const insightCounter = insightRequest;
    if (selectedRepoId) {
      loadInsights(selectedRepoId);
    }
    return () => {
      insightCounter.current++;
    };
  }, [selectedRepoId, loadInsights]);

  useEffect(() => {
    if (!loading && !repositoryError && focusRepositories.current) {
      repositoryRegion.current?.focus();
      focusRepositories.current = false;
    }
  }, [loading, repositoryError]);

  useEffect(() => {
    if (!insightLoading && !insightError && focusInsights.current) {
      insightRegion.current?.focus();
      focusInsights.current = false;
    }
  }, [insightLoading, insightError]);

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) return;
    try {
      await canvasApi.createRepository({ name: newRepoName.trim(), description: newRepoDesc.trim() || undefined });
      toast.success('Repository created');
      setNewRepoName('');
      setNewRepoDesc('');
      setShowNewRepo(false);
      loadRepositories();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create repository');
    }
  };

  const handleDeleteRepo = async (id: string) => {
    if (!confirm('Delete this repository and all its insights?')) return;
    try {
      await canvasApi.deleteRepository(id);
      toast.success('Repository deleted');
      if (selectedRepoId === id) {
        setSelectedRepoId(null);
        setInsights([]);
      }
      loadRepositories();
    } catch {
      toast.error('Failed to delete repository');
    }
  };

  const handleCreateInsight = async () => {
    if (!selectedRepoId || !newInsightTitle.trim() || !newInsightContent.trim()) return;
    try {
      await canvasApi.createInsight(selectedRepoId, {
        title: newInsightTitle.trim(),
        content: newInsightContent.trim(),
      });
      toast.success('Insight added');
      setNewInsightTitle('');
      setNewInsightContent('');
      setShowNewInsight(false);
      loadInsights(selectedRepoId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create insight');
    }
  };

  const handleDeleteInsight = async (insightId: string) => {
    if (!selectedRepoId) return;
    try {
      await canvasApi.deleteInsight(selectedRepoId, insightId);
      toast.success('Insight deleted');
      loadInsights(selectedRepoId);
    } catch {
      toast.error('Failed to delete insight');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Research Repository</h1>
            <p className="text-sm text-gray-500 mt-1">Collect and organize insights across your research projects.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/canvas"
              className="inline-flex min-h-[44px] items-center text-sm text-blue-700 dark:text-blue-300 hover:underline"
            >
              Back to Canvas
            </Link>
            <button
              onClick={() => setShowNewRepo(true)}
              className="min-h-[44px] px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              New Repository
            </button>
          </div>
        </div>
        <p className="mb-6 text-sm text-gray-700 dark:text-gray-300">
          Need help organizing or transferring your research?{' '}
          <a
            href="mailto:research@qualcanvas.com?subject=Repository%20setup%20help"
            className="inline-flex min-h-[44px] items-center font-medium text-blue-700 underline dark:text-blue-300"
          >
            Email us
          </a>
          . We’ll reply within two working days. You don’t need to book a call.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Repository list */}
          <div
            ref={repositoryRegion}
            role="region"
            aria-label="Research repositories"
            tabIndex={-1}
            className="space-y-3 min-w-0"
          >
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Repositories
            </h2>
            {loading && (
              <p role="status" aria-label="Loading repositories">
                Loading your repositories…
              </p>
            )}
            {repositoryError && (
              <div
                role="alert"
                className="rounded-lg border border-red-300 bg-white p-4 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              >
                <p>
                  We couldn't load your repositories. This does not mean they are empty. Try again, or return to your
                  canvas.
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-[44px] rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
                  onClick={() => {
                    focusRepositories.current = true;
                    void loadRepositories();
                  }}
                >
                  Try loading repositories again
                </button>
              </div>
            )}
            {!loading && !repositoryError && repositories.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">No repositories yet</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                  A repository keeps findings from several projects in one place, so a theme you found last term is
                  still findable next year.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewRepo(true)}
                  className="mt-3 min-h-[44px] rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
                >
                  Create your first repository
                </button>
                <a
                  href="/training#video-17"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-blue-700 underline dark:text-blue-300"
                >
                  See an example repository (1:44 video)
                </a>
              </div>
            )}
            {!loading &&
              !repositoryError &&
              repositories.map((repo) => (
                <div
                  key={repo.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedRepoId === repo.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <button
                      type="button"
                      aria-label={`Open repository ${repo.name}`}
                      aria-pressed={selectedRepoId === repo.id}
                      onClick={() => {
                        if (selectedRepoId === repo.id) return;
                        insightRequest.current++;
                        setInsights([]);
                        setInsightError(false);
                        setInsightLoading(true);
                        focusInsights.current = false;
                        setSelectedRepoId(repo.id);
                      }}
                      className="min-h-[44px] min-w-0 flex-1 text-left rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">{repo.name}</h3>
                      {repo.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                      <span className="text-xs text-gray-600 dark:text-gray-300 mt-1 block">
                        {typeof repo._count?.insights === 'number'
                          ? `${repo._count.insights} insights`
                          : 'Insight count unavailable'}
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRepo(repo.id);
                      }}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-red-700 p-1"
                      aria-label={`Delete repository ${repo.name}`}
                      title="Delete repository"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

            {/* New repo form */}
            {showNewRepo && (
              <div className="p-3 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 space-y-2">
                <input
                  type="text"
                  aria-label="Repository name"
                  placeholder="Repository name"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  aria-label="Repository description (optional)"
                  value={newRepoDesc}
                  onChange={(e) => setNewRepoDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateRepo}
                    className="min-h-[44px] px-3 py-2 text-sm bg-blue-700 text-white rounded hover:bg-blue-800"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewRepo(false)}
                    className="min-h-[44px] px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Insights panel */}
          <div
            ref={insightRegion}
            role="region"
            aria-label="Repository insights"
            tabIndex={-1}
            className="md:col-span-2 min-w-0"
          >
            {selectedRepoId && !loading && !repositoryError ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Insights
                  </h2>
                  <button
                    onClick={() => setShowNewInsight(true)}
                    className="min-h-[44px] px-3 py-2 text-sm bg-green-700 text-white rounded hover:bg-green-800"
                  >
                    Add Insight
                  </button>
                </div>

                {showNewInsight && (
                  <div className="mb-4 p-4 rounded-lg border border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10 space-y-2">
                    <input
                      type="text"
                      placeholder="Insight title"
                      aria-label="Insight title"
                      value={newInsightTitle}
                      onChange={(e) => setNewInsightTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                      autoFocus
                    />
                    <textarea
                      placeholder="Insight content"
                      aria-label="Insight content"
                      value={newInsightContent}
                      onChange={(e) => setNewInsightContent(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 h-24 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateInsight}
                        className="min-h-[44px] px-3 py-2 text-sm bg-green-700 text-white rounded hover:bg-green-800"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setShowNewInsight(false)}
                        className="min-h-[44px] px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {insightLoading && (
                  <p role="status" aria-label="Loading insights">
                    Loading your insights…
                  </p>
                )}
                {insightError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-300 bg-white p-4 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <p>
                      We couldn't load these insights. This does not mean none are saved. Try again, or choose another
                      repository.
                    </p>
                    <button
                      type="button"
                      className="mt-3 min-h-[44px] rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
                      onClick={() => {
                        focusInsights.current = true;
                        void loadInsights(selectedRepoId);
                      }}
                    >
                      Try loading insights again
                    </button>
                  </div>
                )}
                {!insightLoading && !insightError && insights.length === 0 && !showNewInsight && (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">No insights yet</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      An insight is one finding in a sentence, with the evidence behind it. Keep it here so you can find
                      and share it later.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowNewInsight(true)}
                      className="mt-3 min-h-[44px] rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800"
                    >
                      Add your first insight
                    </button>
                    <a
                      href="/training#video-17"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-blue-700 underline dark:text-blue-300"
                    >
                      See an example insight
                    </a>
                  </div>
                )}

                <div className="space-y-3">
                  {!insightLoading &&
                    !insightError &&
                    insights.map((insight) => {
                      let tags: string[] = [];
                      try {
                        const parsed: unknown = JSON.parse(insight.tags);
                        if (Array.isArray(parsed))
                          tags = parsed.filter((tag): tag is string => typeof tag === 'string');
                      } catch {
                        /* ignore */
                      }
                      return (
                        <div
                          key={insight.id}
                          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                        >
                          <div className="flex items-start justify-between">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">{insight.title}</h3>
                            <button
                              onClick={() => handleDeleteInsight(insight.id)}
                              aria-label={`Delete insight ${insight.title}`}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-red-700 p-1 -mt-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                            {insight.content}
                          </p>
                          {tags.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {tags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <span className="text-xs text-gray-600 dark:text-gray-300 mt-2 block">
                            {new Date(insight.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : !loading && !repositoryError ? (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-5 text-center dark:border-gray-700">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {repositories.length === 0 ? 'Keep your research findings together' : 'Choose a repository'}
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {repositories.length === 0
                    ? 'Create a repository to save insights from your projects in one place.'
                    : 'Choose a repository on the left to see its saved insights.'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewRepo(true)}
                  className="mt-3 min-h-[44px] rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
                >
                  {repositories.length === 0 ? 'Create your first repository' : 'Create another repository'}
                </button>
                <a
                  href="/training#video-17"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-blue-700 underline dark:text-blue-300"
                >
                  See a worked example
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
