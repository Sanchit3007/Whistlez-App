import React, { useCallback, useState, useEffect, useRef } from 'react';
import FormDialog from '../../components/FormDialog';
import UnsavedChanges from '../../components/UnsavedChanges';
import { useAuth, api } from '../../context/AuthContext';
import './AdminTimeSlots.css';

const getToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const formatDay = (date) => dayFormat.format(new Date(date));

const getSlotStatus = (slot) => {
  if (slot.isActive === false) return 'Closed';
  return (slot.bookedCount || 0) >= slot.maxCapacity ? 'Full' : 'Available';
};

const getTimeHint = (slot, existingSlots) => {
  if (!slot?.startTime || !slot.endTime) return '';
  if (slot.endTime <= slot.startTime) return 'For a same-day slot, choose an end time after the start time.';
  const overlap = existingSlots.find(other =>
    other._id !== slot._id && other.isActive !== false &&
    other.startTime < slot.endTime && other.endTime > slot.startTime
  );
  return overlap ? `Overlaps the ${overlap.startTime}–${overlap.endTime} slot. Adjust either time to avoid overlap.` : '';
};

const SlotCapacity = ({ slot }) => {
  const booked = slot.bookedCount || 0;
  const capacity = slot.maxCapacity;
  return (
    <div className="slot-capacity">
      <p className="small text-muted mb-1">{booked} of {capacity} booked</p>
      <div className="slot-capacity-track" aria-hidden="true">
        <span data-status={getSlotStatus(slot)} style={{ width: Math.min(100, booked / Math.max(1, capacity) * 100) + '%' }} />
      </div>
    </div>
  );
};

