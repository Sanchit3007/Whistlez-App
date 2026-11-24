import React, { useCallback, useState, useEffect, useRef } from 'react';
import FilterToolbar from '../../components/FilterToolbar';
import { Link, useSearchParams } from 'react-router-dom';
import FormDialog from '../../components/FormDialog';
import UploadField from '../../components/UploadField';
import socket from '../../socket';
import { api } from '../../context/AuthContext';
import './SuperAdminTrending.css';

const scheduleTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone?.replace(/_/g, ' ') || 'Local time';
const oneDay = 24 * 60 * 60 * 1000;

const scheduleField = (instant) => {
  if (instant == null || instant === '') return { value: '' };
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) return { value: '' };
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return { value: local.toISOString().slice(0, 16), instant: date.toISOString() };
};

const readScheduleTime = ({ value, instant }) => {
  if (!value) return null;
  if (instant) return Date.parse(instant);
  const time = Date.parse(value);
  return scheduleField(time).value === value ? time : NaN;
};

const sections = [
  { id: 'overview', label: 'Overview', icon: 'bi-grid' },
  { id: 'topics', label: 'Topics', icon: 'bi-list-ul' },
  { id: 'ranking', label: 'Ranking', icon: 'bi-sliders' },
  { id: 'schedule', label: 'Schedule', icon: 'bi-calendar-event' },
  { id: 'categories', label: 'Category weights', icon: 'bi-tags' },
  { id: 'history', label: 'History', icon: 'bi-clock-history' },
  { id: 'settings', label: 'Settings', icon: 'bi-gear' }
];

