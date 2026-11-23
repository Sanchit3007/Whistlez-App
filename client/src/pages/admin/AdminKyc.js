import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../context/AuthContext';
import UploadField from '../../components/UploadField';
import { verificationDocuments } from '../../utils/businessStatus';

const AdminKyc = () => {
  const { hash } = useLocation();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [fileFeedback, setFileFeedback] = useState({});
  const fileReaders = useRef({});
  const readingDocument = Object.values(fileFeedback).some(file => file.reading);
  
  const [formData, setFormData] = useState({
    phoneNumber: '',
    emailAddress: '',
    canNumber: '',
    gstNumber: '',
    panNumber: '',
    registrationNumber: '',
    legalName: '',
    aadhaarOrId: '',
    documents: []
  });

  useEffect(() => {
    const controller = new AbortController();
    const fetchBusiness = async () => {
      try {
        const res = await api.get('/admin/business', { signal: controller.signal });
        if (res.data.success) {
          const biz = res.data.business;
          setBusiness(biz);
          if (biz.kycDetails) {
            setFormData(previous => ({
              ...previous,
              ...biz.kycDetails,
              registrationNumber: biz.kycDetails.companyDetails?.registrationNumber || '',
              legalName: biz.kycDetails.companyDetails?.legalName || '',
              aadhaarOrId: biz.kycDetails.individualDetails?.aadhaarOrId || ''
            }));
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error('Error fetching business:', error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchBusiness();
    return () => controller.abort();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e, docType) => {
    const input = e.currentTarget;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    fileReaders.current[docType] = reader;
    setFileFeedback(previous => ({ ...previous, [docType]: { reading: true } }));
    reader.onload = () => {
      if (fileReaders.current[docType] !== reader) return;
      setFormData(previous => ({
        ...previous,
        documents: [
          ...(previous.documents || []).filter(document => document.docType !== docType),
          { docType, fileBase64: reader.result }
        ]
      }));
      setFileFeedback(previous => ({ ...previous, [docType]: { name: file.name } }));
    };
    reader.onerror = () => {
      if (fileReaders.current[docType] !== reader) return;
      input.value = '';
      setFileFeedback(previous => ({ ...previous, [docType]: { error: 'Could not read this document. Choose the file again.' } }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLoading || readingDocument) return;
    setSubmitLoading(true);
    setMessage('');
    setSubmitError('');
    try {
      const res = await api.post('/admin/business/kyc', formData);
      if (res.data.success) {
        setMessage('KYC Details submitted successfully!');
        setBusiness(res.data.business);
      }
    } catch (error) {
      setSubmitError(error.response?.data?.message || 'Could not submit verification. Try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && verificationDocuments.some(doc => '#' + doc.id === hash)) {
      document.getElementById(hash.slice(1))?.focus();
    }
  }, [hash, loading]);

  if (loading) return <div>Loading...</div>;

  const isReadOnly = business?.kycStatus === 'Submitted' || business?.kycStatus === 'Under Review' || business?.kycStatus === 'Approved';

  return (
    <div className="container-fluid">
      <h3 className="fw-bold mb-4">KYC & Organization Verification</h3>
      
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body p-3 p-md-4">
          <div className="d-flex align-items-center mb-4">
            <h5 className="mb-0 me-3">Verification status</h5>
            <span className={`badge ${business?.kycStatus === 'Approved' ? 'bg-success' : (business?.kycStatus === 'Rejected' || business?.kycStatus === 'Resubmission Required' ? 'bg-danger' : 'bg-warning')} px-3 py-2 fs-6`}>
              {business?.kycStatus || 'Pending'}
            </span>
          </div>
          
          {business?.kycDetails?.rejectionReason && (
            <div className="alert alert-danger">
              <strong>Rejection Reason:</strong> {business.kycDetails.rejectionReason}
            </div>
          )}

          {message && <div className="alert alert-info" role="status">{message}</div>}

          <form onSubmit={handleSubmit}>
            <h2 className="portal-form-section-title"><i className="bi bi-building portal-form-icon" aria-hidden="true" /> Business details</h2>
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="verification-phone-number" className="form-label text-muted">Phone number (required)</label>
                <input id="verification-phone-number" type="tel" autoComplete="tel" className="form-control" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} disabled={isReadOnly} required />
              </div>
              <div className="col-md-6">
                <label htmlFor="verification-email-address" className="form-label text-muted">Email address (required)</label>
                <input id="verification-email-address" type="email" className="form-control" name="emailAddress" value={formData.emailAddress} onChange={handleInputChange} disabled={isReadOnly} required />
              </div>
              <div className="col-md-6">
                <label htmlFor="verification-gst-number" className="form-label text-muted">GST Number</label>
                <input id="verification-gst-number" type="text" className="form-control" name="gstNumber" value={formData.gstNumber} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
              <div className="col-md-6">
                <label htmlFor="verification-pan-number" className="form-label text-muted">PAN number (required)</label>
                <input id="verification-pan-number" type="text" className="form-control" name="panNumber" value={formData.panNumber} onChange={handleInputChange} disabled={isReadOnly} required />
              </div>
              
              {business?.businessType === 'Company' ? (
                <>
                  <div className="col-md-6">
                    <label htmlFor="verification-legal-company-name" className="form-label text-muted">Legal Company Name</label>
                    <input id="verification-legal-company-name" type="text" className="form-control" name="legalName" value={formData.legalName} onChange={handleInputChange} disabled={isReadOnly} />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="verification-registration-can-number" className="form-label text-muted">Registration / CAN Number</label>
                    <input id="verification-registration-can-number" type="text" className="form-control" name="registrationNumber" value={formData.registrationNumber} onChange={handleInputChange} disabled={isReadOnly} />
                  </div>
                </>
              ) : (
                <div className="col-md-6">
                  <label htmlFor="verification-aadhaar-national-id" className="form-label text-muted">Aadhaar / National ID</label>
                  <input id="verification-aadhaar-national-id" type="text" className="form-control" name="aadhaarOrId" value={formData.aadhaarOrId} onChange={handleInputChange} disabled={isReadOnly} />
                </div>
              )}
            </div>

            <h2 className="portal-form-section-title mt-4"><i className="bi bi-file-earmark-text portal-form-icon" aria-hidden="true" /> Documents</h2>
            <div className="row g-3">
              {verificationDocuments.map(({ type, id, label }) => {
                const attached = formData.documents?.find(document => document.docType === type);
                const feedback = fileFeedback[type];
                const correction = business?.kycDetails?.documentCorrections?.find(item => item.docType === type);
                let status = 'No file uploaded';
                if (isReadOnly && attached) status = 'Uploaded';
                else if (feedback?.reading) status = 'Reading file…';
                else if (attached?.fileBase64) status = feedback?.name || 'Ready to submit';
                else if (correction) status = 'Replacement required';
                else if (attached) status = 'Previously uploaded';

                return (
                  <div className="col-md-6" key={type}>
                    {isReadOnly ? (
                      <div className="portal-verification-document">
                        <strong>{label}</strong>
                        <p className="portal-file-detail mb-0">{status}</p>
                      </div>
                    ) : (
                      <>
                        <UploadField id={id} label={label} icon="file-earmark-text" action={attached || correction ? 'Replace file' : 'Choose file'} hint={correction ? correction.reason : 'Image or PDF'} accept="image/*,.pdf" onChange={event => handleFileChange(event, type)} disabled={submitLoading} required={Boolean(correction && !attached?.fileBase64)} errorId={feedback?.error ? `${id}-error` : undefined} />
                        <p className="portal-file-detail mt-2 mb-0" role="status">{status}</p>
                        {feedback?.error && <p id={`${id}-error`} className="small text-danger mb-0" role="alert">{feedback.error}</p>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {!isReadOnly && (
              <div className="portal-form-actions portal-verification-actions mt-4">
                {submitError && <p className="small text-danger w-100 mb-0" role="alert">{submitError}</p>}
                <button type="submit" className="btn btn-primary px-4" disabled={submitLoading || readingDocument}>
                  {submitLoading ? 'Submitting...' : 'Submit KYC'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminKyc;
