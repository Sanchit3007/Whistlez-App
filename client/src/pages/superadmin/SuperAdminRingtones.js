import React, { useState, useEffect, useId, useRef } from 'react';
import FormDialog from '../../components/FormDialog';
import UploadField from '../../components/UploadField';
import UnsavedChanges from '../../components/UnsavedChanges';
import socket from '../../socket';
import { api } from '../../context/AuthContext';
import './SuperAdminRingtones.css';

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

const RingtoneDurationControl = ({ ringtone, draft, onDraftChange, onSave, preview, onPreview, onSeek }) => {
  const rangeId = useId();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saved = ringtone.duration || 15;
  const maximum = Math.max(1, Math.floor(ringtone.originalDuration || saved));
  const duration = draft === null ? saved : Math.max(1, Math.min(draft, maximum));
  const changed = duration !== saved;
  const repeats = ringtone.repeatCount || 1;
  const previewLabel = preview ? 'Stop preview' : changed ? 'Preview unsaved duration' : 'Play preview';

  const saveDuration = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await onSave(ringtone._id, duration);
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Could not save the duration. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ringtone-duration">
      <div className="ringtone-duration-heading">
        <label htmlFor={rangeId}>Playback duration</label>
        <div className="ringtone-preview-controls">
          <span><strong>{duration}s</strong> per play</span>
          <button
            type="button"
            className="ringtone-edit-preview"
            onClick={() => onPreview(duration)}
            disabled={!ringtone.file || saving}
            aria-label={previewLabel}
            title={previewLabel}
          >
            <i className={`bi ${preview ? 'bi-stop-fill' : 'bi-play-fill'}`} aria-hidden="true" />
          </button>
        </div>
      </div>
      <input
        id={rangeId}
        className="ringtone-duration-slider"
        type="range"
        min="1"
        max={maximum}
        step="1"
        value={Math.floor(duration)}
        aria-label={`Playback duration for ${ringtone.name}`}
        aria-valuetext={`${duration} seconds per play`}
        disabled={saving || maximum === 1}
        onChange={event => {
          onDraftChange(ringtone._id, Number(event.target.value));
          setSaveError('');
        }}
      />
      <div className="ringtone-duration-endpoints" aria-hidden="true">
        <span>1s</span>
        <span>{maximum}s</span>
      </div>
      {preview && (
        <div className="ringtone-playback-position">
          <span>{formatTime(preview.currentTime)}</span>
          <input
            type="range"
            className="ringtone-duration-slider"
            min="0"
            max={preview.total}
            step="0.1"
            value={Math.min(preview.currentTime, preview.total)}
            onChange={onSeek}
            aria-label={`Playback position for ${ringtone.name}`}
            aria-valuetext={`${formatTime(preview.currentTime)} of ${formatTime(preview.total)}`}
          />
          <span>{formatTime(preview.total)}</span>
        </div>
      )}
      <div className="ringtone-duration-actions">
        <div className="ringtone-duration-summary">
          <span>{repeats} {repeats === 1 ? 'repeat' : 'repeats'} · {duration * repeats}s total</span>
          <span className={`ringtone-save-status${changed ? ' is-unsaved' : ''}`} role="status">
            <i className={`bi ${changed ? 'bi-circle-fill' : 'bi-check2'}`} aria-hidden="true" />
            {changed ? 'Unsaved duration' : 'Saved'}
          </span>
        </div>
        <button type="button" className="btn btn-primary ringtone-save-duration" onClick={saveDuration} disabled={saving || !changed}>
          {saving ? 'Saving…' : 'Save duration'}
        </button>
      </div>
      {saveError && <p className="small text-danger mb-0" role="alert">{saveError}</p>}
    </div>
  );
};
const SuperAdminRingtones = () => {
  const [ringtones, setRingtones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [durationDrafts, setDurationDrafts] = useState({});
  const editForm = useRef(null);

  const clearDurationDraft = (id) => setDurationDrafts(current => {
    const drafts = { ...current };
    delete drafts[id];
    return drafts;
  });

  const triggerSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 5000);
  };

  const triggerError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  // Upload modal states
  const [showModal, setShowModal] = useState(false);
  const [soundName, setSoundName] = useState('');
  const [soundFile, setSoundFile] = useState('');
  const [soundFileName, setSoundFileName] = useState('');
  const [soundFileError, setSoundFileError] = useState('');
  const [readingSound, setReadingSound] = useState(false);
  const soundSelection = useRef(0);
  const [soundDuration, setSoundDuration] = useState(15);
  const [soundOriginalDuration, setSoundOriginalDuration] = useState(15);
  const [soundCategory, setSoundCategory] = useState('General');
  const [soundRepeatCount, setSoundRepeatCount] = useState(1);
  const [uploading, setUploading] = useState(false);

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('General');
  const [editRepeatCount, setEditRepeatCount] = useState(1);
  const [editDuration, setEditDuration] = useState(15);
  const [editOriginalDuration, setEditOriginalDuration] = useState(15);
  const [editFile, setEditFile] = useState('');

  // Audio player states
  const [playingId, setPlayingId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const activePreview = useRef(null);

  const fetchRingtones = async () => {
    try {
      const res = await api.get('/superadmin/ringtones');
      if (res.data.success) {
        setRingtones(res.data.ringtones);
      }
    } catch (err) {
      console.error('Error fetching ringtones', err);
      setError('Could not retrieve ringtone sound records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchRingtones();
  }, []);

  // Socket listener for real-time ringtones updates
  useEffect(() => {
    socket.emit('joinSuperAdmin');

    const handleUpdate = () => {
      fetchRingtones();
    };

    socket.on('ringtonesUpdated', handleUpdate);

    return () => {
      socket.off('ringtonesUpdated', handleUpdate);
    };
  }, []);

  useEffect(() => () => {
    activePreview.current?.audio.pause();
    activePreview.current = null;
  }, []);
  const handleAudioUpload = (e) => {
    const input = e.currentTarget;
    const file = input.files[0];
    if (!file) return;

    const selection = ++soundSelection.current;
    stopAudio();
    setSoundFile('');
    setSoundFileName('');
    setReadingSound(false);
    setError('');
    setSoundFileError('');

    if (file.size > 5 * 1024 * 1024) {
      setSoundFileError('Choose an audio file up to 5 MB.');
      input.value = '';
      return;
    }

    setReadingSound(true);
    const showFileError = () => {
      if (selection !== soundSelection.current) return;
      setSoundFileError('This file could not be played. Choose another audio file.');
      setReadingSound(false);
      input.value = '';
    };
    const reader = new FileReader();
    reader.onerror = showFileError;
    reader.onload = () => {
      if (selection !== soundSelection.current) return;
      const audio = new Audio();
      audio.onerror = showFileError;
      audio.onloadedmetadata = () => {
        if (selection !== soundSelection.current) return;
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          showFileError();
          return;
        }
        const duration = Math.max(1, Math.round(audio.duration));
        setSoundFile(reader.result);
        setSoundFileName(file.name);
        setSoundDuration(duration);
        setSoundOriginalDuration(duration);
        setReadingSound(false);
      };
      audio.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const closeUploadForm = () => {
    soundSelection.current += 1;
    setReadingSound(false);
    setSoundFile('');
    setSoundFileName('');
    setSoundFileError('');
    setError('');
    stopAudio();
    setShowModal(false);
  };

  const handleCreateRingtone = async (e) => {
    e.preventDefault();
    if (readingSound || uploading) return;
    if (!soundName || !soundFile) {
      triggerError('Please provide a name and select an audio file.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/superadmin/ringtones', {
        name: soundName, file: soundFile, duration: soundDuration, originalDuration: soundOriginalDuration, category: soundCategory, repeatCount: soundRepeatCount
      });
      if (res.data.success) {
        triggerSuccess(`Ringtone "${soundName}" uploaded successfully!`);
        setSoundName('');
        setSoundFile('');
        setSoundFileName('');
        setSoundDuration(15); setSoundOriginalDuration(15); setSoundCategory('General'); setSoundRepeatCount(1);
        stopAudio();
        setShowModal(false);
        fetchRingtones();
      }
    } catch (err) {
      console.error('Error uploading ringtone', err);
      triggerError(err.response?.data?.message || 'Failed to upload ringtone.');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (id, name) => {
    setError('');
    setSuccess('');

    const targetRingtone = ringtones.find(r => r._id === id);
    if (!targetRingtone) return;

    const previousRingtones = [...ringtones];
    const isActivating = !targetRingtone.isActive;

    // Optimistically update the switch state in local memory
    const updatedRingtones = ringtones.map(r => {
      if (r._id === id) {
        return { ...r, isActive: isActivating };
      }
      return r;
    });

    setRingtones(updatedRingtones);

    try {
      const res = await api.put(`/superadmin/ringtones/${id}/toggle`);
      if (res.data.success) {
        triggerSuccess(`Status changed for Ringtone "${name}".`);
        fetchRingtones();
      } else {
        setRingtones(previousRingtones);
      }
    } catch (err) {
      console.error('Error toggling status', err);
      setRingtones(previousRingtones);
      triggerError(err.response?.data?.message || 'Failed to toggle status.');
    }
  };

  const handleEditClick = (r) => {
    setEditId(r._id);
    setEditName(r.name); setEditCategory(r.category || 'General'); setEditRepeatCount(r.repeatCount || 1); setEditDuration(durationDrafts[r._id] ?? (r.duration || 15)); setEditOriginalDuration(r.originalDuration || r.duration || 15); setEditFile(r.file); setShowEditModal(true);
  };

  const handleSaveDuration = async (id, duration) => {
    if (playingId === id) stopAudio();
    const { data } = await api.put(`/superadmin/ringtones/${id}`, { duration });
    if (!data.success) throw new Error('Duration could not be saved');
    setRingtones(current => current.map(ringtone => ringtone._id === id ? {
      ...ringtone,
      duration: data.ringtone.duration,
      originalDuration: data.ringtone.originalDuration
    } : ringtone));
    clearDurationDraft(id);
  };

  const handleUpdateRingtone = async (e) => {
    e?.preventDefault();
    if (!editName) return false;
    setError('');
    setSuccess('');
    try {
      const res = await api.put(`/superadmin/ringtones/${editId}`, { 
        name: editName,
        category: editCategory,
        repeatCount: editRepeatCount,
        duration: editDuration
      });
      if (res.data.success) {
        triggerSuccess(`Ringtone name updated successfully!`);
        stopAudio();
        setShowEditModal(false);
        clearDurationDraft(editId);
        fetchRingtones();
        return true;
      }
    } catch (err) {
      console.error('Error updating ringtone', err);
      triggerError(err.response?.data?.message || 'Failed to update ringtone.');
    }
    return false;
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ringtone "${name}"?`)) return;
    setError('');
    setSuccess('');
    
    if (playingId === id) stopAudio();
    try {
      const res = await api.delete(`/superadmin/ringtones/${id}`);
      if (res.data.success) {
        triggerSuccess(`Successfully deleted sound "${name}".`);
        clearDurationDraft(id);
        fetchRingtones();
      }
    } catch (err) {
      console.error('Error deleting ringtone', err);
      triggerError(err.response?.data?.message || 'Failed to delete sound.');
    }
  };

  const stopAudio = () => {
    const preview = activePreview.current;
    activePreview.current = null;
    preview?.audio.pause();
    setPlayingId(null);
    setCurrentTime(0);
  };

  const handlePlayPause = (ringtone) => {
    stopAudio();
    if (playingId === ringtone._id) return;

    const audio = new Audio(ringtone.file);
    const trim = ringtone.duration || 15;
    const repeats = ringtone.repeatCount || 1;
    const preview = { audio, trim, loop: 0 };
    activePreview.current = preview;
    setPlayingId(ringtone._id);
    setPlaybackDuration(trim * repeats);

    const playAudio = () => {
      audio.play().catch(err => {
        if (activePreview.current !== preview) return;
        console.error('Audio play failed', err);
        stopAudio();
        triggerError('Unable to play audio. Check file source.');
      });
    };

    const advance = () => {
      preview.loop += 1;
      if (preview.loop >= repeats) {
        stopAudio();
        return;
      }

      audio.currentTime = 0;
      setCurrentTime(preview.loop * trim);
      playAudio();
    };

    audio.ontimeupdate = () => {
      if (activePreview.current !== preview) return;
      if (audio.currentTime >= trim) {
        advance();
        return;
      }
      setCurrentTime(preview.loop * trim + audio.currentTime);
    };
    audio.onended = () => {
      if (activePreview.current === preview && audio.ended) advance();
    };
    playAudio();
  };
  const handlePreview = (file, duration, repeatCount) => {
    if (!file) return;
    const mockR = {
      _id: 'PREVIEW',
      file: file,
      duration: duration,
      repeatCount: repeatCount
    };
    handlePlayPause(mockR);
  };

  const handleSeek = (event) => {
    const preview = activePreview.current;
    if (!preview) return;

    const time = Number(event.target.value);
    if (time >= playbackDuration) {
      stopAudio();
      return;
    }
    preview.loop = Math.floor(time / preview.trim);
    preview.audio.currentTime = time % preview.trim;
    setCurrentTime(time);
  };
  const pendingDurations = ringtones.filter(ringtone => durationDrafts[ringtone._id] != null && durationDrafts[ringtone._id] !== (ringtone.duration || 15));
  const editedRingtone = showEditModal && ringtones.find(ringtone => ringtone._id === editId);
  const editDirty = Boolean(editedRingtone && (
    editedRingtone.name !== editName || (editedRingtone.category || 'General') !== editCategory ||
    (editedRingtone.repeatCount || 1) !== editRepeatCount || (editedRingtone.duration || 15) !== editDuration
  ));
  const saveRingtoneDrafts = async () => {
    if (editDirty && !editForm.current?.reportValidity()) return false;
    try {
      for (const ringtone of pendingDurations) {
        if (!editDirty || ringtone._id !== editId) await handleSaveDuration(ringtone._id, durationDrafts[ringtone._id]);
      }
      return editDirty ? handleUpdateRingtone() : true;
    } catch (err) {
      triggerError(err.response?.data?.message || 'Could not save the ringtone durations. Try again.');
      return false;
    }
  };

  return (
    <div className="animated-fade-in">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="fw-extrabold text-dark mb-1">Whistlez Ringtone</h1>
          <p className="text-muted small mb-0">Review system default and active audio sound files for broadcast counters.</p>
        </div>
        
        <button 
          className="btn btn-premium px-4 text-white bg-purple bg-gradient border-0"
          style={{ backgroundColor: 'var(--action)' }}
          onClick={() => setShowModal(true)}
        >
          Add New Ringtone
        </button>
      </div>

      {success && (
        <div className="alert alert-success border-0 rounded-3 small mb-4 py-2 shadow-sm" role="alert">
          <i className="bi bi-check-circle-fill me-2 fs-5"></i>
          <span>{success}</span>
        </div>
      )}

      {error && !showModal && !showEditModal && (
        <div className="alert alert-danger border-0 rounded-3 small mb-4 py-2 shadow-sm" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
          <span>{error}</span>
        </div>
      )}

      {/* Grid List of Sounds */}
      <div className="row g-4">
        {loading ? (
          <div className="col-12 text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        ) : ringtones.length > 0 ? (
          ringtones.map((r) => (
            <div className="col-12 col-md-6" key={r._id}>
              <article className="card ringtone-card h-100">
                <header className="ringtone-card-header">
                  <div className="ringtone-card-identity">
                    <span className="ringtone-card-icon"><i className="bi bi-music-note-beamed" aria-hidden="true" /></span>
                    <div>
                      <h2>{r.name}</h2>
                      <p>{r.category || 'General'} · {r.originalDuration || r.duration || 15}s audio</p>
                    </div>
                  </div>

                  <label className="ringtone-card-status form-check form-switch">
                    <span>{r.isActive ? 'Active' : 'Inactive'}</span>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      aria-label={`Active status for ${r.name}`}
                      checked={r.isActive}
                      onChange={() => handleToggleActive(r._id, r.name)}
                    />
                  </label>
                </header>

                <RingtoneDurationControl
                  ringtone={r}
                  draft={durationDrafts[r._id] ?? null}
                  onDraftChange={(id, value) => {
                    if (playingId === id) stopAudio();
                    setDurationDrafts(current => ({ ...current, [id]: value }));
                  }}
                  onSave={handleSaveDuration}
                  preview={playingId === r._id ? { currentTime, total: playbackDuration } : null}
                  onPreview={duration => handlePlayPause({ ...r, duration })}
                  onSeek={handleSeek}
                />

                <footer className="ringtone-card-actions">
                  <button type="button" className="btn btn-outline-secondary" title="Edit ringtone" onClick={() => handleEditClick(r)}>
                    <i className="bi bi-pencil me-2" aria-hidden="true" />Edit
                  </button>
                  <button type="button" className="btn btn-outline-secondary text-danger" title="Delete ringtone" onClick={() => handleDelete(r._id, r.name)}>
                    <i className="bi bi-trash me-2" aria-hidden="true" />Delete
                  </button>
                </footer>
              </article>
            </div>
          ))
        ) : (
          <div className="col-12 text-center py-5 text-muted bg-white rounded-4 border shadow-sm">
            <i className="bi bi-music-note-list fs-1 mb-2 text-muted d-block"></i>
            No custom ringtones uploaded yet. Click "+ Add New Ringtone" above.
          </div>
        )}
      </div>

      {/* UPLOAD TICKET RINGTONE AUDIO MODAL */}
      {showModal && (
        <FormDialog labelledBy="ringtone-upload-title" busy={uploading} onClose={closeUploadForm}>
          <div className="modal-content">
            <div className="modal-header border-0 pb-0">
              <h2 id="ringtone-upload-title" className="modal-title h5 fw-extrabold text-dark">Add New Ringtone</h2>
              <button type="button" className="btn-close" aria-label="Close form" disabled={uploading} onClick={closeUploadForm}></button>
            </div>

            <form onSubmit={handleCreateRingtone}>
              <div className="modal-body py-3">
                <div className="mb-4">
                  <UploadField
                    id="ringtone-upload-audio-file-mp3-wav"
                    icon="music-note-beamed"
                    label="Audio file"
                    action={soundFile ? 'Replace audio' : 'Choose audio'}
                    hint="MP3 or WAV, up to 5 MB"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    disabled={uploading}
                    required
                    errorId={soundFileError ? 'ringtone-audio-error' : undefined}
                  />
                  {(readingSound || soundFile) && (
                    <p className="portal-file-detail mt-2 mb-0" role="status">
                      {readingSound ? 'Reading audio…' : <><strong>{soundFileName}</strong> <span>· {soundOriginalDuration}s original</span></>}
                    </p>
                  )}
                  {soundFileError && <p id="ringtone-audio-error" className="small text-danger mt-2 mb-0" role="alert">{soundFileError}</p>}
                </div>
                <div className="mb-3">
                  <label htmlFor="ringtone-upload-ringtone-name" className="form-label small fw-semibold text-muted">Ringtone Name</label>
                  <input id="ringtone-upload-ringtone-name" 
                    type="text" 
                    className="form-control form-control-custom"
                    placeholder="e.g. Siren Voice Alert"
                    value={soundName}
                    onChange={(e) => setSoundName(e.target.value)}
                    required
                  />
                </div>

                  <div className="mb-3">
                    <label htmlFor="ringtone-upload-category" className="form-label small fw-semibold text-muted">Category</label>
                    <select id="ringtone-upload-category" className="form-select form-control-custom" value={soundCategory} onChange={(e) => setSoundCategory(e.target.value)}>
                      <option value="General">General</option>
                      <option value="SOS">SOS</option>
                      <option value="Notifications">Notifications</option>
                      <option value="Buzz">Buzz</option>
                      <option value="Whistlez Movement">Whistlez Movement</option>
                    </select>
                  </div>
                  <div className="row" hidden={!soundFile}>
                    <div className="col-md-6 mb-3">
                      <label htmlFor="ringtone-upload-repeat-count" className="form-label small fw-semibold text-muted">Repeat Count</label>
                      <input id="ringtone-upload-repeat-count" type="number" min="1" max="20" className="form-control form-control-custom" value={soundRepeatCount} onChange={(e) => setSoundRepeatCount(Number(e.target.value))} disabled={!soundFile} required />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label htmlFor="ringtone-upload-trim-duration-sec" className="form-label small fw-semibold text-muted">Trim Duration (sec)</label>
                      <input id="ringtone-upload-trim-duration-sec" type="number" min="1" max={soundOriginalDuration || 600} className="form-control form-control-custom" value={soundDuration} onChange={(e) => setSoundDuration(Number(e.target.value))} disabled={!soundFile} required />
                    </div>
                  </div>
                  {soundFile && <div className="portal-form-summary d-flex flex-wrap gap-2 justify-content-between align-items-center">
                      <div>
                        <h3 className="h6 fw-bold mb-1">Playback preview</h3>
                        <p className="small text-muted mb-0">{soundDuration}s per play × {soundRepeatCount} · <strong>{soundDuration * soundRepeatCount}s total</strong></p>
                      </div>
                        <button 
                          type="button" 
                          className="btn btn-outline-primary portal-preview-button"
                          onClick={() => handlePreview(soundFile, soundDuration, soundRepeatCount)}
                          disabled={soundDuration < 1 || soundDuration > soundOriginalDuration || soundRepeatCount < 1 || soundRepeatCount > 20}
                        >
                          <i className={`bi ${playingId === 'PREVIEW' ? 'bi-stop-fill' : 'bi-play-fill'} me-1`} aria-hidden="true" />
                          {playingId === 'PREVIEW' ? 'Stop preview' : 'Play preview'}
                        </button>
                  </div>}

              </div>

              <div className="modal-footer border-0 pt-0 d-flex gap-2">
                {error && <p className="portal-save-feedback text-danger" role="alert">{error}</p>}
                <button type="button" className="btn btn-outline-secondary flex-grow-1 py-2.5 rounded-3" disabled={uploading} onClick={closeUploadForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-grow-1 py-2.5 rounded-3 fw-bold bg-purple border-0" style={{ backgroundColor: 'var(--action)' }} disabled={uploading || readingSound}>
                  {uploading ? 'Uploading…' : 'Upload ringtone'}
                </button>
              </div>
            </form>
          </div>
        </FormDialog>
      )}

      {/* RENAME RINGTONE MODAL */}
      {showEditModal && (
        <FormDialog labelledBy="ringtone-edit-title" onClose={() => setShowEditModal(false)}>
          <div className="modal-content">
            <div className="modal-header border-0 pb-0">
              <h2 id="ringtone-edit-title" className="modal-title h5 fw-extrabold text-dark">Edit Ringtone Name</h2>
              <button type="button" className="btn-close" aria-label="Close form" onClick={() => setShowEditModal(false)}></button>
            </div>

            <form ref={editForm} onSubmit={handleUpdateRingtone}>
              <div className="modal-body py-3">
                {error && <div className="alert alert-danger" role="alert">{error}</div>}
                <div className="mb-3">
                  <label htmlFor="ringtone-edit-ringtone-name" className="form-label small fw-semibold text-muted">Ringtone Name</label>
                  <input id="ringtone-edit-ringtone-name" 
                    type="text" 
                    className="form-control form-control-custom"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                  <div className="mb-3">
                    <label htmlFor="ringtone-edit-category" className="form-label small fw-semibold text-muted">Category</label>
                    <select id="ringtone-edit-category" className="form-select form-control-custom" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                      <option value="General">General</option>
                      <option value="SOS">SOS</option>
                      <option value="Notifications">Notifications</option>
                      <option value="Buzz">Buzz</option>
                      <option value="Whistlez Movement">Whistlez Movement</option>
                    </select>
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="ringtone-edit-repeat-count" className="form-label small fw-semibold text-muted">Repeat Count</label>
                      <input id="ringtone-edit-repeat-count" type="number" min="1" max="20" className="form-control form-control-custom" value={editRepeatCount} onChange={(e) => setEditRepeatCount(Number(e.target.value))} required />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label htmlFor="ringtone-edit-trim-duration-sec" className="form-label small fw-semibold text-muted">Trim Duration (sec)</label>
                      <input id="ringtone-edit-trim-duration-sec" type="number" min="1" max={editOriginalDuration || 600} className="form-control form-control-custom" value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))} required />
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="p-3 bg-light rounded-3 d-flex flex-wrap gap-2 justify-content-between align-items-center border border-primary-subtle">
                      <div>
                        <h6 className="fw-bold mb-1" style={{ color: 'var(--accent)' }}>Total Playback Duration</h6>
                        <p className="small text-muted mb-0">Original File: {editOriginalDuration}s | Trimmed to: {editDuration}s × {editRepeatCount}</p>
                      </div>
                      <div className="d-inline-flex align-items-center gap-1">
                        <span className="fs-4 fw-bold text-dark lh-1">
                          {editDuration * editRepeatCount}s
                        </span>
                        <button
                          type="button"
                          className="ringtone-edit-preview"
                          onClick={() => handlePreview(editFile, editDuration, editRepeatCount)}
                          disabled={!editFile}
                          aria-label={playingId === 'PREVIEW' ? 'Stop preview' : 'Play preview'}
                        >
                          <i className={`bi ${playingId === 'PREVIEW' ? 'bi-stop-fill' : 'bi-play-fill'}`} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
              </div>

              <div className="modal-footer border-0 pt-0 d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary flex-grow-1 py-2.5 rounded-3" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-grow-1 py-2.5 rounded-3 fw-bold bg-purple border-0" style={{ backgroundColor: 'var(--action)' }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </FormDialog>
      )}
      <UnsavedChanges dirty={pendingDurations.length > 0 || editDirty} onSave={saveRingtoneDrafts} />
    </div>
  );
};

export default SuperAdminRingtones;










