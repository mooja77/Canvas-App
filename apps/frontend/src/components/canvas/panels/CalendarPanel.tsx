import { useState, useEffect, useCallback } from 'react';
import { calendarApi } from '../../../services/api';
import type { CalendarEventInput } from '../../../services/api';
import toast from 'react-hot-toast';

interface CalendarPanelProps {
  onClose: () => void;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  allDay: boolean;
  type: 'milestone' | 'deadline' | 'session' | 'review';
  color?: string | null;
  reminder?: number | null;
  canvasId?: string | null;
  teamId?: string | null;
  createdAt: string;
  updatedAt: string;
}

const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  milestone: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  deadline: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  session: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  review: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  milestone: 'Milestone',
  deadline: 'Deadline',
  session: 'Session',
  review: 'Review',
};

export default function CalendarPanel({ onClose }: CalendarPanelProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formAllDay, setFormAllDay] = useState(false);
  const [formType, setFormType] = useState<CalendarEventInput['type']>('milestone');
  const [formReminder, setFormReminder] = useState<number | undefined>(undefined);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filterType !== 'all') params.type = filterType;
      const res = await calendarApi.getEvents(params);
      setEvents(res.data.data || []);
    } catch {
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormStartDate('');
    setFormEndDate('');
    setFormAllDay(false);
    setFormType('milestone');
    setFormReminder(undefined);
    setEditingEvent(null);
    setShowForm(false);
  };

  const openEditForm = (evt: CalendarEvent) => {
    setEditingEvent(evt);
    setFormTitle(evt.title);
    setFormDescription(evt.description || '');
    setFormStartDate(evt.startDate.slice(0, 16));
    setFormEndDate(evt.endDate ? evt.endDate.slice(0, 16) : '');
    setFormAllDay(evt.allDay);
    setFormType(evt.type);
    setFormReminder(evt.reminder ?? undefined);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formStartDate) {
      toast.error('Title and start date are required');
      return;
    }
    setSubmitting(true);
    try {
      const data: CalendarEventInput = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        startDate: new Date(formStartDate).toISOString(),
        endDate: formEndDate ? new Date(formEndDate).toISOString() : undefined,
        allDay: formAllDay,
        type: formType,
        reminder: formReminder,
      };

      if (editingEvent) {
        await calendarApi.updateEvent(editingEvent.id, data);
        toast.success('Event updated');
      } else {
        await calendarApi.createEvent(data);
        toast.success('Event created');
      }
      resetForm();
      loadEvents();
    } catch {
      toast.error(editingEvent ? 'Failed to update event' : 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      await calendarApi.deleteEvent(id);
      toast.success('Event deleted');
      loadEvents();
    } catch {
      toast.error('Failed to delete event');
    }
  };

  const handleExportIcal = async () => {
    try {
      const res = await calendarApi.exportIcal();
      const blob = new Blob([res.data], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qualcanvas-calendar.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Calendar exported');
    } catch {
      toast.error('Failed to export calendar');
    }
  };

  const formatDate = (dateStr: string, allDay: boolean) => {
    const d = new Date(dateStr);
    if (allDay) return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const upcomingEvents = events.filter(e => new Date(e.startDate) >= new Date());
  const pastEvents = events.filter(e => new Date(e.startDate) < new Date());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Research Calendar</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              <option value="all">All types</option>
              <option value="milestone">Milestones</option>
              <option value="deadline">Deadlines</option>
              <option value="session">Sessions</option>
              <option value="review">Reviews</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportIcal}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export .ics
            </button>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Event
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {showForm && (
            <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                {editingEvent ? 'Edit Event' : 'New Event'}
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Event title"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  autoFocus
                />
                <textarea
                  placeholder="Description (optional)"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white resize-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Start</label>
                    <input
                      type={formAllDay ? 'date' : 'datetime-local'}
                      value={formStartDate}
                      onChange={e => setFormStartDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">End (optional)</label>
                    <input
                      type={formAllDay ? 'date' : 'datetime-local'}
                      value={formEndDate}
                      onChange={e => setFormEndDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Type</label>
                    <select
                      value={formType}
                      onChange={e => setFormType(e.target.value as CalendarEventInput['type'])}
                      className="h-7 rounded-lg border border-gray-200 bg-white px-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="milestone">Milestone</option>
                      <option value="deadline">Deadline</option>
                      <option value="session">Session</option>
                      <option value="review">Review</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <input type="checkbox" checked={formAllDay} onChange={e => setFormAllDay(e.target.checked)} className="rounded" />
                    All day
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Reminder</label>
                    <select
                      value={formReminder ?? ''}
                      onChange={e => setFormReminder(e.target.value ? Number(e.target.value) : undefined)}
                      className="h-7 rounded-lg border border-gray-200 bg-white px-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">None</option>
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="60">1 hour</option>
                      <option value="1440">1 day</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={resetForm}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !formTitle.trim() || !formStartDate}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Saving...' : editingEvent ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No events yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add milestones, deadlines, and sessions to track your research timeline.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upcoming */}
              {upcomingEvents.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Upcoming</h3>
                  <div className="space-y-2">
                    {upcomingEvents.map(evt => {
                      const colors = EVENT_TYPE_COLORS[evt.type] || EVENT_TYPE_COLORS.milestone;
                      return (
                        <div key={evt.id} className={`rounded-lg ${colors.bg} p-3 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-colors`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
                              <div className="min-w-0">
                                <p className={`text-sm font-medium ${colors.text}`}>{evt.title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {formatDate(evt.startDate, evt.allDay)}
                                  {evt.endDate && ` - ${formatDate(evt.endDate, evt.allDay)}`}
                                </p>
                                {evt.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{evt.description}</p>
                                )}
                                <span className="inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-white/50 dark:bg-black/20 text-gray-600 dark:text-gray-300">
                                  {EVENT_TYPE_LABELS[evt.type]}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <button
                                onClick={() => openEditForm(evt)}
                                className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-white/50 dark:hover:text-gray-200 dark:hover:bg-black/20 transition-colors"
                                title="Edit"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(evt.id)}
                                className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-white/50 dark:hover:text-red-400 dark:hover:bg-black/20 transition-colors"
                                title="Delete"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Past */}
              {pastEvents.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Past</h3>
                  <div className="space-y-2">
                    {pastEvents.map(evt => {
                      const colors = EVENT_TYPE_COLORS[evt.type] || EVENT_TYPE_COLORS.milestone;
                      return (
                        <div key={evt.id} className="rounded-lg bg-gray-50 dark:bg-gray-700/20 p-3 opacity-60">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${colors.dot} opacity-50`} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{evt.title}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                  {formatDate(evt.startDate, evt.allDay)}
                                </p>
                                <span className="inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                  {EVENT_TYPE_LABELS[evt.type]}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDelete(evt.id)}
                              className="rounded p-1 text-gray-400 hover:text-red-600 transition-colors shrink-0"
                              title="Delete"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with legend */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center gap-4">
          {Object.entries(EVENT_TYPE_COLORS).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
              <span className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