const AdminTimeSlots = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getToday);
  const [schedule, setSchedule] = useState(null);
  const scheduleRequest = useRef(null);
  const quickStart = useRef(null);
  const quickForm = useRef(null);
  const advancedForm = useRef(null);
  const editForm = useRef(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingSlot, setSavingSlot] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [createDate, setCreateDate] = useState('');
  const [advancedSlot, setAdvancedSlot] = useState(null);
  const [otherDay, setOtherDay] = useState(null);
  const [newSlot, setNewSlot] = useState({
    startTime: '09:00',
    endTime: '10:00',
    maxCapacity: 1
  });
  const [quickBaseline, setQuickBaseline] = useState(newSlot);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [editBaseline, setEditBaseline] = useState(null);
  const [advancedBaseline, setAdvancedBaseline] = useState(null);
  const changed = (slot, baseline) => Object.keys(baseline || {}).some(key => String(slot?.[key]) !== String(baseline[key]));
  const dirtyQuick = changed(newSlot, quickBaseline);
  const dirtyAdvanced = showModal && (createDate !== selectedDate || changed(advancedSlot, advancedBaseline));
  const dirtyEdit = showEditModal && changed(editingSlot, editBaseline);

  const day = schedule?.date === selectedDate ? schedule : null;
  const slots = day?.slots || [];
  const quickTimeHint = getTimeHint(newSlot, slots);
  const createTimeHint = getTimeHint(advancedSlot, createDate === selectedDate ? slots : otherDay?.date === createDate ? otherDay.slots : []);
  const editTimeHint = getTimeHint(editingSlot, slots);
  const bookedTotal = slots.reduce((total, slot) => total + (slot.bookedCount || 0), 0);
  const availableTotal = slots.reduce((total, slot) => total + (slot.isActive === false ? 0 : Math.max(0, slot.maxCapacity - (slot.bookedCount || 0))), 0);

  const fetchSlots = useCallback(async () => {
    scheduleRequest.current?.abort();
    const request = new AbortController();
    scheduleRequest.current = request;
    setSchedule(null);
    try {
      const { data } = await api.get('/admin/time-slots', { params: { date: selectedDate }, signal: request.signal });
      if (!data.success || !Array.isArray(data.slots)) throw new Error('Invalid time slot response');
      if (!request.signal.aborted) setSchedule({ date: selectedDate, slots: data.slots });
    } catch (err) {
      if (!request.signal.aborted) setSchedule({ date: selectedDate, error: err.response?.data?.message || 'Could not load time slots.' });
    }
  }, [selectedDate]);

  useEffect(() => {
    if (user) fetchSlots();
    return () => scheduleRequest.current?.abort();
  }, [user, fetchSlots]);

  useEffect(() => {
    if (!showModal || !createDate || createDate === selectedDate) return undefined;
    const request = new AbortController();
    setOtherDay(null);
    api.get('/admin/time-slots', { params: { date: createDate }, signal: request.signal })
      .then(({ data }) => {
        if (!request.signal.aborted && data.success && Array.isArray(data.slots)) {
          setOtherDay({ date: createDate, slots: data.slots });
        }
      })
      .catch(() => {});
    return () => request.abort();
  }, [showModal, createDate, selectedDate]);

  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setUTCDate(d.getUTCDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleCreateSlot = async (e, useAdvanced = showModal) => {
    e?.preventDefault();
    if (savingSlot) return false;
    const date = useAdvanced ? createDate : selectedDate;
    const slot = useAdvanced ? advancedSlot : newSlot;
    setError('');
    setSavingSlot(true);
    try {
      const payload = {
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        maxCapacity: parseInt(slot.maxCapacity, 10)
      };
      
      const res = await api.post(`/admin/time-slots`, payload);

      if (res.data.success) {
        setSuccess('Time slot created successfully!');
        if (useAdvanced) setShowModal(false);
        else setQuickBaseline(slot);
        // If the new slot is for the currently viewed date, refresh
        if (date === selectedDate) {
          fetchSlots();
        } else {
          // Switch to the newly created slot's date
          setSelectedDate(date);
        }
        return true;
      }
      setError(res.data.message || 'Failed to create slot');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to create slot');
    } finally {
      setSavingSlot(false);
    }
    return false;
  };

  const handleUpdateSlot = async (e) => {
    e?.preventDefault();
    if (savingSlot) return false;
    setError('');
    setSavingSlot(true);
    try {
      const payload = {
        startTime: editingSlot.startTime,
        endTime: editingSlot.endTime,
        maxCapacity: parseInt(editingSlot.maxCapacity, 10),
        isActive: editingSlot.isActive
      };
      
      const res = await api.put(`/admin/time-slots/${editingSlot._id}`, payload);

      if (res.data.success) {
        setSuccess('Time slot updated successfully!');
        setShowEditModal(false);
        fetchSlots();
        return true;
      }
      setError(res.data.message || 'Failed to update slot');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to update slot');
    } finally {
      setSavingSlot(false);
    }
    return false;
  };

  const saveSlotDrafts = async () => {
    const openForm = dirtyEdit ? editForm.current : dirtyAdvanced ? advancedForm.current : null;
    if (openForm && !openForm.reportValidity()) return false;
    if (dirtyQuick && !quickForm.current?.checkValidity()) {
      if (!showModal && !showEditModal) quickForm.current?.reportValidity();
      else setError('Close this dialog and complete the Quick add fields before saving both drafts.');
      return false;
    }
    if (dirtyQuick && !(await handleCreateSlot(undefined, false))) return false;
    if (dirtyAdvanced) return handleCreateSlot(undefined, true);
    if (dirtyEdit) return handleUpdateSlot();
    return true;
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Are you sure you want to delete this slot?')) return;
    try {
      setError('');
      const res = await api.delete(`/admin/time-slots/${slotId}`);

      if (res.data.success) {
        setSuccess('Slot deleted');
        fetchSlots();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to delete slot');
    }
  };

  const renderSlotStatus = (slot) => {
    const status = getSlotStatus(slot);
    return <span className="slot-status" data-status={status}>{status}</span>;
  };

  const renderSlotActions = (slot) => (
    <div className="slot-row-actions">
      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => {
        setError('');
        setEditingSlot(slot);
        setEditBaseline(slot);
        setShowEditModal(true);
      }} aria-label={`Edit slot ${slot.startTime} to ${slot.endTime}`}>
        <i className="bi bi-pencil" aria-hidden="true" /> Edit
      </button>
      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteSlot(slot._id)} disabled={slot.bookedCount > 0}
        aria-label={`Delete slot ${slot.startTime} to ${slot.endTime}`} title={slot.bookedCount > 0 ? 'Cannot delete slot with bookings' : 'Delete slot'}>
        <i className="bi bi-trash" aria-hidden="true" />
      </button>
      {slot.bookedCount > 0 && <small className="text-muted w-100">Existing bookings prevent deletion.</small>}
    </div>
  );

  return (
    <div className="container-fluid">
      <div className="workspace-heading">
        <h1>Time Slot Management</h1>
        <button type="button" className="btn btn-outline-primary" disabled={savingSlot} onClick={() => {
          setError('');
          setCreateDate(selectedDate);
          setAdvancedSlot(newSlot);
          setAdvancedBaseline(newSlot);
          setShowModal(true);
        }}>
          <i className="bi bi-calendar-plus me-1" aria-hidden="true" /> Add for another date
        </button>
      </div>

      {error && !showModal && !showEditModal && <div className="alert alert-danger alert-dismissible fade show" role="alert">
        {error}
        <button type="button" className="btn-close" onClick={() => setError('')} aria-label="Close"></button>
      </div>}

      {success && <div className="alert alert-success alert-dismissible fade show" role="alert">
        {success}
        <button type="button" className="btn-close" onClick={() => setSuccess('')} aria-label="Close"></button>
      </div>}


      <section className="slot-card" aria-label="Schedule date and capacity">
        <div className="slot-date-toolbar">
          <div className="slot-date-navigation">
            <button type="button" className="btn btn-outline-secondary" aria-label="Previous day" onClick={() => changeDate(-1)} disabled={savingSlot}>
              <i className="bi bi-chevron-left" aria-hidden="true" />
            </button>
            <time dateTime={selectedDate}>{formatDay(selectedDate)}</time>
            <button type="button" className="btn btn-outline-secondary" aria-label="Next day" onClick={() => changeDate(1)} disabled={savingSlot}>
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </button>
          </div>
          <div className="slot-date-tools">
            <button type="button" className="btn btn-outline-primary" onClick={() => setSelectedDate(getToday())} disabled={savingSlot}>Today</button>
            <input type="date" className="form-control" aria-label="Time slot date" value={selectedDate} disabled={savingSlot} onChange={event => {
              if (event.target.value) setSelectedDate(event.target.value);
            }} />
          </div>
        </div>
        <dl className="slot-summary mb-0">
          <div><dt>Slots</dt><dd>{day && !day.error ? slots.length : '—'}</dd></div>
          <div><dt>Booked</dt><dd>{day && !day.error ? bookedTotal : '—'}</dd></div>
          <div><dt>Available</dt><dd>{day && !day.error ? availableTotal : '—'}</dd></div>
        </dl>
      </section>

      <section className="slot-card" aria-labelledby="quick-slot-title">
        <h2 id="quick-slot-title" className="portal-form-section-title">
          <i className="bi bi-lightning-charge portal-form-icon" aria-hidden="true" /> Quick add
        </h2>
        <form ref={quickForm} className="slot-quick-form" onSubmit={handleCreateSlot}>
          <div>
            <label htmlFor="slots-start-time" className="form-label">Start time</label>
            <input ref={quickStart} id="slots-start-time" type="time" className="form-control" value={newSlot.startTime} onChange={event => setNewSlot({ ...newSlot, startTime: event.target.value })} required />
          </div>
          <div>
            <label htmlFor="slots-end-time" className="form-label">End time</label>
            <input id="slots-end-time" type="time" className="form-control" value={newSlot.endTime} aria-describedby={quickTimeHint ? 'slots-time-hint' : undefined} onChange={event => setNewSlot({ ...newSlot, endTime: event.target.value })} required />
          </div>
          {quickTimeHint && <p id="slots-time-hint" className="slot-quick-hint portal-time-hint mb-0" role="status">{quickTimeHint}</p>}
          <div className="slot-quick-capacity">
            <label htmlFor="slots-capacity" className="form-label">Capacity</label>
            <input id="slots-capacity" type="number" min="1" className="form-control" value={newSlot.maxCapacity} onChange={event => setNewSlot({ ...newSlot, maxCapacity: event.target.value })} required />
          </div>
          <button type="submit" className="btn btn-primary workspace-primary" disabled={savingSlot}>
            <i className="bi bi-plus-circle" aria-hidden="true" /> {savingSlot ? 'Creating…' : 'Add slot'}
          </button>
        </form>
      </section>

      <section className="slot-card slot-schedule" aria-labelledby="slot-schedule-title" aria-busy={!day}>
        <h2 id="slot-schedule-title" className="portal-form-section-title">
          <i className="bi bi-calendar-week portal-form-icon" aria-hidden="true" /> Daily schedule
        </h2>
        {!day ? (
          <p className="text-muted mb-0" role="status">Loading time slots…</p>
        ) : day.error ? (
          <div>
            <p className="text-danger" role="alert">{day.error}</p>
            <button type="button" className="btn btn-outline-primary" onClick={fetchSlots}>Retry</button>
          </div>
        ) : slots.length === 0 ? (
          <div className="slot-empty">
            <h3>No slots scheduled for {formatDay(selectedDate)}</h3>
            <button type="button" className="btn btn-outline-primary" onClick={() => quickStart.current?.focus()}>Add first slot</button>
          </div>
        ) : (
          <>
            <div className="slot-desktop-table table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr><th scope="col">Time</th><th scope="col">Booked / capacity</th><th scope="col">Status</th><th scope="col">Actions</th></tr>
                </thead>
                <tbody>
                  {slots.map(slot => (
                    <tr key={slot._id}>
                      <th scope="row">{slot.startTime}–{slot.endTime}</th>
                      <td><SlotCapacity slot={slot} /></td>
                      <td>{renderSlotStatus(slot)}</td>
                      <td>{renderSlotActions(slot)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="slot-mobile-list">
              {slots.map(slot => (
                <li key={slot._id} className="slot-mobile-item">
                  <div className="slot-mobile-heading">
                    <h3>{slot.startTime}–{slot.endTime}</h3>
                    {renderSlotStatus(slot)}
                  </div>
                  <SlotCapacity slot={slot} />
                  {renderSlotActions(slot)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Modal for creating a slot */}
      {showModal && (
        <FormDialog labelledBy="slot-create-title" busy={savingSlot} onClose={() => setShowModal(false)}>
          <div className="modal-content">
            <form ref={advancedForm} onSubmit={handleCreateSlot}>
              <div className="modal-header">
                <h2 id="slot-create-title" className="modal-title h5">Create Time Slot</h2>
                <button type="button" className="btn-close" aria-label="Close form" disabled={savingSlot} onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                {error && <div className="alert alert-danger" role="alert">{error}</div>}
                <div className="mb-3">
                  <label htmlFor="slot-create-date" className="form-label">Date</label>
                  <input id="slot-create-date" 
                    type="date" 
                    className="form-control" 
                    value={createDate}
                    onChange={event => setCreateDate(event.target.value)}
                    required
                  />
                </div>
                <div className="row mb-3">
                  <div className="col">
                    <label htmlFor="slot-create-start-time" className="form-label">Start Time</label>
                    <input id="slot-create-start-time" 
                      type="time" 
                      className="form-control" 
                      required
                      value={advancedSlot.startTime}
                      onChange={event => setAdvancedSlot({ ...advancedSlot, startTime: event.target.value })}
                    />
                  </div>
                  <div className="col">
                    <label htmlFor="slot-create-end-time" className="form-label">End Time</label>
                    <input id="slot-create-end-time" 
                      type="time" 
                      className="form-control" 
                      required
                      value={advancedSlot.endTime}
                      aria-describedby={createTimeHint ? 'slot-create-time-hint' : undefined}
                      onChange={event => setAdvancedSlot({ ...advancedSlot, endTime: event.target.value })}
                    />
                  </div>
                  {createTimeHint && <p id="slot-create-time-hint" className="portal-time-hint col-12 mt-2 mb-0" role="status">{createTimeHint}</p>}
                </div>
                <div className="mb-3">
                  <label htmlFor="slot-create-max-capacity-tokens" className="form-label">Max Capacity (Tokens)</label>
                  <input id="slot-create-max-capacity-tokens" 
                    type="number" 
                    className="form-control" 
                    min="1" 
                    required
                    value={advancedSlot.maxCapacity}
                    onChange={event => setAdvancedSlot({ ...advancedSlot, maxCapacity: event.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" disabled={savingSlot} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingSlot}>{savingSlot ? 'Creating…' : 'Create slot'}</button>
              </div>
            </form>
          </div>
        </FormDialog>
      )}

      {/* Modal for editing a slot */}
      {showEditModal && editingSlot && (
        <FormDialog labelledBy="slot-edit-title" busy={savingSlot} onClose={() => setShowEditModal(false)}>
          <div className="modal-content">
            <form ref={editForm} onSubmit={handleUpdateSlot}>
              <div className="modal-header">
                <h2 id="slot-edit-title" className="modal-title h5">Edit Time Slot</h2>
                <button type="button" className="btn-close" aria-label="Close form" disabled={savingSlot} onClick={() => setShowEditModal(false)}></button>
              </div>
              <div className="modal-body">
                {error && <div className="alert alert-danger" role="alert">{error}</div>}
                <div className="mb-3">
                  <label htmlFor="slot-edit-date" className="form-label text-muted">Date</label>
                  <input id="slot-edit-date" type="text" className="form-control" value={editingSlot.date} disabled />
                  <small className="text-muted">Date cannot be changed. Create a new slot instead.</small>
                </div>
                <div className="row mb-3">
                  <div className="col">
                    <label htmlFor="slot-edit-start-time" className="form-label">Start Time</label>
                    <input id="slot-edit-start-time" 
                      type="time" 
                      className="form-control" 
                      required
                      value={editingSlot.startTime}
                      onChange={(e) => setEditingSlot({...editingSlot, startTime: e.target.value})}
                    />
                  </div>
                  <div className="col">
                    <label htmlFor="slot-edit-end-time" className="form-label">End Time</label>
                    <input id="slot-edit-end-time" 
                      type="time" 
                      className="form-control" 
                      required
                      value={editingSlot.endTime}
                      aria-describedby={editTimeHint ? 'slot-edit-time-hint' : undefined}
                      onChange={(e) => setEditingSlot({...editingSlot, endTime: e.target.value})}
                    />
                  </div>
                  {editTimeHint && <p id="slot-edit-time-hint" className="portal-time-hint col-12 mt-2 mb-0" role="status">{editTimeHint}</p>}
                </div>
                <div className="mb-3">
                  <label htmlFor="slot-edit-max-capacity-tokens" className="form-label">Max Capacity (Tokens)</label>
                  <input id="slot-edit-max-capacity-tokens" 
                    type="number" 
                    className="form-control" 
                    min={editingSlot.bookedCount > 0 ? editingSlot.bookedCount : 1} 
                    required
                    value={editingSlot.maxCapacity}
                    onChange={(e) => setEditingSlot({...editingSlot, maxCapacity: e.target.value})}
                  />
                  {editingSlot.bookedCount > 0 && (
                    <small className="text-warning">Capacity cannot be less than {editingSlot.bookedCount} (already booked).</small>
                  )}
                </div>
                <div className="mb-3 form-check form-switch">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="isActiveSwitch"
                    checked={editingSlot.isActive}
                    onChange={(e) => setEditingSlot({...editingSlot, isActive: e.target.checked})}
                  />
                  <label className="form-check-label" htmlFor="isActiveSwitch">Active (Users can book this slot)</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" disabled={savingSlot} onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingSlot}>{savingSlot ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </div>
        </FormDialog>
      )}
      <UnsavedChanges dirty={dirtyQuick || dirtyAdvanced || dirtyEdit} onSave={saveSlotDrafts} />
    </div>
  );
};

export default AdminTimeSlots;
