import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FilterToolbar from '../../components/FilterToolbar';
import FormDialog from '../../components/FormDialog';
import LiveStatus from '../../components/LiveStatus';
import socket from '../../socket';
import { api } from '../../context/AuthContext';
import './SuperAdminLiveMobile.css';

const categories = ['Technology', 'Entertainment', 'Sports', 'Business', 'Education', 'News', 'Lifestyle', 'Gaming', 'Science'];
const feedEvents = ['trendingWhizled', 'trendingUpdated', 'trendingRegenerated'];

const sampleTopics = [
  { _id: 'sample-technology', category: 'Technology', heading: 'A closer look at wearable technology', shortText: 'Example of a featured topic in the preview.', whizlesCount: 12 },
  { _id: 'sample-entertainment', category: 'Entertainment', heading: 'What’s on this weekend', shortText: 'Example of a topic in the ranked feed.', whizlesCount: 9 },
  { _id: 'sample-sports', category: 'Sports', heading: 'The weekend sports roundup', shortText: 'Example of how a topic moves after a test like.', whizlesCount: 6 }
];

const rankTopics = (topics, previous = []) => {
  const previousRanks = new Map(previous.map(topic => [topic._id, topic.rank]));
  return topics.map((topic, index) => ({
    ...topic,
    rank: index + 1,
    shift: (previousRanks.get(topic._id) ?? index + 1) - (index + 1)
  }));
};

const getTestTopics = ({ topics, likes }) => rankTopics(
  topics.map((topic, index) => ({
    ...topic,
    whizlesCount: (topic.whizlesCount || 0) + (likes[topic._id] || 0),
    position: index,
    score: (likes[topic._id] || 0) - index
  })).sort((a, b) => b.score - a.score || a.position - b.position),
  topics
);

const TopicImage = ({ source }) => {
  const [unavailable, setUnavailable] = useState(false);
  if (!source || unavailable) return null;

  return (
    <div className="trend-topic-image">
      <img src={source} alt="" loading="lazy" onError={() => setUnavailable(true)} />
    </div>
  );
};

const LikeControl = ({ topic, onTestLike }) => (
  <div className="trend-likes">
    <span><i className="bi bi-heart me-1" aria-hidden="true" />{topic.whizlesCount || 0} likes</span>
    {onTestLike && (
      <button type="button" className="trend-like-button" aria-label={'Test like for ' + (topic.heading || topic.title)} onClick={() => onTestLike(topic._id)}>
        <i className="bi bi-heart" aria-hidden="true" />
      </button>
    )}
  </div>
);

