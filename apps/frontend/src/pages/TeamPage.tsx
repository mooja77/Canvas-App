import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { teamApi } from '../services/api';
import toast from 'react-hot-toast';
import { usePageMeta } from '../hooks/usePageMeta';

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  owner: { id: string; name: string; email: string };
  members: TeamMember[];
  myRole?: string;
  memberCount?: number;
}

export default function TeamPage() {
  usePageMeta('Team — QualCanvas', 'Manage your QualCanvas team members, invitations, and collaborative workspace.');
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { plan } = useAuthStore();

  const loadTeams = useCallback(async () => {
    try {
      const res = await teamApi.list();
      const teamList = res.data.data || [];
      setTeams(teamList);
      if (teamList.length > 0) {
        // Load full details of first team
        const detailRes = await teamApi.get(teamList[0].id);
        setActiveTeam(detailRes.data.data);
      }
    } catch {
      // No teams or error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      const res = await teamApi.create(teamName.trim());
      toast.success('Team created');
      const newTeam = res.data.data;
      setActiveTeam(newTeam);
      setTeams([newTeam]);
      setTeamName('');
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((err as any)?.response?.data?.error || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeam || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await teamApi.invite(activeTeam.id, inviteEmail.trim());
      toast.success(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      // Reload team details
      const res = await teamApi.get(activeTeam.id);
      setActiveTeam(res.data.data);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((err as any)?.response?.data?.error || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!activeTeam) return;
    if (!confirm(`Remove ${userName} from the team?`)) return;
    try {
      await teamApi.removeMember(activeTeam.id, userId);
      toast.success(`${userName} removed from team`);
      const res = await teamApi.get(activeTeam.id);
      setActiveTeam(res.data.data);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((err as any)?.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleDeleteTeam = async () => {
    if (!activeTeam) return;
    setDeleting(true);
    try {
      await teamApi.deleteTeam(activeTeam.id);
      toast.success('Team deleted');
      setActiveTeam(null);
      setTeams([]);
      setShowDeleteConfirm(false);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((err as any)?.response?.data?.error || 'Failed to delete team');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Find the current user's role in the active team
  const myMembership = activeTeam?.members?.find(
    (m: TeamMember) => m.userId === activeTeam.ownerId && activeTeam.owner
  );
  const myRole = teams[0]?.myRole || myMembership?.role || 'member';
  const canManage = ['owner', 'admin'].includes(myRole);

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      admin: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      member: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    };
    return (
      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${colors[role] || colors.member}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team</h1>
          <Link to="/canvas" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            Back to canvas
          </Link>
        </div>

        {!activeTeam ? (
          /* No team — show create form */
          <div className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6">
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Team Yet</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                Create a team to collaborate with others, manage members, and use intercoder reliability features.
              </p>
              {plan !== 'team' ? (
                <div className="space-y-3">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Team features require a Team plan.
                  </p>
                  <Link
                    to="/pricing"
                    className="inline-block px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    Upgrade to Team
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Team name"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    className="w-full max-w-xs mx-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <div>
                    <button
                      onClick={handleCreateTeam}
                      disabled={creating || !teamName.trim()}
                      className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
                    >
                      {creating ? 'Creating...' : 'Create a Team'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Has team — show details */
          <>
            {/* Team Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Team Info</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{activeTeam.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Created {new Date(activeTeam.createdAt).toLocaleDateString()} by {activeTeam.owner?.name || 'Unknown'}
                  </p>
                </div>
                {roleBadge(myRole)}
              </div>
            </div>

            {/* Members */}
            <div className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Members ({activeTeam.members?.length || 0})
              </h2>
              <div className="space-y-3">
                {activeTeam.members?.map((member: TeamMember) => (
                  <div key={member.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {member.user.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {roleBadge(member.role)}
                      {canManage && member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.userId, member.user.name)}
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Remove member"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite Form */}
            {canManage && (
              <div className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Invite Member</h2>
                <form onSubmit={handleInvite} className="flex gap-3">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail.trim()}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {inviting ? 'Inviting...' : 'Invite'}
                  </button>
                </form>
              </div>
            )}

            {/* Danger Zone */}
            {myRole === 'owner' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl ring-2 ring-red-200 dark:ring-red-900/50 p-6">
                <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">Danger Zone</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Permanently delete this team and remove all members. This action cannot be undone.
                </p>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
                  >
                    Delete Team
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteTeam}
                      disabled={deleting}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : 'Delete Forever'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
