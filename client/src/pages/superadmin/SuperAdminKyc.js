import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import FilterToolbar from '../../components/FilterToolbar';
import { useSearchParams } from 'react-router-dom';
import FormDialog from '../../components/FormDialog';
import { api } from '../../context/AuthContext';
import { needsKycReview, verificationDocuments } from '../../utils/businessStatus';
import './SuperAdminKyc.css';

const kycStatusTones = {
  Approved: 'success',
  Rejected: 'danger',
  'Under Review': 'primary',
  'Resubmission Required': 'danger',
  Submitted: 'primary',
};

const KycStatus = ({ status }) => {
  const tone = kycStatusTones[status] || 'warning';
  return <span className={`badge bg-${tone}-subtle text-${tone}-emphasis workspace-status`}>{status || 'Pending'}</span>;
};

const isPending = request => !request.kycStatus || request.kycStatus === 'Pending' || needsKycReview(request);
const isHistory = request => ['Approved', 'Rejected'].includes(request.kycStatus);

const filters = [
  { id: 'all', label: 'All', matches: () => true, empty: 'No KYC applications yet.' },
  { id: 'pending', label: 'Pending', matches: isPending, empty: 'No applications are awaiting verification.' },
  { id: 'active', label: 'Active', matches: request => request.businessStatus === 'Active', empty: 'No active businesses to show.' },
  { id: 'history', label: 'History', matches: isHistory, empty: 'No completed reviews yet.' },
];

const updatedAt = request => new Date(request.updatedAt || 0).getTime() || 0;

const compareRequests = (first, second) => {
  const firstNeedsReview = needsKycReview(first);
  const secondNeedsReview = needsKycReview(second);
  if (firstNeedsReview !== secondNeedsReview) return firstNeedsReview ? -1 : 1;
  if (firstNeedsReview) return (updatedAt(first) || Infinity) - (updatedAt(second) || Infinity) || 0;
  return updatedAt(second) - updatedAt(first);
};

const UpdatedDate = ({ request }) => {
  const timestamp = updatedAt(request);
  if (!timestamp) return <span>—</span>;
  const date = new Date(timestamp);
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
  return (
    <>
      <time dateTime={date.toISOString()}>{date.toLocaleDateString(undefined, { dateStyle: 'medium' })}</time>
      {needsKycReview(request) && <small className="kyc-date-age">{days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'} ago`}</small>}
    </>
  );
};

const getDocumentLabel = (type) => verificationDocuments.find(doc => doc.type === type)?.label || type;

const KycBusinessDetails = ({ business }) => {
  const details = business.kycDetails;
  const isCompany = (business.businessType || 'Company') === 'Company';
  const businessFields = [
    ['PAN number', details?.panNumber],
    ['GST number', details?.gstNumber],
    ...(isCompany ? [
      ['Legal name', details?.companyDetails?.legalName],
      ['Registration number', details?.companyDetails?.registrationNumber]
    ] : [['Aadhaar / ID', details?.individualDetails?.aadhaarOrId]])
  ];

  return (
    <section className="kyc-business-information" aria-labelledby="kyc-business-heading">
      <h3 id="kyc-business-heading" className="portal-form-section-title">Business information</h3>
      <dl className="kyc-business-facts">
        {[
          ['Phone', details?.phoneNumber],
          ['Email', details?.emailAddress],
          ...businessFields
        ].map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>
        ))}
      </dl>
    </section>
  );
};