const SuperAdminLiveMobile = () => {
  const [feed, setFeed] = useState({ topics: [], updatedAt: null, error: false });
  const [refreshing, setRefreshing] = useState(true);
  const [rankingsLocked, setRankingsLocked] = useState(null);
  const [category, setCategory] = useState('All');
  const [previewSize, setPreviewSize] = useState('fit');
  const [test, setTest] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const requestRef = useRef(null);
  const allCategoriesButton = useRef(null);
  const previewHeading = useRef(null);

  const refreshFeed = useCallback(() => {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setRefreshing(true);

    api.get('/trending', { signal: request.signal })
      .then(({ data }) => {
        if (request.signal.aborted) return;
        if (!data.success || !Array.isArray(data.topics)) throw new Error('Invalid trending response');
        setFeed(previous => ({
          topics: rankTopics(data.topics, previous.topics),
          updatedAt: new Date(),
          error: false
        }));
      })
      .catch(() => {
        if (!request.signal.aborted) setFeed(previous => ({ ...previous, error: true }));
      })
      .finally(() => {
        if (!request.signal.aborted) setRefreshing(false);
      });

    api.get('/superadmin/trending/config', { signal: request.signal })
      .then(({ data }) => {
        if (!request.signal.aborted) {
          setRankingsLocked(data.success && typeof data.config?.isLocked === 'boolean' ? data.config.isLocked : null);
        }
      })
      .catch(() => {
        if (!request.signal.aborted) setRankingsLocked(null);
      });
  }, []);

  useEffect(() => {
    const onConnect = () => {
      socket.emit('joinSuperAdmin');
      refreshFeed();
    };
    if (socket.connected) onConnect();
    else refreshFeed();
    socket.on('connect', onConnect);
    feedEvents.forEach(event => socket.on(event, refreshFeed));

    return () => {
      requestRef.current?.abort();
      socket.off('connect', onConnect);
      feedEvents.forEach(event => socket.off(event, refreshFeed));
    };
  }, [refreshFeed]);

  const toggleTestMode = () => {
    setCategory('All');
    setSelectedTopicId(null);
    setTest(test ? null : {
      topics: feed.topics.length ? feed.topics : rankTopics(sampleTopics),
      likes: {},
      usesSamples: feed.topics.length === 0
    });
  };

  const addTestLike = (id) => setTest(current => current && ({
    ...current,
    likes: { ...current.likes, [id]: (current.likes[id] || 0) + 1 }
  }));

  const topics = test ? getTestTopics(test) : feed.topics;
  const feedCategories = ['All', ...new Set([...categories, ...topics.map(topic => topic.category).filter(option => option && option !== 'All')])];
  const visibleTopics = category === 'All' ? topics : topics.filter(topic => topic.category === category);
  const selectedTopic = topics.find(topic => topic._id === selectedTopicId);
  const onTestLike = test ? addTestLike : undefined;

  return (
    <div className="trend-workspace">
      <div className="workspace-heading">
        <div>
          <h1>Live Trend Mobile View</h1>
          <p>Preview the trending feed and test how topics move in the rankings.</p>
        </div>
      </div>

      <div className="trend-workspace-grid">
        <aside className="trend-feed-status" aria-labelledby="trend-status-title">
          <div className="trend-status-heading">
            <h2 id="trend-status-title">Feed status</h2>
            <LiveStatus updatedAt={feed.updatedAt} stale={feed.error}
              refreshing={refreshing} onRetry={feed.error ? undefined : refreshFeed} />
          </div>
          <dl className="trend-status-metrics">
            <div><dt>Live topics</dt><dd>{feed.updatedAt ? feed.topics.length : '—'}</dd></div>
            <div><dt>Rankings</dt><dd>{rankingsLocked === null ? (refreshing ? 'Checking…' : 'Unavailable') : rankingsLocked ? 'Locked' : 'Automatic'}</dd></div>
          </dl>
          <div className="trend-mode-controls">
            <button type="button" className={`btn ${test ? 'btn-outline-primary' : 'btn-primary'}`} onClick={toggleTestMode}>
              {test ? 'Exit test mode' : 'Start test mode'}
            </button>
            {test && <button type="button" className="btn btn-outline-secondary" disabled={!Object.keys(test.likes).length}
              onClick={() => setTest(current => ({ ...current, likes: {} }))}>Reset test likes</button>}
          </div>
          <details className="trend-preview-help">
            <summary>How test mode works</summary>
            <p>Test likes stay in this preview. Each like can move a topic up the simulated list. Arrows show how far a topic moved. Exit test mode to see the live order again.</p>
          </details>
        </aside>
        <section className="trend-preview" aria-labelledby="trend-feed-title">
          <div className="trend-preview-size" role="group" aria-label="Preview size">
            <button type="button" className="workspace-tab-button" aria-pressed={previewSize === 'fit'} onClick={() => setPreviewSize('fit')}>Fit to screen</button>
            <button type="button" className="workspace-tab-button" aria-pressed={previewSize === 'actual'} onClick={() => setPreviewSize('actual')}>Actual size</button>
          </div>
          <div className="trend-phone" data-preview-size={previewSize}>
            <div className="trend-phone-screen">
              <header className="trend-screen-heading">
                <div className="trend-feed-header">
                  <h2 id="trend-feed-title" tabIndex={-1} ref={previewHeading}>What’s trending</h2>
                  <span className={`trend-preview-mode${test ? ' is-test' : ''}`} role="status">
                    <i className={test ? 'bi bi-play-circle' : 'bi bi-broadcast'} aria-hidden="true" />
                    {test ? (test.usesSamples ? 'Sample feed' : 'Test mode') : 'Live preview'}
                  </span>
                </div>
                <FilterToolbar className="trend-category-filter" summary={category}>
                  <div className="trend-categories" role="group" aria-label="Trending categories">
                    {feedCategories.map(option => (
                      <button type="button" key={option} ref={option === 'All' ? allCategoriesButton : undefined} aria-pressed={category === option} onClick={() => setCategory(option)}>{option}</button>
                    ))}
                  </div>
                </FilterToolbar>
              </header>
              <div className="trend-feed-body">
                {!test && feed.error && (
                  <div className="trend-feed-message">
                    <p role="status">{feed.updatedAt ? 'Couldn’t refresh the feed. Showing the last successful update.' : 'Couldn’t load the live feed.'}</p>
                    <button type="button" className="btn btn-outline-primary" onClick={refreshFeed} disabled={refreshing}>{refreshing ? 'Retrying…' : 'Retry'}</button>
                  </div>
                )}
                {!test && refreshing && !feed.updatedAt && !feed.error && (
                  <p className="trend-feed-message" role="status">Loading the live feed…</p>
                )}
                {(test || (feed.updatedAt && (!feed.error || topics.length > 0))) && (
                  topics.length === 0 ? (
                    <div className="trend-feed-message">
                      <h3>No topics in the live feed</h3>
                      <p>Check which topics are published and eligible to appear.</p>
                      <div className="trend-empty-actions">
                        <button type="button" className="btn btn-primary" onClick={() => {
                          previewHeading.current?.focus();
                          toggleTestMode();
                        }}>Try sample feed</button>
                        <Link className="btn btn-outline-primary" to="/superadmin/trending?tab=topics">Manage topics</Link>
                      </div>
                    </div>
                  ) : visibleTopics.length === 0 ? (
                    <div className="trend-feed-message">
                      <h3>No topics in {category}</h3>
                      <button type="button" className="btn btn-outline-primary" onClick={() => {
                        setCategory('All');
                        const allButton = allCategoriesButton.current;
                        const focusTarget = allButton?.getClientRects().length ? allButton : previewHeading.current;
                        focusTarget?.focus();
                      }}>View all topics</button>
                    </div>
                  ) : (
                    <ol className="trend-topic-list">
                      {visibleTopics.map(topic => (
                        <li className={'trend-topic' + (topic.rank === 1 ? ' trend-topic-featured' : '')} key={topic._id}>
                          <TopicImage key={topic.image} source={topic.image} />
                          <div className="trend-topic-content">
                            <div className="trend-topic-meta">
                              <span>#{topic.rank}</span>
                              {topic.shift !== 0 && (
                                <>
                                  <span aria-hidden="true" className={topic.shift > 0 ? 'trend-rank-up' : 'trend-rank-down'}>
                                    {topic.shift > 0 ? '↑' : '↓'}{Math.abs(topic.shift)}
                                  </span>
                                  <span className="visually-hidden">{topic.shift > 0 ? 'Up ' : 'Down '}{Math.abs(topic.shift)}</span>
                                </>
                              )}
                              <span>{topic.category}</span>
                            </div>
                            <h3><button type="button" className="trend-topic-title" onClick={() => setSelectedTopicId(topic._id)}>{topic.heading || topic.title}</button></h3>
                            {topic.shortText && <p>{topic.shortText}</p>}
                            <LikeControl topic={topic} onTestLike={onTestLike} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  )
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
      {selectedTopic && (
        <FormDialog labelledBy="trend-topic-detail-title" onClose={() => setSelectedTopicId(null)}>
          <article className="modal-content trend-topic-detail">
            <header className="modal-header">
              <h2 id="trend-topic-detail-title" className="modal-title h5">{selectedTopic.heading || selectedTopic.title}</h2>
              <button type="button" className="btn-close" aria-label="Close topic details" onClick={() => setSelectedTopicId(null)} />
            </header>
            <div className="modal-body">
              <TopicImage key={selectedTopic.image} source={selectedTopic.image} />
              <p className="trend-topic-meta mt-3">#{selectedTopic.rank} · {selectedTopic.category}</p>
              {selectedTopic.shortText && <p className="fw-semibold">{selectedTopic.shortText}</p>}
              {selectedTopic.description && selectedTopic.description !== selectedTopic.shortText && <p>{selectedTopic.description}</p>}
              <LikeControl topic={selectedTopic} onTestLike={onTestLike} />
            </div>
          </article>
        </FormDialog>
      )}
    </div>
  );
};

export default SuperAdminLiveMobile;