const SuperAdminTrending = () => {
  // Navigation Tabs state
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') === 'topics' ? 'topics' : 'overview');

  // Global Config state
  const [config, setConfig] = useState({
    enabled: true,
    topicsPerDay: 50,
    selectionMode: 'hybrid',
    whizleWeight: 40,
    priorityWeight: 20,
    categoryWeight: 15,
    freshnessWeight: 15,
    randomWeight: 10,
    newTopicBoost: true,
    avoidRecentRepeat: true,
    rotationEnabled: true,
    isLocked: false,
    categoryDistribution: {},
    categoryPriorities: {}
  });

  // Topics state
  const [topics, setTopics] = useState([]);
  const topicsSearch = useRef(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRankingType, setFilterRankingType] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [sortField, setSortField] = useState('rank');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Bulk actions state
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');

  // Daily trending history preview state
  const [todayHistory, setTodayHistory] = useState(null);
  const [todayFeedStatus, setTodayFeedStatus] = useState('loading');
  const [feedAction, setFeedAction] = useState(null);
  const [historySummaryList, setHistorySummaryList] = useState([]);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState('');
  const [selectedHistoryFeed, setSelectedHistoryFeed] = useState(null);

  // General Alert state
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });
  
  // Topic Modal CRUD states
  const [modalOpen, setModalOpen] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
  const [topicError, setTopicError] = useState('');
  const [thumbnailError, setThumbnailError] = useState('');
  const [readingThumbnail, setReadingThumbnail] = useState(false);
  const thumbnailReader = useRef(null);
  const [editId, setEditId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formHeading, setFormHeading] = useState('');
  const [formShortText, setFormShortText] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formPriority, setFormPriority] = useState(0);
  const [formStatus, setFormStatus] = useState('active');
  const [formStartAt, setFormStartAt] = useState({ value: '' });
  const [formEndAt, setFormEndAt] = useState({ value: '' });
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formManualPosition, setFormManualPosition] = useState('');
  const [formRankingType, setFormRankingType] = useState('auto');
  const [formIsExcluded, setFormIsExcluded] = useState(false);

  // Standard category list for selection defaults
  const categoriesList = [
    'Technology',
    'Entertainment',
    'Sports',
    'Business',
    'Education',
    'News',
    'Lifestyle',
    'Gaming',
    'Science',
    'Other'
  ];

  const showAlert = useCallback((type, text) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 5000);
  }, []);

  const startTime = readScheduleTime(formStartAt);
  const endTime = readScheduleTime(formEndAt);
  const startError = Number.isNaN(startTime) ? 'Choose a valid start date and time in this time zone.' : '';
  const endError = Number.isNaN(endTime) ? 'Choose a valid end date and time in this time zone.'
    : startTime !== null && endTime !== null && endTime < startTime ? 'Ends must be on or after Starts.' : '';
  const shortcutEnd = Number.isFinite(startTime) ? scheduleField(startTime + oneDay) : { value: '' };

  // Fetch functions
  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/superadmin/trending/config');
      if (res.data.success) {
        setConfig(res.data.config);
      }
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Failed to retrieve configuration');
    }
  }, [showAlert]);

  const fetchTopicsPool = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        search: searchQuery, category: filterCategory, status: filterStatus,
        rankingType: filterRankingType, date: filterDate, sort: sortField,
        page: currentPage, limit: 10
      };
      const res = await api.get('/superadmin/trending/topics', { params });
      if (res.data.success) {
        setTopics(res.data.topics);
        setTotalPages(res.data.pagination.pages || 1);
      }
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Failed to retrieve topics');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterCategory, filterStatus, filterRankingType, filterDate, sortField, currentPage, showAlert]);

  const fetchTodayHistory = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await api.get(`/superadmin/trending/history?date=${todayStr}`);
      if (!res.data.success) throw new Error('Could not load today’s feed.');
      setTodayHistory(res.data.history);
      setTodayFeedStatus('ready');
    } catch (err) {
      console.error(err);
      setTodayFeedStatus('error');
    }
  }, []);

  const fetchHistorySummaries = useCallback(async () => {
    try {
      const res = await api.get('/superadmin/trending/history/summary');
      if (res.data.success) {
        setHistorySummaryList(res.data.historyList || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchSelectedHistoryFeed = async (dateStr) => {
    if (!dateStr) return;
    try {
      const res = await api.get(`/superadmin/trending/history?date=${dateStr}`);
      if (res.data.success) {
        setSelectedHistoryFeed(res.data.history);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllData = useCallback(
    () => Promise.all([fetchConfig(), fetchTopicsPool(), fetchTodayHistory(), fetchHistorySummaries()]),
    [fetchConfig, fetchTopicsPool, fetchTodayHistory, fetchHistorySummaries]
  );

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Socket updates listener
  useEffect(() => {
    socket.emit('joinSuperAdmin');
  }, []);

  useEffect(() => {
    socket.on('trendingUpdated', fetchAllData);
    socket.on('trendingConfigUpdated', fetchAllData);
    socket.on('trendingRegenerated', fetchAllData);
    socket.on('trendingWhizled', fetchAllData);

    return () => {
      socket.off('trendingUpdated', fetchAllData);
      socket.off('trendingConfigUpdated', fetchAllData);
      socket.off('trendingRegenerated', fetchAllData);
      socket.off('trendingWhizled', fetchAllData);
    };
  }, [fetchAllData]);

  // Handle image upload conversions
  const handleImageFile = (e) => {
    const input = e.currentTarget;
    const file = input.files[0];
    if (!file) return;
    thumbnailReader.current = null;
    setReadingThumbnail(false);
    setThumbnailError('');

    if (file.size > 2 * 1024 * 1024 || !file.type.startsWith('image/')) {
      setThumbnailError('Choose an image up to 2 MB.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    thumbnailReader.current = reader;
    setReadingThumbnail(true);
    reader.onload = () => {
      if (thumbnailReader.current !== reader) return;
      setFormImage(reader.result);
      setReadingThumbnail(false);
    };
    reader.onerror = () => {
      if (thumbnailReader.current !== reader) return;
      input.value = '';
      setThumbnailError('Could not read this image. Choose another file.');
      setReadingThumbnail(false);
    };
    reader.readAsDataURL(file);
  };

  const closeTopicForm = () => {
    thumbnailReader.current = null;
    setReadingThumbnail(false);
    setThumbnailError('');
    setTopicError('');
    setModalOpen(false);
  };

  // Open modals
  const openCreateModal = () => {
    setEditId(null);
    setFormTitle('');
    setFormHeading('');
    setFormShortText('');
    setFormDescription('');
    setFormCategory('Technology');
    setFormImage('');
    setFormPriority(0);
    setFormStatus('active');
    setFormStartAt({ value: '' });
    setFormEndAt({ value: '' });
    setFormIsPinned(false);
    setFormManualPosition('');
    setFormRankingType('auto');
    setFormIsExcluded(false);
    setModalOpen(true);
  };

  const openEditModal = (topic) => {
    setEditId(topic._id);
    setFormTitle(topic.title);
    setFormHeading(topic.heading);
    setFormShortText(topic.shortText);
    setFormDescription(topic.description);
    setFormCategory(topic.category);
    setFormImage(topic.image || '');
    setFormPriority(topic.priority);
    setFormStatus(topic.status);
    setFormStartAt(scheduleField(topic.startAt));
    setFormEndAt(scheduleField(topic.endAt));
    setFormIsPinned(topic.isPinned || false);
    setFormManualPosition(topic.manualPosition !== null ? topic.manualPosition : '');
    setFormRankingType(topic.rankingType || 'auto');
    setFormIsExcluded(topic.isExcludedFromRotation || false);
    setModalOpen(true);
  };

  // Create / Update Topic submission
  const handleTopicSubmit = async (e) => {
    e.preventDefault();
    if (savingTopic || readingThumbnail) return;
    if (startError || endError) {
      e.currentTarget.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    setTopicError('');
    setSavingTopic(true);
    const payload = {
      title: formTitle,
      heading: formHeading,
      shortText: formShortText,
      description: formDescription,
      category: formCategory,
      image: formImage,
      priority: parseInt(formPriority),
      status: formStatus,
      startAt: startTime === null ? null : new Date(startTime).toISOString(),
      endAt: endTime === null ? null : new Date(endTime).toISOString(),
      isPinned: formIsPinned,
      manualPosition: formManualPosition !== '' ? parseInt(formManualPosition) : null,
      rankingType: formRankingType,
      isExcludedFromRotation: formIsExcluded
    };

    try {
      let res;
      if (editId) {
        res = await api.put(`/superadmin/trending/topics/${editId}`, payload);
      } else {
        res = await api.post('/superadmin/trending/topics', payload);
      }

      if (res.data.success) {
        showAlert('success', editId ? 'Trending topic updated successfully' : 'Trending topic created successfully');
        closeTopicForm();
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      setTopicError(err.response?.data?.message || 'Could not save the topic. Try again.');
    } finally {
      setSavingTopic(false);
    }
  };

  // Duplicate handler
  const handleDuplicate = async (id) => {
    try {
      const res = await api.post(`/superadmin/trending/topics/${id}/duplicate`);
      if (res.data.success) {
        showAlert('success', 'Topic duplicated successfully (saved as Draft)');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error duplicating topic');
    }
  };

  // Delete handler
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this trending topic? This cannot be undone.')) return;
    try {
      const res = await api.delete(`/superadmin/trending/topics/${id}`);
      if (res.data.success) {
        showAlert('success', 'Topic deleted successfully');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error deleting topic');
    }
  };

  // Quick Inline edits
  const handleQuickStatusChange = async (id, value) => {
    try {
      await api.put(`/superadmin/trending/topics/${id}`, { status: value });
      fetchAllData();
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error updating status');
    }
  };

  const handleQuickPriorityChange = async (id, value) => {
    try {
      await api.put(`/superadmin/trending/topics/${id}`, { priority: parseInt(value) });
      fetchAllData();
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error updating priority');
    }
  };

  const handleQuickPinToggle = async (id, currentVal) => {
    try {
      await api.put(`/superadmin/trending/topics/${id}`, { isPinned: !currentVal });
      fetchAllData();
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error updating pinned override');
    }
  };

  const handleQuickExcludeToggle = async (id, currentVal) => {
    try {
      await api.put(`/superadmin/trending/topics/${id}`, { isExcludedFromRotation: !currentVal });
      fetchAllData();
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error updating rotation exclude');
    }
  };

  // Bulk actions execution
  const handleBulkAction = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one topic');
      return;
    }
    if (!bulkAction) {
      alert('Please select an action');
      return;
    }

    if (bulkAction === 'delete' && !window.confirm(`Are you sure you want to delete ${selectedIds.length} topics?`)) {
      return;
    }

    try {
      const res = await api.post('/superadmin/trending/topics/bulk', {
        ids: selectedIds,
        action: bulkAction,
        value: bulkValue
      });
      if (res.data.success) {
        showAlert('success', 'Bulk action applied successfully');
        setSelectedIds([]);
        setBulkAction('');
        setBulkValue('');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error applying bulk action');
    }
  };

  // Global Config form saves
  const handleSaveConfig = async (updatedFields) => {
    try {
      const res = await api.put('/superadmin/trending/config', {
        ...config,
        ...updatedFields
      });
      if (res.data.success) {
        showAlert('success', 'Global configurations updated successfully');
        fetchConfig();
      }
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error saving configuration');
    }
  };

  // Lock / Unlock toggle
  const handleToggleLock = async () => {
    if (feedAction) return;
    setFeedAction('lock');
    try {
      const nextLocked = !config.isLocked;
      const res = await api.post('/superadmin/trending/lock', { isLocked: nextLocked });
      if (res.data.success) {
        showAlert('success', nextLocked ? 'Today\'s feed is now locked' : 'Today\'s feed is unlocked');
        await fetchConfig();
      }
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error updating locks');
    } finally {
      setFeedAction(null);
    }
  };

  // Regenerate manual trigger
  const handleRegenerate = async () => {
    if (feedAction) return;
    if (!window.confirm('Are you sure you want to regenerate today\'s trending ranks? This will recompute ranking values immediately.')) return;
    setFeedAction('regenerate');
    try {
      const res = await api.post('/superadmin/trending/regenerate', {});
      if (res.data.success) {
        showAlert('success', 'Trending feed generated successfully');
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error regenerating feed');
    } finally {
      setFeedAction(null);
    }
  };

  // Multi select utilities
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(topics.map(t => t._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const openSection = (section) => {
    setActiveTab(section);
    if (section === 'history' && historySummaryList.length > 0) {
      const date = historySummaryList[0].date;
      setSelectedHistoryDate(date);
      fetchSelectedHistoryFeed(date);
    }
  };

  const liveFeed = todayHistory?.topics || [];
  const hasFeedResult = todayFeedStatus === 'ready' || Boolean(todayHistory);
  const feedMetrics = [
    { label: 'Live topics', value: liveFeed.length, icon: 'bi-list-ul' },
    { label: 'Whizles in feed', value: liveFeed.reduce((total, topic) => total + (topic.whizlesCount || 0), 0), icon: 'bi-heart' },
    { label: 'Categories in feed', value: new Set(liveFeed.map(topic => topic.category).filter(Boolean)).size, icon: 'bi-tags' }
  ];
  const generatedAt = todayHistory?.generatedAt;

  return (
    <div className="animated-fade-in pb-5">
      {/* Dynamic Alerts */}
      {alertMsg.text && !modalOpen && (
        <div 
          className={`alert alert-${alertMsg.type} border-0 rounded-3 small shadow position-fixed top-0 end-0 m-4`} 
          style={{ zIndex: 1060 }}
        >
          {alertMsg.text}
        </div>
      )}


      <div className="workspace-heading">
        <div>
          <h1>Trending Editorial Console</h1>
          <p>Manage topics, schedules, and rankings for the public feed.</p>
        </div>
        <div className="trending-toolbar">
          {activeTab !== 'overview' && (
            <button type="button" className="btn btn-outline-primary" onClick={handleRegenerate} disabled={Boolean(feedAction)}>
              <i className="bi bi-arrow-clockwise" aria-hidden="true" /> {feedAction === 'regenerate' ? 'Regenerating…' : 'Regenerate feed'}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            <i className="bi bi-plus-circle" aria-hidden="true" /> Add topic
          </button>
        </div>
      </div>

      <nav className="trending-section-nav" aria-label="Trending console sections">
        <div className="trending-tabs">
          {sections.map(section => (
            <button key={section.id} type="button" className="workspace-tab-button" aria-pressed={activeTab === section.id} onClick={() => openSection(section.id)}>
              <i className={'bi ' + section.icon} aria-hidden="true" /> {section.label}
            </button>
          ))}
        </div>
        <label className="trending-section-picker workspace-field">
          <span>Trending section</span>
          <select className="form-select" value={activeTab} onChange={event => openSection(event.target.value)}>
            {sections.map(section => <option key={section.id} value={section.id}>{section.label}</option>)}
          </select>
        </label>
      </nav>

      {activeTab === 'overview' && (
        <div className="trending-overview">
          <ul className="trending-metrics">
            {feedMetrics.map(metric => (
              <li className="card trending-metric" key={metric.label}>
                <div>
                  <span>{metric.label}</span>
                  <strong>{hasFeedResult ? metric.value.toLocaleString() : '—'}</strong>
                </div>
                <span className="portal-form-icon" aria-hidden="true"><i className={'bi ' + metric.icon} /></span>
              </li>
            ))}
          </ul>

          <section className="card trending-panel" aria-labelledby="trending-feed-heading">
            <div className="trending-panel-header">
              <div>
                <h2 id="trending-feed-heading">Today’s live feed</h2>
                <p className="text-muted small mb-0">
                  {generatedAt ? <>Last generated <time dateTime={generatedAt}>{new Date(generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></> : 'The ranked topics shown to app users.'}
                </p>
              </div>
              <div className="trending-toolbar">
                <Link to="/superadmin/live-mobile" className="btn btn-outline-primary">
                  <i className="bi bi-phone" aria-hidden="true" /> Preview
                </Link>
                <button type="button" className="btn btn-outline-primary" onClick={handleRegenerate} disabled={Boolean(feedAction)}>
                  <i className="bi bi-arrow-repeat" aria-hidden="true" /> {feedAction === 'regenerate' ? 'Regenerating…' : 'Regenerate feed'}
                </button>
              </div>
            </div>

            {todayFeedStatus === 'loading' && <p className="trending-feed-message mb-0" role="status">Loading today’s feed…</p>}
            {todayFeedStatus === 'error' && (
              <div className="trending-feed-message">
                <p className="text-danger mb-2" role="alert">{liveFeed.length ? 'Could not refresh the feed. Showing the last loaded rankings.' : 'Could not load today’s feed.'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={fetchTodayHistory}>Retry</button>
              </div>
            )}
            {todayFeedStatus === 'ready' && liveFeed.length === 0 && (
              <div className="trending-feed-message">
                <i className="bi bi-list-stars portal-form-icon mx-auto" aria-hidden="true" />
                <h3>No topics in today’s feed</h3>
                <p className="text-muted small">Check which topics are active and eligible, then regenerate the feed.</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => {
                  openSection('topics');
                  requestAnimationFrame(() => topicsSearch.current?.focus());
                }}>Manage topics</button>
              </div>
            )}

            {liveFeed.length > 0 && (
              <>
                <div className="table-responsive trending-feed-table">
                  <table className="table table-hover align-middle mb-0">
                    <thead><tr><th scope="col">Rank</th><th scope="col">Topic</th><th scope="col">Whizles</th><th scope="col">Selection reason</th><th scope="col">Score</th></tr></thead>
                    <tbody>
                      {liveFeed.map(topic => (
                        <tr key={topic._id || topic.rank} className={topic.rank === 1 ? 'trending-leader' : undefined}>
                          <td><span className="trending-rank">#{topic.rank}</span></td>
                          <th scope="row">{topic.heading}<small className="text-muted d-block fw-normal">{topic.category}</small></th>
                          <td>{topic.whizlesCount}</td>
                          <td>{topic.selectionReason || '—'}</td>
                          <td>{topic.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ol className="trending-feed-list">
                  {liveFeed.map(topic => (
                    <li key={topic._id || topic.rank} className={topic.rank === 1 ? 'trending-leader' : undefined}>
                      <span className="trending-rank">#{topic.rank}</span>
                      <div>
                        <h3>{topic.heading}</h3>
                        <p className="text-muted small mb-1">{topic.category} · {topic.whizlesCount} Whizles · Score {topic.score}</p>
                        {topic.selectionReason && <p className="text-muted small mb-0">{topic.selectionReason}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>

          <aside className="card trending-panel" aria-labelledby="trending-status-heading">
            <div className="trending-panel-header">
              <h2 id="trending-status-heading">Feed settings</h2>
              <span className={config.enabled ? 'chip chip-ok' : 'chip chip-bad'}>{config.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <dl className="trending-feed-meta">
              <div><dt>Selection mode</dt><dd className="text-capitalize">{config.selectionMode}</dd></div>
              <div><dt>Daily topic limit</dt><dd>{config.topicsPerDay}</dd></div>
              <div><dt>Rankings</dt><dd>{config.isLocked ? 'Locked' : 'Automatic'}</dd></div>
            </dl>
            <button type="button" className="btn btn-outline-primary" onClick={handleToggleLock} disabled={Boolean(feedAction)}>
              <i className={'bi ' + (config.isLocked ? 'bi-unlock' : 'bi-lock')} aria-hidden="true" /> {feedAction === 'lock' ? 'Updating…' : config.isLocked ? 'Unlock rankings' : 'Lock rankings'}
            </button>
          </aside>
        </div>
      )}

      {/* --- TAB CONTENT 2: TOPICS MANAGER --- */}
      {activeTab === 'topics' && (
        <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white">
          {/* Filters Row */}
          <FilterToolbar className="mb-4" columns={4} searchField={
              <label className="workspace-field">
                <span>Search topics</span>
                <input
                  ref={topicsSearch}
                  type="search"
                  className="form-control"
                  placeholder="Title or heading"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
              </label>
          }>
            <label className="workspace-field">
              <span>Category</span>
              <select
                className="form-select"
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">All Categories</option>
                {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </label>
            <label className="workspace-field">
              <span>Status</span>
              <select
                className="form-select"
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="paused">Paused</option>
                <option value="expired">Expired</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="workspace-field">
              <span>Ranking type</span>
              <select
                className="form-select"
                value={filterRankingType}
                onChange={(e) => { setFilterRankingType(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">All Ranking Types</option>
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
                <option value="random">Random</option>
              </select>
            </label>
            <label className="workspace-field">
              <span>Sort by</span>
              <select
                className="form-select"
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
              >
                <option value="rank">Sort by Rank</option>
                <option value="whizles">Sort by Whizles</option>
                <option value="priority">Sort by Priority</option>
                <option value="newest">Sort by Newest</option>
              </select>
            </label>
          </FilterToolbar>

          {/* Bulk Action Bar */}
          {selectedIds.length > 0 && (
            <div className="alert alert-primary border-0 rounded-3 p-3 mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2 small">
              <div className="fw-bold">
                <i className="bi bi-check2-square me-1"></i>
                {selectedIds.length} topics selected for updates
              </div>
              <div className="trending-bulk-actions d-flex flex-wrap align-items-center gap-2">
                <select 
                  className="form-select form-select-sm"
                  aria-label="Bulk action"
                  value={bulkAction}
                  onChange={(e) => {
                    setBulkAction(e.target.value);
                    setBulkValue('');
                  }}
                >
                  <option value="">Choose bulk action...</option>
                  <option value="status">Change Status</option>
                  <option value="priority">Change Priority</option>
                  <option value="isPinned">Pin / Unpin</option>
                  <option value="isExcluded">Rotation Exclude</option>
                  <option value="delete">Delete Selected</option>
                </select>

                {bulkAction === 'status' && (
                  <select 
                    className="form-select form-select-sm"
                    aria-label="Status for selected topics"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                  >
                    <option value="">Status...</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="paused">Paused</option>
                    <option value="inactive">Inactive</option>
                  </select>
                )}

                {bulkAction === 'priority' && (
                  <input 
                    type="number"
                    className="form-control form-control-sm text-center"
                    placeholder="Priority"
                    aria-label="Priority for selected topics"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                  />
                )}

                {bulkAction === 'isPinned' && (
                  <select 
                    className="form-select form-select-sm"
                    aria-label="Pin or unpin selected topics"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                  >
                    <option value="">Value...</option>
                    <option value="true">Pin</option>
                    <option value="false">Unpin</option>
                  </select>
                )}

                {bulkAction === 'isExcluded' && (
                  <select 
                    className="form-select form-select-sm"
                    aria-label="Rotation for selected topics"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                  >
                    <option value="">Value...</option>
                    <option value="true">Exclude</option>
                    <option value="false">Include</option>
                  </select>
                )}

                <button className="btn btn-sm btn-primary fw-bold" onClick={handleBulkAction}>
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Topics Pool Table */}
          <div className="table-responsive">
            <table className="table table-hover align-middle small">
              <thead>
                <tr className="table-light text-muted">
                  <th scope="col" style={{ width: '40px' }}>
                    <input aria-label="Select all topics on this page" 
                      type="checkbox"
                      checked={topics.length > 0 && selectedIds.length === topics.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th scope="col" style={{ width: '60px' }}>S.No.</th>
                  <th scope="col" style={{ width: '50px' }}>Pin</th>
                  <th scope="col" style={{ width: '70px' }}>Exclude</th>
                  <th scope="col">Topic Title</th>
                  <th scope="col">Category</th>
                  <th scope="col" style={{ width: '80px' }}>Whizles</th>
                  <th scope="col" style={{ width: '70px' }}>Priority</th>
                  <th scope="col" style={{ width: '110px' }}>Status</th>
                  <th scope="col" className="text-end" style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="text-center py-5">
                      <div className="spinner-border text-primary" role="status"></div>
                    </td>
                  </tr>
                ) : topics.length > 0 ? (
                  topics.map((t, index) => (
                    <tr key={t._id}>
                      <td>
                        <input aria-label={`Select ${t.title}`} 
                          type="checkbox"
                          checked={selectedIds.includes(t._id)}
                          onChange={() => handleSelectRow(t._id)}
                        />
                      </td>
                      <td className="font-monospace text-muted">
                        {(currentPage - 1) * 10 + index + 1}
                      </td>
                      <td>
                        <div className="form-check form-switch p-0 d-flex justify-content-center">
                          <input aria-label={`Pin ${t.title}`} 
                            className="form-check-input ms-0"
                            type="checkbox"
                            checked={t.isPinned || false}
                            onChange={() => handleQuickPinToggle(t._id, t.isPinned)}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="form-check form-switch p-0 d-flex justify-content-center">
                          <input aria-label={`Exclude ${t.title} from automatic rotation`} 
                            className="form-check-input ms-0"
                            type="checkbox"
                            checked={t.isExcludedFromRotation || false}
                            onChange={() => handleQuickExcludeToggle(t._id, t.isExcludedFromRotation)}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          {t.image ? (
                            <img src={t.image} alt={t.title} className="rounded me-2 border" style={{ width: '38px', height: '38px', objectFit: 'cover' }} />
                          ) : (
                            <div className="bg-light rounded me-2 d-flex align-items-center justify-content-center text-muted" style={{ width: '38px', height: '38px' }}>
                              <i className="bi bi-image" style={{ fontSize: '0.9rem' }}></i>
                            </div>
                          )}
                          <div>
                            <strong className="text-dark d-block text-truncate" style={{ maxWidth: '170px' }}>{t.title}</strong>
                            <span className="text-muted d-block text-truncate small" style={{ maxWidth: '170px' }}>{t.heading}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge bg-light text-primary border">{t.category}</span></td>
                      <td><strong>{t.whizlesCount || 0}</strong></td>
                      <td>
                        <input aria-label={`Priority for ${t.title}`} 
                          type="number"
                          className="form-control form-control-sm text-center px-1 font-monospace"
                          style={{ width: '55px', fontWeight: 'bold' }}
                          value={t.priority}
                          onChange={(e) => handleQuickPriorityChange(t._id, e.target.value)}
                        />
                      </td>
                      <td>
                        <select aria-label={`Status for ${t.title}`} 
                          className="form-select form-select-sm p-1 py-0.5 text-center text-uppercase fw-bold"
                          style={{ 
                            fontSize: '0.75rem', 
                            borderColor: t.status === 'active' ? '#198754' : '#dee2e6',
                            color: t.status === 'active' ? '#198754' : '#6c757d'
                          }}
                          value={t.status}
                          onChange={(e) => handleQuickStatusChange(t._id, e.target.value)}
                        >
                          <option value="active">Active</option>
                          <option value="draft">Draft</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="paused">Paused</option>
                          <option value="expired">Expired</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          <button className="btn btn-light border btn-sm p-1.5 rounded-circle" title="Duplicate Topic" onClick={() => handleDuplicate(t._id)}>
                            <i className="bi bi-files text-primary"></i>
                          </button>
                          <button className="btn btn-light border btn-sm p-1.5 rounded-circle" title="Edit Topic" onClick={() => openEditModal(t)}>
                            <i className="bi bi-pencil-fill text-muted"></i>
                          </button>
                          <button className="btn btn-light border btn-sm p-1.5 rounded-circle" title="Delete Topic" onClick={() => handleDelete(t._id)}>
                            <i className="bi bi-trash3-fill text-danger"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" className="text-center py-4 text-muted">No topics registered.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top small">
              <span className="text-muted">Page {currentPage} of {totalPages}</span>
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-outline-primary btn-sm px-3"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-outline-primary btn-sm px-3"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT 3: RANKING SETTINGS --- */}
      {activeTab === 'ranking' && (
        <div className="row g-4">
          <div className="col-md-7">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
              <h5 className="fw-black text-dark border-bottom pb-2 mb-4">Ranking Algorithm Weights</h5>
              
              <div className="mb-4">
                <label htmlFor="trending-selection-mode" className="form-label fw-bold text-dark mb-1">Selection Mode</label>
                <select id="trending-selection-mode" 
                  className="form-select"
                  value={config.selectionMode}
                  onChange={(e) => handleSaveConfig({ selectionMode: e.target.value })}
                >
                  <option value="hybrid">Hybrid Algorithmic weights (Recommended)</option>
                  <option value="auto">Auto Ranking (Whizles + Topic Priority)</option>
                  <option value="whizle">Whizles Based (Likes only)</option>
                  <option value="priority">Priority Based (Topic priority only)</option>
                  <option value="new_topics">New Topics (Freshness decay only)</option>
                  <option value="random">Random Selection (Eligible pool shuffle)</option>
                  <option value="category_weighted">Category Priority weighted</option>
                </select>
              </div>

              {config.selectionMode === 'hybrid' && (
                <div className="small">
                  <p className="text-muted mb-4">
                    Adjust sliders to allocate percentage weights to different ranking factors. The sum does not need to equal 100%.
                  </p>

                  {[
                    { key: 'whizleWeight', label: 'Whizles (Likes) Weight', desc: 'Popularity coefficient' },
                    { key: 'priorityWeight', label: 'Topic Priority Weight', desc: 'Editorial weight' },
                    { key: 'categoryWeight', label: 'Category Priority Weight', desc: 'Category-wide weight factor' },
                    { key: 'freshnessWeight', label: 'Freshness Time-Decay Weight', desc: 'Age gravity divisor' },
                    { key: 'randomWeight', label: 'Random Shuffling Weight', desc: 'Promotes discovery exploration' }
                  ].map(slider => (
                    <div key={slider.key} className="mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="fw-bold text-dark">{slider.label}</span>
                        <strong className="text-primary font-monospace">{config[slider.key]}%</strong>
                      </div>
                      <input aria-label={slider.label} 
                        type="range"
                        className="form-range"
                        min="0"
                        max="100"
                        step="5"
                        value={config[slider.key]}
                        onChange={(e) => handleSaveConfig({ [slider.key]: parseInt(e.target.value) })}
                      />
                      <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>{slider.desc}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-md-5">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
              <h5 className="fw-black text-dark border-bottom pb-2 mb-4">Dynamic Boosting Parameters</h5>
              
              <div className="small">
                <div className="mb-4">
                  <div className="form-check form-switch mb-2">
                    <input 
                      className="form-check-input"
                      type="checkbox"
                      id="configNewTopicBoost"
                      checked={config.newTopicBoost}
                      onChange={(e) => handleSaveConfig({ newTopicBoost: e.target.checked })}
                    />
                    <label className="form-check-label fw-bold text-dark" htmlFor="configNewTopicBoost">
                      New Topic Boost (+20%)
                    </label>
                  </div>
                  <span className="text-muted d-block">Newly created topics in the last 24 hours receive temporary score inflation.</span>
                </div>

                <div className="mb-4">
                  <div className="form-check form-switch mb-2">
                    <input 
                      className="form-check-input"
                      type="checkbox"
                      id="configAvoidRepeat"
                      checked={config.avoidRecentRepeat}
                      onChange={(e) => handleSaveConfig({ avoidRecentRepeat: e.target.checked })}
                    />
                    <label className="form-check-label fw-bold text-dark" htmlFor="configAvoidRepeat">
                      Avoid Repetition (-50% Penalty)
                    </label>
                  </div>
                  <span className="text-muted d-block">Topics displayed in the trending feed in the last 3 days are penalized to promote round-robin rotation.</span>
                </div>

                <div className="p-3 bg-light rounded-3">
                  <span className="fw-bold d-block text-primary mb-1">Selection Logic Detail</span>
                  <p className="mb-0 text-muted">
                    If Hybrid is chosen, the engine scores each topic based on the weights. Pinned topics bypass this logic and sit at their specified slots, sliding the automatic results down.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 4: SCHEDULES --- */}
      {activeTab === 'schedule' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center border-bottom pb-3 mb-4">
            <div>
              <h5 className="fw-black text-dark mb-0">Upcoming & Active Schedules</h5>
              <span className="text-muted small">Timeline views of date-bound trending topics</span>
            </div>
            <FilterToolbar>
              <input aria-label="Schedule date"
                type="date"
                className="form-control form-control-sm"
                style={{ width: '160px' }}
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </FilterToolbar>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle small">
              <thead>
                <tr className="table-light text-muted">
                  <th scope="col">Topic</th>
                  <th scope="col">Category</th>
                  <th scope="col">Start Time</th>
                  <th scope="col">End Time</th>
                  <th scope="col">Scheduled Duration</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {topics.length > 0 ? (
                  topics.map(t => {
                    const daysDuration = t.startAt && t.endAt 
                      ? Math.ceil((new Date(t.endAt) - new Date(t.startAt)) / (1000 * 60 * 60 * 24))
                      : 'Always';
                    return (
                      <tr key={t._id}>
                        <td>
                          <strong className="text-dark d-block">{t.title}</strong>
                          <span className="text-muted d-block small">{t.heading}</span>
                        </td>
                        <td><span className="badge bg-light text-dark border">{t.category}</span></td>
                        <td>{t.startAt ? new Date(t.startAt).toLocaleString() : 'Immediate'}</td>
                        <td>{t.endAt ? new Date(t.endAt).toLocaleString() : 'Never expires'}</td>
                        <td><strong>{daysDuration} {daysDuration !== 'Always' ? 'Days' : ''}</strong></td>
                        <td>
                          <span className={`badge ${
                            t.status === 'active' ? 'bg-success' : 
                            t.status === 'scheduled' ? 'bg-warning text-dark' : 
                            t.status === 'expired' ? 'bg-secondary' : 'bg-danger'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">No scheduled items found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 5: CATEGORY LIMITS --- */}
      {activeTab === 'categories' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <h5 className="fw-black text-dark border-bottom pb-2 mb-4">Category priorities and Distribution Weight Caps</h5>
          <p className="text-muted small mb-4">
            Control the priority values and percentage ceilings per category to balance the trending content distribution.
          </p>

          <div className="row g-4">
            <div className="col-12">
              <table className="table table-hover align-middle small">
                <thead>
                  <tr className="table-light text-muted">
                    <th scope="col">Category</th>
                    <th scope="col" style={{ width: '180px' }}>Category Priority</th>
                    <th scope="col" style={{ width: '250px' }}>Distribution Ceiling (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriesList.map(cat => {
                    const currentPriority = config.categoryPriorities?.[cat] || 1;
                    const currentCap = config.categoryDistribution?.[cat] || 0;

                    return (
                      <tr key={cat}>
                        <td><strong className="text-primary">{cat}</strong></td>
                        <td>
                          <input aria-label={`Priority for ${cat}`} 
                            type="number"
                            className="form-control form-control-sm font-monospace text-center fw-bold"
                            style={{ width: '80px' }}
                            value={currentPriority}
                            onChange={(e) => {
                              const newPriMap = { ...config.categoryPriorities, [cat]: parseInt(e.target.value) || 1 };
                              handleSaveConfig({ categoryPriorities: newPriMap });
                            }}
                          />
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <input aria-label={`Rotation cap for ${cat}`} 
                              type="range"
                              className="form-range"
                              min="0"
                              max="100"
                              step="5"
                              value={currentCap}
                              onChange={(e) => {
                                const newCapMap = { ...config.categoryDistribution, [cat]: parseInt(e.target.value) || 0 };
                                handleSaveConfig({ categoryDistribution: newCapMap });
                              }}
                            />
                            <strong className="font-monospace text-dark" style={{ width: '40px' }}>{currentCap}%</strong>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 6: HISTORY AUDITS --- */}
      {activeTab === 'history' && (
        <div className="row g-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
              <h6 className="fw-black text-dark border-bottom pb-2 mb-3">Historical Logs Dates</h6>
              <div className="list-group list-group-flush small" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {historySummaryList.map(h => (
                  <button
                    key={h._id}
                    className={`list-group-item list-group-item-action border-0 rounded-2 py-2 d-flex justify-content-between align-items-center ${selectedHistoryDate === h.date ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedHistoryDate(h.date);
                      fetchSelectedHistoryFeed(h.date);
                    }}
                  >
                    <span><i className="bi bi-calendar-check me-2"></i> {h.date}</span>
                    <span className="badge bg-light text-dark border">{h.topics?.length || 0} items</span>
                  </button>
                ))}
                {historySummaryList.length === 0 && (
                  <div className="text-center py-4 text-muted">No historical files stored.</div>
                )}
              </div>
            </div>
          </div>

          <div className="col-md-8">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
              <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                <h6 className="fw-black text-dark mb-0">Outcome feed snapshot for: {selectedHistoryDate || 'N/A'}</h6>
                <span className="badge bg-light text-primary border">Mode: {selectedHistoryFeed?.selectionMode || 'Hybrid'}</span>
              </div>

              <div className="table-responsive" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <table className="table table-hover align-middle small">
                  <thead>
                    <tr className="table-light text-muted">
                      <th scope="col" style={{ width: '60px' }}>Rank</th>
                      <th scope="col">Topic Heading</th>
                      <th scope="col">Category</th>
                      <th scope="col">Whizles</th>
                      <th scope="col">Reason</th>
                      <th scope="col">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHistoryFeed && selectedHistoryFeed.topics && selectedHistoryFeed.topics.length > 0 ? (
                      selectedHistoryFeed.topics.map(t => (
                        <tr key={t._id}>
                          <td><strong className="font-monospace">#{t.rank}</strong></td>
                          <td><strong>{t.heading}</strong></td>
                          <td><span className="badge bg-light text-dark border">{t.category}</span></td>
                          <td><i className="bi bi-suit-heart-fill text-danger me-1"></i> {t.whizlesCount}</td>
                          <td><span className="badge bg-light text-primary border small">{t.selectionReason}</span></td>
                          <td><span className="font-monospace">{t.score}</span></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="text-center py-4 text-muted">Select a date from the left side panel to review feeds.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 7: GLOBAL SETTINGS --- */}
      {activeTab === 'settings' && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <h5 className="fw-black text-dark border-bottom pb-2 mb-4">Global Trending Configuration</h5>
          
          <div className="row g-3 small">
            <div className="col-md-6">
              <label htmlFor="trending-topics-per-day-display-count" className="form-label fw-bold text-dark mb-1">Topics Per Day Display Count</label>
              <select id="trending-topics-per-day-display-count" 
                className="form-select"
                value={config.topicsPerDay}
                onChange={(e) => handleSaveConfig({ topicsPerDay: parseInt(e.target.value) })}
              >
                <option value="10">10 Topics</option>
                <option value="20">20 Topics</option>
                <option value="30">30 Topics</option>
                <option value="40">40 Topics</option>
                <option value="50">50 Topics</option>
                <option value="75">75 Topics</option>
                <option value="100">100 Topics</option>
              </select>
              <small className="text-muted d-block mt-1">Limits the length of results returned in user APIs.</small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-bold text-dark mb-1">Engine Controls</label>
              <div className="d-flex flex-column gap-3 mt-2">
                <div className="form-check form-switch">
                  <input 
                    className="form-check-input"
                    type="checkbox"
                    id="settingsEnabled"
                    checked={config.enabled}
                    onChange={(e) => handleSaveConfig({ enabled: e.target.checked })}
                  />
                  <label className="form-check-label fw-bold text-dark" htmlFor="settingsEnabled">
                    Global Trending Module Enabled
                  </label>
                </div>
                <div className="form-check form-switch">
                  <input 
                    className="form-check-input"
                    type="checkbox"
                    id="settingsRotation"
                    checked={config.rotationEnabled}
                    onChange={(e) => handleSaveConfig({ rotationEnabled: e.target.checked })}
                  />
                  <label className="form-check-label fw-bold text-dark" htmlFor="settingsRotation">
                    Round-Robin Rotation Engine Enabled
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT TOPIC POPUP MODAL --- */}
      {modalOpen && (
        <FormDialog labelledBy="trending-topic-title" wide fullScreenOnMobile busy={savingTopic} onClose={closeTopicForm}>
          <form className="modal-content" onSubmit={handleTopicSubmit}>
            <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
              <h2 id="trending-topic-title" className="modal-title h5 fw-bold text-dark">{editId ? 'Modify Trending Topic' : 'Add Trending Topic'}</h2>
              <button type="button" className="btn-close" aria-label="Close form" onClick={closeTopicForm} disabled={savingTopic}></button>
            </div>
              <div className="modal-body p-4 small">
                <h3 className="portal-form-section-title"><i className="bi bi-card-text portal-form-icon" aria-hidden="true" /> Topic content</h3>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="trending-topic-topic-name-title" className="form-label fw-bold text-dark mb-1">Topic Name / Title *</label>
                    <input id="trending-topic-topic-name-title" 
                      type="text" 
                      className="form-control" 
                      required 
                      placeholder="e.g. AI & Technology"
                      value={formTitle} 
                      onChange={(e) => setFormTitle(e.target.value)} 
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="trending-topic-trending-heading" className="form-label fw-bold text-dark mb-1">Trending Heading *</label>
                    <input id="trending-topic-trending-heading" 
                      type="text" 
                      className="form-control" 
                      required 
                      placeholder="e.g. AI is changing the way we work"
                      value={formHeading} 
                      onChange={(e) => setFormHeading(e.target.value)} 
                    />
                  </div>

                  <div className="col-md-12">
                    <label htmlFor="trending-topic-short-text" className="form-label fw-bold text-dark mb-1">Short Text *</label>
                    <input id="trending-topic-short-text" 
                      type="text" 
                      className="form-control" 
                      required 
                      placeholder="e.g. Artificial Intelligence is rapidly transforming businesses."
                      value={formShortText} 
                      onChange={(e) => setFormShortText(e.target.value)} 
                    />
                  </div>

                  <div className="col-md-12">
                    <label htmlFor="trending-topic-description" className="form-label fw-bold text-dark mb-1">Description *</label>
                    <textarea id="trending-topic-description" 
                      className="form-control" 
                      rows="3" 
                      required
                      placeholder="Discuss the latest developments, tools..."
                      value={formDescription} 
                      onChange={(e) => setFormDescription(e.target.value)}
                    />
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="trending-topic-category" className="form-label fw-bold text-dark mb-1">Category *</label>
                    <select id="trending-topic-category"
                      className="form-select"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    >
                      {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="trending-topic-topic-priority" className="form-label fw-bold text-dark mb-1">Topic Priority</label>
                    <input id="trending-topic-topic-priority" 
                      type="number" 
                      className="form-control" 
                      placeholder="1, 2, 3..."
                      value={formPriority} 
                      onChange={(e) => setFormPriority(e.target.value)} 
                    />
                  </div>

                  <div className="col-md-6">
                    <UploadField id="trending-topic-thumbnail-image" label="Thumbnail" icon="image" action={formImage ? 'Replace image' : 'Choose image'} hint="Optional · up to 2 MB" accept="image/*" onChange={handleImageFile} disabled={savingTopic} errorId={thumbnailError ? 'trending-topic-thumbnail-error' : undefined} />
                    {readingThumbnail && <p className="portal-file-detail mt-2 mb-0" role="status">Reading image…</p>}
                    {thumbnailError && <p id="trending-topic-thumbnail-error" className="small text-danger mt-2 mb-0" role="alert">{thumbnailError}</p>}
                    {formImage && (
                      <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                        <img src={formImage} alt="Thumbnail preview" className="rounded border shadow-sm" style={{ width: '80px', height: '60px', objectFit: 'cover' }} />
                        <button type="button" className="btn btn-outline-secondary portal-preview-button" disabled={savingTopic || readingThumbnail} onClick={() => {
                          setFormImage('');
                          document.getElementById('trending-topic-thumbnail-image').value = '';
                        }}>Remove thumbnail</button>
                      </div>
                    )}
                  </div>

                  <div className="col-12">
                    <section className="topic-schedule" aria-labelledby="trending-schedule-title">
                      <h3 id="trending-schedule-title" className="portal-form-section-title">
                        <i className="bi bi-calendar portal-form-icon" aria-hidden="true" /> Publishing schedule
                      </h3>
                      <div>
                        <label htmlFor="trending-topic-status" className="form-label mb-1">Status</label>
                        <select id="trending-topic-status" className="form-select"
                          value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
                          <option value="active">Active</option>
                          <option value="draft">Draft</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="paused">Paused</option>
                          <option value="expired">Expired</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div className="topic-schedule-dates">
                        <p id="trending-schedule-zone" className="topic-schedule-zone">
                          <i className="bi bi-clock" aria-hidden="true" /> Time zone · {scheduleTimeZone}
                        </p>
                        <div className="topic-schedule-grid">
                          <div>
                            <label htmlFor="trending-topic-start-date-time" className="form-label mb-1">Starts</label>
                            <input id="trending-topic-start-date-time" type="datetime-local" className={`form-control${startError ? ' is-invalid' : ''}`}
                              value={formStartAt.value} onChange={(e) => setFormStartAt({ value: e.target.value })}
                              aria-invalid={Boolean(startError)} aria-describedby={`trending-schedule-zone${startError ? ' trending-schedule-start-error' : ''}`} />
                            {startError && <p id="trending-schedule-start-error" className="invalid-feedback" role="alert">{startError}</p>}
                          </div>
                          <div>
                            <label htmlFor="trending-topic-end-date-time" className="form-label mb-1">Ends</label>
                            <input id="trending-topic-end-date-time" type="datetime-local" className={`form-control${endError ? ' is-invalid' : ''}`}
                              value={formEndAt.value} onChange={(e) => setFormEndAt({ value: e.target.value })}
                              aria-invalid={Boolean(endError)} aria-describedby={`trending-schedule-zone${endError ? ' trending-schedule-end-error' : ''}`} />
                            {endError && <p id="trending-schedule-end-error" className="invalid-feedback" role="alert">{endError}</p>}
                            <button type="button" className="btn btn-sm btn-outline-secondary topic-schedule-shortcut"
                              disabled={!shortcutEnd.value}
                              onClick={() => setFormEndAt(shortcutEnd)}>
                              <i className="bi bi-clock-history" aria-hidden="true" /> Ends in 24 hours
                            </button>
                            {!shortcutEnd.value && <p className="topic-schedule-zone mt-1">Choose a start time to use the shortcut.</p>}
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="col-12">
                    <section className="topic-editorial" aria-labelledby="trending-editorial-title">
                      <h3 id="trending-editorial-title" className="portal-form-section-title">
                        <i className="bi bi-sliders portal-form-icon" aria-hidden="true" /> Editorial controls
                      </h3>
                      <div className="topic-editorial-grid">
                        <div>
                          <label htmlFor="trending-topic-selection-mode-type" className="form-label mb-1">Ranking type</label>
                          <select id="trending-topic-selection-mode-type" className="form-select"
                            value={formRankingType} onChange={(e) => setFormRankingType(e.target.value)}>
                            <option value="auto">Auto</option>
                            <option value="manual">Manual</option>
                            <option value="random">Random</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="trending-topic-manual-override-position" className="form-label mb-1">Pinned position</label>
                          <input id="trending-topic-manual-override-position" type="number" className="form-control"
                            placeholder="Optional" aria-describedby="trending-topic-position-hint"
                            value={formManualPosition} onChange={(e) => setFormManualPosition(e.target.value)} />
                          <p id="trending-topic-position-hint" className="topic-editorial-hint">
                            Used when pinned. Leave blank to request position 1.
                          </p>
                        </div>
                      </div>
                      <div className="topic-editorial-grid topic-editorial-switches">
                        <label className="topic-editorial-switch form-switch" htmlFor="formIsPinned">
                          <span>
                            <strong id="trending-pin-label">Pin topic</strong>
                            <span id="trending-pin-hint" className="topic-editorial-hint">Give this topic a preferred spot in the feed.</span>
                          </span>
                          <input className="form-check-input" type="checkbox" role="switch" id="formIsPinned"
                            aria-labelledby="trending-pin-label" aria-describedby="trending-pin-hint"
                            checked={formIsPinned} onChange={(e) => setFormIsPinned(e.target.checked)} />
                        </label>
                        <label className="topic-editorial-switch form-switch" htmlFor="formIsExcluded">
                          <span>
                            <strong id="trending-exclude-label">Exclude from rotation</strong>
                            <span id="trending-exclude-hint" className="topic-editorial-hint">Skip automatic rotation. Pinned topics can still appear.</span>
                          </span>
                          <input className="form-check-input" type="checkbox" role="switch" id="formIsExcluded"
                            aria-labelledby="trending-exclude-label" aria-describedby="trending-exclude-hint"
                            checked={formIsExcluded} onChange={(e) => setFormIsExcluded(e.target.checked)} />
                        </label>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-top-0 pt-0 pb-4 px-4 gap-2">
                {topicError && <p className="portal-save-feedback text-danger" role="alert">{topicError}</p>}
                <button type="button" className="btn btn-light border px-4 py-2 fw-semibold" onClick={closeTopicForm} disabled={savingTopic}>Cancel</button>
                <button type="submit" className="btn btn-primary px-4 py-2 fw-semibold" disabled={savingTopic || readingThumbnail}>{savingTopic ? 'Saving…' : 'Save changes'}</button>
              </div>
          </form>
        </FormDialog>
      )}
    </div>
  );
};

export default SuperAdminTrending;