const KycInspection = ({ source, label, original, unavailable, onError }) => {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [imageRatio, setImageRatio] = useState(1);
  const sideways = rotation % 180 !== 0;

  return (
    <>
      <div className="kyc-viewer-tools" role="group" aria-label="Document tools">
        {!unavailable && (
          <>
            <button type="button" className="btn btn-outline-secondary" aria-label="Zoom out" disabled={zoom === 100} onClick={() => setZoom(value => value - 25)}>
              <i className="bi bi-dash-lg" aria-hidden="true" />
            </button>
            <output aria-label="Zoom level">{zoom}%</output>
            <button type="button" className="btn btn-outline-secondary" aria-label="Zoom in" disabled={zoom === 200} onClick={() => setZoom(value => value + 25)}>
              <i className="bi bi-plus-lg" aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setRotation(value => (value + 90) % 360)}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />Rotate
            </button>
          </>
        )}
        <a className="btn btn-outline-primary" href={original} target="_blank" rel="noreferrer">Open original</a>
      </div>
      <div className="modal-body kyc-viewer-scroll" role="region" aria-label="Document preview" tabIndex={0}>
        {unavailable ? <p className="text-muted mb-0">Preview unavailable. Open the original to review this document.</p> : (
          <div className="kyc-viewer-sheet" style={{ '--kyc-zoom': zoom / 100, aspectRatio: sideways ? 1 / imageRatio : imageRatio }}>
            <img src={source} alt={`${label} preview`} onError={onError}
              onLoad={event => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                if (naturalWidth && naturalHeight) setImageRatio(naturalWidth / naturalHeight);
              }}
              style={{
                width: sideways ? `${imageRatio * 100}%` : '100%',
                height: sideways ? `${100 / imageRatio}%` : '100%',
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`
              }} />
          </div>
        )}
      </div>
    </>
  );
};

const KycDocuments = ({ documents }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const files = (documents || []).filter(document => document?.url);
  const selected = files[selectedIndex];
  const checklist = [
    ...files.map((file, index) => ({ label: getDocumentLabel(file.docType) || `Document ${index + 1}`, index })),
    ...verificationDocuments.filter(doc => !files.some(file => file.docType === doc.type)).map(doc => ({ label: doc.label }))
  ];
  // Cloudinary can render the first PDF page for quick inspection.
  const preview = selected?.url.replace(/\.pdf(?=\?|$)/i, '.jpg');
  const documentLabel = selected ? checklist[selectedIndex].label : '';
  const chooseDocument = (index) => {
    if (selectedIndex !== index) setUnavailable(false);
    setSelectedIndex(index);
  };

  return (
    <section className="kyc-documents" aria-labelledby="kyc-documents-heading">
      <header className="kyc-documents-heading">
        <h3 id="kyc-documents-heading" className="portal-form-section-title mb-0">Documents</h3>
        <span className="small text-muted">{files.length} uploaded</span>
      </header>
      <ul className="kyc-document-list">
        {checklist.map(({ label, index }) => (
          <li key={index ?? label}>
            {index === undefined ? (
              <div className="kyc-document-choice kyc-document-missing">
                <span><i className="bi bi-file-earmark me-2" aria-hidden="true" />{label}</span>
                <small className="kyc-document-status">Missing</small>
              </div>
            ) : (
              <button type="button" className="workspace-tab-button kyc-document-choice" aria-pressed={selectedIndex === index} onClick={() => chooseDocument(index)}>
                <span><i className="bi bi-file-earmark-text me-2" aria-hidden="true" />{label}</span>
                <small className="kyc-document-status"><i className="bi bi-check2" aria-hidden="true" /> Uploaded</small>
              </button>
            )}
          </li>
        ))}
      </ul>
      {selected ? (
        <>
          <div className="kyc-document-preview">
            {unavailable ? (
              <p className="text-muted mb-0">Preview unavailable. Open the original document to review it.</p>
            ) : (
              <img key={preview} src={preview} alt={`${documentLabel} preview`} onError={() => setUnavailable(true)} />
            )}
          </div>
          <div className="kyc-preview-actions">
            {!unavailable && <button type="button" className="btn btn-outline-primary" onClick={() => setFullScreen(true)}>
              <i className="bi bi-arrows-fullscreen me-2" aria-hidden="true" />Full-screen preview
            </button>}
            <a className="btn btn-outline-secondary" href={selected.url} target="_blank" rel="noreferrer">
              Open original <i className="bi bi-box-arrow-up-right ms-1" aria-hidden="true" />
            </a>
          </div>
          {fullScreen && (
            <FormDialog labelledBy="kyc-preview-title" wide fullScreenOnMobile className="kyc-preview-dialog" onClose={() => setFullScreen(false)}>
              <div className="modal-content">
                <header className="modal-header gap-3">
                  <h3 id="kyc-preview-title" className="modal-title h5">{documentLabel}</h3>
                  <button type="button" className="btn btn-outline-secondary kyc-preview-close" aria-label="Close document preview" onClick={() => setFullScreen(false)}>
                    <i className="bi bi-x-lg" aria-hidden="true" />
                  </button>
                </header>
                {files.length > 1 && (
                  <div className="kyc-viewer-nav" role="group" aria-label="Browse documents">
                    <button type="button" className="btn btn-outline-secondary" disabled={selectedIndex === 0} onClick={() => chooseDocument(selectedIndex - 1)}>Previous</button>
                    <span className="small text-muted" role="status">Document {selectedIndex + 1} of {files.length}</span>
                    <button type="button" className="btn btn-outline-secondary" disabled={selectedIndex === files.length - 1} onClick={() => chooseDocument(selectedIndex + 1)}>Next</button>
                  </div>
                )}
                <KycInspection key={selectedIndex} source={preview} label={documentLabel} original={selected.url}
                  unavailable={unavailable} onError={() => setUnavailable(true)} />
              </div>
            </FormDialog>
          )}
        </>
      ) : (
        <div className="kyc-documents-empty">
          <i className="bi bi-folder2-open" aria-hidden="true" />
          <p className="mb-0">No documents were uploaded for this application.</p>
        </div>
      )}
    </section>
  );
};

const SuperAdminKyc = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKyc, setSelectedKyc] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [correctionDocument, setCorrectionDocument] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [decisionStatus, setDecisionStatus] = useState('');
  const [loadError, setLoadError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [historyStatus, setHistoryStatus] = useState('');
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState('');
  const listRef = useRef(null);
  const listPosition = useRef(null);
  const reviewHeading = useRef(null);
  const reasonInput = useRef(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get('/superadmin/kyc-requests');
      if (!res.data.success || !Array.isArray(res.data.kycRequests)) throw new Error('Invalid applications response');
      setRequests(res.data.kycRequests);
    } catch {
      setLoadError('Could not load KYC applications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    const applicationId = searchParams.get('application');
    if (!applicationId || loading || loadError) return;
    const application = requests.find(request => request._id === applicationId);
    if (application) {
      setDecision('');
      setActionReason('');
      setCorrectionDocument('');
      setDecisionError('');
      setDecisionStatus('');
      setSelectedKyc(application);
    }
    const params = new URLSearchParams(searchParams);
    params.delete('application');
    setSearchParams(params, { replace: true });
  }, [loadError, loading, requests, searchParams, setSearchParams]);

  useLayoutEffect(() => {
    if (selectedKyc) {
      reviewHeading.current?.focus();
      return;
    }

    if (loading || !listPosition.current) return;
    const { id, scroll, top, x, y } = listPosition.current;
    listPosition.current = null;
    const row = Array.from(listRef.current?.querySelectorAll('[data-kyc-open]') || [])
      .find(button => button.dataset.kycOpen === id && button.getClientRects().length);
    const searchInput = listRef.current?.querySelector('input[type="search"]');
    (row || searchInput)?.focus({ preventScroll: true });
    if (scroll) scroll.scrollTop = top;
    window.scrollTo(x, y);
  }, [selectedKyc, loading]);

  useLayoutEffect(() => {
    if (decision) reasonInput.current?.form?.querySelector('select')?.focus();
  }, [decision]);

  const resetDecision = () => {
    setDecision('');
    setActionReason('');
    setCorrectionDocument('');
    setDecisionError('');
  };

  const openApplication = (request, event) => {
    const scroll = event.currentTarget.closest('main');
    listPosition.current = { id: request._id, scroll, top: scroll?.scrollTop, x: window.scrollX, y: window.scrollY };
    setDecisionStatus('');
    resetDecision();
    setSelectedKyc(request);
  };

  const handleAction = async (status) => {
    if (actionLoading) return;
    setDecisionError('');
    const reason = status === 'Approved' ? '' : actionReason.trim();
    if (status !== 'Approved' && !reason) {
      setDecisionError(status === 'Rejected' ? 'Enter a reason for rejecting this application.' : 'Enter a reason for requesting resubmission.');
      reasonInput.current?.focus();
      return;
    }
    if (status === 'Rejected' && !window.confirm(`Reject the KYC application for ${selectedKyc.name}?`)) return;

    try {
      setActionLoading(true);
      const res = await api.put(`/superadmin/kyc-requests/${selectedKyc._id}/status`, {
        status,
        rejectionReason: reason,
        correctionDocument: status === 'Approved' ? '' : correctionDocument
      });
      if (!res.data.success) throw new Error('KYC decision was not saved');
      if (res.data.business) {
        setRequests(current => current.map(request => request._id === selectedKyc._id ? { ...request, ...res.data.business } : request));
      } else {
        await fetchRequests();
      }
      setDecisionStatus(`KYC status for ${selectedKyc.name} updated to ${status}.`);
      resetDecision();
      setSelectedKyc(null);
    } catch (error) {
      setDecisionError(error.response?.data?.message || 'Could not save the KYC decision. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const filter = filters.find(option => option.id === activeFilter);
  const query = search.trim().toLowerCase();
  const hasSearchFilters = Boolean(query || (activeFilter === 'history' && historyStatus));
  const displayedRequests = requests.filter(request =>
    filter.matches(request) &&
    (!query || [request.name, ...(request.ownerNames || [])].some(name => name?.toLowerCase().includes(query))) &&
    (activeFilter !== 'history' || !historyStatus || request.kycStatus === historyStatus)
  ).sort(compareRequests);
  const canDecide = selectedKyc && !isHistory(selectedKyc);
  const openButton = (request, className) => (
    <button type="button" className={className} data-kyc-open={request._id} onClick={event => openApplication(request, event)}>
      {needsKycReview(request) ? 'Review' : 'View application'}
    </button>
  );

  return (
    <div className={`kyc-workspace${canDecide ? ' has-review-decision' : ''}`}>
      <div className="workspace-heading">
        <div>
          <h1 className="fw-extrabold text-dark mb-1">KYC review</h1>
          <p className="text-muted mb-0">Review business verification and submitted documents.</p>
        </div>
      </div>

      {decisionStatus && !selectedKyc && <p className="alert alert-success" role="status">{decisionStatus}</p>}

      {loading ? (
        <p role="status" className="card p-4 text-center text-muted">Loading KYC applications…</p>
      ) : loadError ? (
        <div className="card kyc-list-message">
          <p className="mb-0" role="alert">{loadError}</p>
          <button type="button" className="btn btn-outline-primary" onClick={fetchRequests}>Retry</button>
        </div>
      ) : !selectedKyc ? (
        <section ref={listRef} className="card kyc-application-list" aria-label="KYC applications">
          <div className="kyc-list-toolbar">
            <FilterToolbar columns={activeFilter === 'history' ? 2 : 1} searchField={
              <label className="workspace-field">
                <span>Search by business or owner name</span>
                <input type="search" className="form-control" value={search} onChange={event => setSearch(event.target.value)} />
              </label>
            }>
              <label className="workspace-field">
                <span>Application status</span>
                <select id="kyc-status-filter" className="form-select" value={activeFilter} onChange={event => {
                  setActiveFilter(event.target.value);
                  setHistoryStatus('');
                }}>
                  {filters.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {activeFilter === 'history' && (
                <label className="workspace-field">
                  <span>Decision status</span>
                  <select className="form-select" value={historyStatus} onChange={event => setHistoryStatus(event.target.value)}>
                    <option value="">All decisions</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </label>
              )}
            </FilterToolbar>
            <p className="kyc-results-count" role="status">{displayedRequests.length} {displayedRequests.length === 1 ? 'application' : 'applications'}</p>
          </div>
          {displayedRequests.length ? (
            <>
              <div className="workspace-compact-list p-3">
                {displayedRequests.map(request => (
                  <article className="workspace-compact-item kyc-compact-item" key={request._id}>
                    <div className="kyc-compact-heading">
                      <h2 className="h6 fw-bold mb-0">{request.name}</h2>
                      <KycStatus status={request.kycStatus} />
                    </div>
                    <div className="kyc-mobile-details">
                      <span>{request.businessType || 'Company'}</span>
                      <span>Updated <UpdatedDate request={request} /></span>
                    </div>
                    {openButton(request, 'btn btn-outline-primary workspace-primary w-100')}
                  </article>
                ))}
              </div>
              <div className="table-responsive workspace-comparison-table">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col" className="ps-4 py-3">Business name</th>
                      <th scope="col">Type</th>
                      <th scope="col">KYC status</th>
                      <th scope="col">Last updated</th>
                      <th scope="col" className="text-end pe-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRequests.map(request => (
                      <tr key={request._id}>
                        <th scope="row" className="ps-4 py-3 fw-semibold">{request.name}</th>
                        <td>{request.businessType || 'Company'}</td>
                        <td><KycStatus status={request.kycStatus} /></td>
                        <td><UpdatedDate request={request} /></td>
                        <td className="text-end pe-4">{openButton(request, 'btn btn-sm btn-outline-primary')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="kyc-list-message">
              <i className="bi bi-inbox" aria-hidden="true" />
              <p className="mb-0">{hasSearchFilters ? 'No applications match your filters.' : filter.empty}</p>
              {hasSearchFilters ? (
                <button type="button" className="btn btn-outline-secondary" onClick={() => { setSearch(''); setHistoryStatus(''); }}>Clear search filters</button>
              ) : null}
            </div>
          )}
        </section>
      ) : (
        <article className="card kyc-review-card" aria-labelledby="kyc-application-title">
          <header className="kyc-review-header">
            <div>
              <h2 id="kyc-application-title" ref={reviewHeading} tabIndex={-1}>{selectedKyc.name}</h2>
              <div className="kyc-review-meta">
                <KycStatus status={selectedKyc.kycStatus} />
                <span>{selectedKyc.businessType || 'Company'}</span>
              </div>
            </div>
            <button type="button" className="btn btn-outline-secondary workspace-primary" disabled={actionLoading} onClick={() => {
              resetDecision();
              setSelectedKyc(null);
            }}><i className="bi bi-arrow-left me-2" aria-hidden="true" />Back to applications</button>
          </header>
          <div className="kyc-review-grid">
            <KycBusinessDetails business={selectedKyc} />
            <KycDocuments key={selectedKyc._id} documents={selectedKyc.kycDetails?.documents} />

            {canDecide && (
              <section className="kyc-review-decision" id="kyc-review-decision" tabIndex={-1} aria-labelledby="kyc-decision-heading">
                <h3 id="kyc-decision-heading" className="portal-form-section-title">Review decision</h3>
                {!decision && <p className="small text-muted mb-3">Approval activates the business. Request resubmission when the application needs corrections.</p>}
                {!decision ? (
                  <div className="kyc-review-actions">
                    <button type="button" className="btn btn-primary" onClick={() => handleAction('Approved')} disabled={actionLoading}>
                      <i className="bi bi-check-lg me-2" aria-hidden="true" />{actionLoading ? 'Approving…' : 'Approve'}
                    </button>
                    <button type="button" className="btn btn-outline-secondary" disabled={actionLoading} onClick={() => {
                      setDecisionError('');
                      setDecision('Resubmission Required');
                    }}><i className="bi bi-arrow-repeat me-2" aria-hidden="true" />Request resubmission</button>
                    <button type="button" className="btn btn-outline-danger" disabled={actionLoading} onClick={() => {
                      setDecisionError('');
                      setDecision('Rejected');
                    }}><i className="bi bi-x-lg me-2" aria-hidden="true" />Reject</button>
                  </div>
                ) : (
                  <form onSubmit={event => { event.preventDefault(); handleAction(decision); }}>
                    <fieldset disabled={actionLoading}>
                      <legend className="h6 mb-3">{decision === 'Rejected' ? 'Reject application' : 'Request resubmission'}</legend>
                      <label className="workspace-field mb-3">
                        <span>What needs correction?</span>
                        <select className="form-select" value={correctionDocument} onChange={event => setCorrectionDocument(event.target.value)}>
                          <option value="">General application details</option>
                          {verificationDocuments.map(doc => <option key={doc.type} value={doc.type}>{doc.label}</option>)}
                        </select>
                      </label>
                      <label className="workspace-field mb-2">
                        <span>Reason (required)</span>
                        <textarea ref={reasonInput} className="form-control" aria-required="true" aria-describedby="kyc-reason-hint"
                          rows="3" maxLength={1000} value={actionReason} onChange={event => {
                            setActionReason(event.target.value);
                            setDecisionError('');
                          }} />
                      </label>
                      <p id="kyc-reason-hint" className="text-muted small">Tell the business what needs to be corrected or replaced.</p>
                      <div className="kyc-review-actions">
                        <button type="submit" className={`btn ${decision === 'Rejected' ? 'btn-danger' : 'btn-primary'} px-4`}>
                          {actionLoading ? 'Saving…' : decision === 'Rejected' ? 'Confirm rejection' : 'Send request'}
                        </button>
                        <button type="button" className="btn btn-outline-secondary px-4" onClick={() => {
                          resetDecision();
                          document.getElementById('kyc-review-decision')?.focus({ preventScroll: true });
                        }}>Cancel</button>
                      </div>
                    </fieldset>
                  </form>
                )}
                {decisionError && <p className="text-danger small mt-3 mb-0" role="alert">{decisionError}</p>}
              </section>
            )}
            
            {/* If it's already in history, just show a read-only message or reason if rejected */}
            {(selectedKyc.kycStatus === 'Approved' || selectedKyc.kycStatus === 'Rejected') && (
              <div className="kyc-review-decision">
                <h3 className="portal-form-section-title">Review completed</h3>
                <p className="mb-0 text-muted">This KYC application was marked as <strong>{selectedKyc.kycStatus}</strong>.</p>
                {selectedKyc.kycDetails?.rejectionReason && (
                  <p className="mt-2 text-danger mb-0"><strong>Reason:</strong> {selectedKyc.kycDetails.rejectionReason}</p>
                )}
                {selectedKyc.kycDetails?.documentCorrections?.map(item => (
                  <p key={item.docType} className="mt-2 text-danger mb-0"><strong>{verificationDocuments.find(doc => doc.type === item.docType)?.label || item.docType}</strong> · {item.reason}</p>
                ))}
              </div>
            )}

          </div>
          {canDecide && (
            <div className="kyc-mobile-decision">
              <button type="button" className="btn btn-primary workspace-primary w-100" onClick={() => {
                const decision = document.getElementById('kyc-review-decision');
                decision?.scrollIntoView({ block: 'start' });
                decision?.focus({ preventScroll: true });
              }}>Review decision</button>
            </div>
          )}
        </article>
      )}
    </div>
  );
};

export default SuperAdminKyc;
