import { useState, useEffect, useCallback } from 'react';
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
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [newInsightTitle, setNewInsightTitle] = useState('');
  const [newInsightContent, setNewInsightContent] = useState('');
  const [showNewInsight, setShowNewInsight] = useState(false);

  const loadRepositories = useCallback(async () => {
    try {
      const res = await canvasApi.getRepositories();
      setRepositories(res.data.repositories);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.response?.status !== 403) {
        toast.error('Failed to load repositories');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInsights = useCallback(async (repoId: string) => {
    try {
      const res = await canvasApi.getInsights(repoId);
      setInsights(res.data.insights);
    } catch {
      toast.error('Failed to load insights');
    }
  }, []);

  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

  useEffect(() => {
    if (selectedRepoId) {
      loadInsights(selectedRepoId);
    }
  }, [selectedRepoId, loadInsights]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Research Repository</h1>
            <p className="text-sm text-gray-500 mt-1">
              Collect and organize insights across your research projects.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/canvas"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Back to Canvas
            </Link>
            <button
              onClick={() => setShowNewRepo(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              New Repository
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Repository list */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Repositories
            </h2>
            {repositories.length === 0 && (
              <p className="text-sm text-gray-400 italic">No repositories yet.</p>
            )}
            {repositories.map((repo) => (
              <div
                key={repo.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedRepoId === repo.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => setSelectedRepoId(repo.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">{repo.name}</h3>
                    {repo.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{repo.description}</p>
                    )}
                    <span className="text-xs text-gray-400 mt-1 block">
                      {repo._count?.insights || 0} insights
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRepo(repo.id);
                    }}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Delete repository"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                  placeholder="Repository name"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newRepoDesc}
                  onChange={(e) => setNewRepoDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateRepo} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                    Create
                  </button>
                  <button onClick={() => setShowNewRepo(false)} className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Insights panel */}
          <div className="md:col-span-2">
            {selectedRepoId ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Insights
                  </h2>
                  <button
                    onClick={() => setShowNewInsight(true)}
                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Add Insight
                  </button>
                </div>

                {showNewInsight && (
                  <div className="mb-4 p-4 rounded-lg border border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10 space-y-2">
                    <input
                      type="text"
                      placeholder="Insight title"
                      value={newInsightTitle}
                      onChange={(e) => setNewInsightTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                      autoFocus
                    />
                    <textarea
                      placeholder="Insight content"
                      value={newInsightContent}
                      onChange={(e) => setNewInsightContent(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 h-24 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleCreateInsight} className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                        Save
                      </button>
                      <button onClick={() => setShowNewInsight(false)} className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {insights.length === 0 && !showNewInsight && (
                  <p className="text-sm text-gray-400 italic">No insights yet. Add one to get started.</p>
                )}

                <div className="space-y-3">
                  {insights.map((insight) => {
                    let tags: string[] = [];
                    try { tags = JSON.parse(insight.tags); } catch { /* ignore */ }
                    return (
                      <div
                        key={insight.id}
                        className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-start justify-between">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">{insight.title}</h3>
                          <button
                            onClick={() => handleDeleteInsight(insight.id)}
                            className="text-gray-400 hover:text-red-500 p-1 -mt-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">{insight.content}</p>
                        {tags.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {tags.map((tag, i) => (
                              <span key={i} className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="text-[10px] text-gray-400 mt-2 block">
                          {new Date(insight.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-gray-400">
                Select a repository to view its insights
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
