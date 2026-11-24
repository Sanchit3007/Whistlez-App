import React, { useState, useEffect, useRef, useCallback } from 'react';
import FilterToolbar from '../../components/FilterToolbar';
import { useSearchParams } from 'react-router-dom';
import FormDialog from '../../components/FormDialog';
import AdPlacementPreview from '../../components/AdPlacementPreview';
import UploadField from '../../components/UploadField';
import socket from '../../socket';
import { api } from '../../context/AuthContext';
import { countryData } from '../../utils/locationData';
import { AD_PLACEMENTS, businessMatchesAudience, campaignStatus, describeSchedule, findOverlappingAds } from '../../utils/adSchedule';

const SuperAdminAds = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [ads, setAds] = useState([]);
  const adsRequest = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE
  const [placementFilter, setPlacementFilter] = useState('ALL'); // ALL, HOME_1, HOME_2, etc.
  const [targetFilter, setTargetFilter] = useState('ALL'); // ALL, GLOBAL, REGIONAL

  // Unified modal state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null); // null = Create Mode, otherwise Edit Mode
  const [uploading, setUploading] = useState(false);
  const [readingBanner, setReadingBanner] = useState(false);
  const bannerSelection = useRef(0);

  // Form states
  const [adName, setAdName] = useState('');
  const [adUrl, setAdUrl] = useState('');
  const [adFile, setAdFile] = useState('');
  const [bannerName, setBannerName] = useState('');
  const [existingBanner, setExistingBanner] = useState('');
  const [bannerError, setBannerError] = useState('');
  const [adPositions, setAdPositions] = useState([]); // Selected placements IDs/Labels
  const [targetingType, setTargetingType] = useState('GLOBAL');
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [audienceData, setAudienceData] = useState(null);
  const [audienceRetry, setAudienceRetry] = useState(0);

  useEffect(() => {
    if (!showModal) return undefined;
    const request = new AbortController();
    setAudienceData(null);
    api.get('/superadmin/businesses', { signal: request.signal })
      .then(({ data }) => {
        if (!data.success || !Array.isArray(data.businesses)) throw new Error('Could not load the campaign audience.');
        if (!request.signal.aborted) setAudienceData({ businesses: data.businesses });
      })
      .catch(() => {
        if (!request.signal.aborted) setAudienceData({ error: true });
      });
    return () => request.abort();
  }, [showModal, audienceRetry]);

  // Location selector intermediate states
  const [selectedCountryCode, setSelectedCountryCode] = useState('');
  const [selectedStateCode, setSelectedStateCode] = useState('');
  const [selectedCityName, setSelectedCityName] = useState('');

  // Expandable regional targeting on cards
  const [expandedAdIds, setExpandedAdIds] = useState({});

  // Redundancy and logical normalization logic
  const isRedundant = (newLoc, existingLocs) => {
    for (const loc of existingLocs) {
      if (loc.targetingLevel === 'COUNTRY' && loc.countryCode === newLoc.countryCode) {
        return true;
      }
      if (loc.targetingLevel === 'STATE' && 
          loc.countryCode === newLoc.countryCode && 
          loc.stateCode === newLoc.stateCode) {
        return true;
      }
      if (loc.countryCode === newLoc.countryCode && 
          loc.stateCode === newLoc.stateCode && 
          loc.cityName === newLoc.cityName) {
        return true;
      }
    }
    return false;
  };

  const addAndNormalize = (newLoc, existingLocs) => {
    if (isRedundant(newLoc, existingLocs)) {
      return { success: false, message: 'This location is already covered by a broader target in your list!' };
    }

    let normalized = [...existingLocs];
    if (newLoc.targetingLevel === 'COUNTRY') {
      normalized = normalized.filter(loc => loc.countryCode !== newLoc.countryCode);
    } else if (newLoc.targetingLevel === 'STATE') {
      normalized = normalized.filter(loc => !(loc.countryCode === newLoc.countryCode && loc.stateCode === newLoc.stateCode));
    }

    normalized.push(newLoc);
    return { success: true, list: normalized };
  };

  const handleAddLocation = () => {
    if (!selectedCountryCode) {
      alert('Please select a country.');
      return;
    }

    const countryObj = countryData.find(c => c.code === selectedCountryCode);
    const countryName = countryObj ? countryObj.name : selectedCountryCode;

    let newLoc = {};

    if (!selectedStateCode || selectedStateCode === '') {
      // Entire Country
      newLoc = {
        countryCode: selectedCountryCode,
        countryName,
        targetingLevel: 'COUNTRY'
      };
    } else {
      const stateObj = countryObj.states.find(s => s.code === selectedStateCode);
      const stateName = stateObj ? stateObj.name : selectedStateCode;

      if (!selectedCityName || selectedCityName === '') {
        // Entire State
        newLoc = {
          countryCode: selectedCountryCode,
          countryName,
          stateCode: selectedStateCode,
          stateName,
          targetingLevel: 'STATE'
        };
      } else {
        // Specific City
        newLoc = {
          countryCode: selectedCountryCode,
          countryName,
          stateCode: selectedStateCode,
          stateName,
          cityName: selectedCityName,
          targetingLevel: 'CITY'
        };
      }
    }

    const res = addAndNormalize(newLoc, selectedLocations);
    if (!res.success) {
      alert(res.message);
    } else {
      setSelectedLocations(res.list);
      // Reset state & city but preserve country for faster multi-entry
      setSelectedStateCode('');
      setSelectedCityName('');
    }
  };

  const renderLocationLabel = (loc) => {
    if (loc.targetingLevel === 'COUNTRY') {
      return `${loc.countryName} (Entire)`;
    } else if (loc.targetingLevel === 'STATE') {
      return `${loc.stateName}, ${loc.countryName} (All)`;
    } else {
      return `${loc.cityName}, ${loc.stateName}, ${loc.countryName}`;
    }
  };

  const fetchAds = useCallback(async ({ background = false } = {}) => {
    adsRequest.current?.abort();
    const request = new AbortController();
    adsRequest.current = request;
    try {
      const res = await api.get('/superadmin/ads', { signal: request.signal });
      if (!request.signal.aborted && res.data.success) {
        setAds(res.data.ads);
      }
    } catch (err) {
      if (!request.signal.aborted && !background) {
        console.error('Error loading ads', err);
        setError('Could not fetch advertising campaigns.');
      }
    } finally {
      if (adsRequest.current === request) {
        adsRequest.current = null;
        if (!request.signal.aborted) setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAds();
    socket.emit('joinSuperAdmin');
    const handleUpdate = () => fetchAds();
    const refreshVisible = () => {
      if (!document.hidden && !adsRequest.current) fetchAds({ background: true });
    };
    const interval = window.setInterval(refreshVisible, 30000);
    document.addEventListener('visibilitychange', refreshVisible);
    socket.on('adsUpdated', handleUpdate);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshVisible);
      socket.off('adsUpdated', handleUpdate);
      adsRequest.current?.abort();
    };
  }, [fetchAds]);

  const handleImageUpload = (e) => {
    const input = e.currentTarget;
    const file = input.files[0];
    if (!file) return;

    const selection = ++bannerSelection.current;
    setReadingBanner(false);
    setBannerError('');
    setAdFile('');
    setBannerName('');

    if (file.size > 2 * 1024 * 1024 || !file.type.startsWith('image/')) {
      setBannerError('Choose a banner image up to 2 MB.');
      input.value = '';
      return;
    }

    setReadingBanner(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (selection !== bannerSelection.current) return;
      setAdFile(reader.result);
      setBannerName(file.name);
      setReadingBanner(false);
    };
    reader.onerror = () => {
      if (selection !== bannerSelection.current) return;
      setBannerError('Could not read this image. Choose another file.');
      setReadingBanner(false);
      input.value = '';
    };
    reader.readAsDataURL(file);
  };

  const closeCampaignForm = () => {
    bannerSelection.current += 1;
    setReadingBanner(false);
    setBannerError('');
    setError('');
    setShowModal(false);
  };

  const handleOpenCreateModal = () => {
    setEditId(null);
    setAdName('');
    setAdUrl('');
    setAdFile('');
    setBannerName('');
    setExistingBanner('');
    setAdPositions(['Home Page 1']); // Default selection
    setTargetingType('GLOBAL');
    setSelectedLocations([]);
    setStartDate('');
    setEndDate('');
    setSelectedCountryCode('');
    setSelectedStateCode('');
    setSelectedCityName('');
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleOpenEditModal = useCallback((ad) => {
    setEditId(ad._id);
    setAdName(ad.name);
    setAdUrl(ad.url);
    setAdFile(''); // Keep empty, user can optionally upload new image
    setBannerName('');
    setExistingBanner(ad.file || '');
    setAdPositions(ad.positions || (ad.position ? [ad.position] : []));
    setTargetingType(ad.targeting?.type || 'GLOBAL');
    setSelectedLocations(ad.targeting?.locations || []);
    setStartDate(ad.startDate || '');
    setEndDate(ad.endDate || '');
    setSelectedCountryCode('');
    setSelectedStateCode('');
    setSelectedCityName('');
    setError('');
    setSuccess('');
    setShowModal(true);
  }, []);

  useEffect(() => {
    const campaignId = searchParams.get('campaign');
    if (!campaignId || loading || showModal) return;
    const ad = ads.find(item => item._id === campaignId);
    if (ad) handleOpenEditModal(ad);
    const params = new URLSearchParams(searchParams);
    params.delete('campaign');
    setSearchParams(params, { replace: true });
  }, [ads, handleOpenEditModal, loading, searchParams, setSearchParams, showModal]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (uploading || readingBanner) return;
    if (!adName || !adUrl) {
      setError('Enter a campaign name and redirect URL.');
      return;
    }
    if (!editId && !adFile) {
      setError('Upload a banner image.');
      return;
    }
    if (adPositions.length === 0) {
      setError('Select at least one ad placement.');
      return;
    }
    if (targetingType === 'REGIONAL' && selectedLocations.length === 0) {
      setError('Add at least one location for regional targeting.');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setError('Choose an end date on or after the start date.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: adName,
        positions: adPositions,
        url: adUrl,
        startDate: startDate || null,
        endDate: endDate || null,
        targeting: {
          type: targetingType,
          locations: selectedLocations
        }
      };

      if (adFile) {
        payload.file = adFile;
      }

      let res;
      if (editId) {
        res = await api.put(`/superadmin/ads/${editId}`, payload);
      } else {
        res = await api.post('/superadmin/ads', payload);
      }

      if (res.data.success) {
        setSuccess(`Ad campaign "${adName}" ${editId ? 'updated' : 'launched'} successfully!`);
        setShowModal(false);
        fetchAds();
      }
    } catch (err) {
      console.error('Error saving campaign', err);
      setError(err.response?.data?.message || 'Failed to save advertising campaign.');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleAd = async (id, name) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.put(`/superadmin/ads/${id}/toggle`);
      if (res.data.success) {
        setSuccess(`Campaign "${name}" status updated.`);
        fetchAds();
      }
    } catch (err) {
      console.error('Error toggling ad status', err);
      setError('Failed to toggle status.');
    }
  };

  const handleDeleteAd = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete campaign "${name}"?`)) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.delete(`/superadmin/ads/${id}`);
      if (res.data.success) {
        setSuccess(`Campaign "${name}" has been deleted.`);
        fetchAds();
      }
    } catch (err) {
      console.error('Error deleting ad', err);
      setError('Failed to delete campaign.');
    }
  };

  const handleTogglePlacement = (placement) => {
    const matches = value => value === placement.id || value === placement.label;
    setAdPositions(current => current.some(matches)
      ? current.filter(value => !matches(value))
      : [...current, placement.label]);
  };

  const toggleExpandLocations = (adId) => {
    setExpandedAdIds(prev => ({
      ...prev,
      [adId]: !prev[adId]
    }));
  };

  // Intermediate helper for dynamic button text
  const getAddLocationButtonText = () => {
    if (!selectedCountryCode) return 'Location';
    const countryObj = countryData.find(c => c.code === selectedCountryCode);
    const countryName = countryObj ? countryObj.name : selectedCountryCode;

    if (!selectedStateCode) return `Entire ${countryName}`;
    const stateObj = countryObj.states.find(s => s.code === selectedStateCode);
    const stateName = stateObj ? stateObj.name : selectedStateCode;

    if (!selectedCityName) return `Entire ${stateName}`;
    return `${selectedCityName}`;
  };

  // Metrics calculations
  const today = new Date().toISOString().slice(0, 10);
  const invalidSchedule = Boolean(startDate && endDate && startDate > endDate);
  const matchingBusinesses = showModal ? (audienceData?.businesses || []).filter(business =>
    businessMatchesAudience(business, targetingType, selectedLocations)
  ) : [];
  const overlappingAds = showModal ? findOverlappingAds(ads, {
    _id: editId,
    positions: adPositions,
    startDate,
    endDate,
    targeting: { type: targetingType, locations: selectedLocations }
  }, today) : [];
  const totalAds = ads.length;
  const activeAds = ads.filter(ad => campaignStatus(ad, today) === 'Active').length;
  const totalViews = ads.reduce((sum, ad) => sum + (ad.views || 0), 0);
  const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
  const overallCTR = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0.0';

  // Filter lists in memory
  const filteredAds = ads.filter(ad => {
    // 1. Search text
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      if (!ad.name.toLowerCase().includes(query) && !ad.url.toLowerCase().includes(query)) {
        return false;
      }
    }

    // 2. Status
    if (statusFilter !== 'ALL' && campaignStatus(ad, today).toUpperCase() !== statusFilter) return false;

    // 3. Placement
    if (placementFilter !== 'ALL') {
      const matches = ad.positions.some(pos => {
        const pObj = AD_PLACEMENTS.find(p => p.id === placementFilter);
        return pObj && (pos === pObj.label || pos === pObj.id);
      });
      if (!matches) return false;
    }

    // 4. Target type
    if (targetFilter === 'GLOBAL' && ad.targeting?.type !== 'GLOBAL') return false;
    if (targetFilter === 'REGIONAL' && ad.targeting?.type !== 'REGIONAL') return false;

    return true;
  });

  // Country Selection Objects
  const countryObj = countryData.find(c => c.code === selectedCountryCode);
  const stateObj = countryObj?.states.find(s => s.code === selectedStateCode);

  return (
    <div className="animated-fade-in container-fluid px-0">
      
      {/* HEADER SECTION */}
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-4 gap-3">
        <div>
          <h1 className="fw-extrabold text-dark mb-1" style={{ fontSize: '1.75rem', letterSpacing: '-0.025em' }}>
            Advertisement Management
          </h1>
          <p className="text-muted small mb-0">Manage banner advertisements, placements and regional targeting.</p>
        </div>
        
        <button 
          className="btn btn-premium px-4 py-2 text-white bg-purple bg-gradient border-0 d-flex align-items-center gap-2 shadow-sm"
          style={{ backgroundColor: 'var(--action)', borderRadius: '10px', fontWeight: '600' }}
          onClick={handleOpenCreateModal}
        >
          <i className="bi bi-plus-circle-fill"></i>
          <span>Create Advertisement</span>
        </button>
      </div>

      {/* METRICS CARDS SECTION */}
      <div className="row g-3 mb-4">
        {/* Total Ads Card */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 bg-white shadow-sm p-4 rounded-4 h-100 position-relative overflow-hidden border-start border-primary border-4">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ letterSpacing: '0.04em', fontSize: '0.72rem' }}>Total Ads</span>
                <h2 className="fw-medium text-dark mb-0 font-monospace">{totalAds}</h2>
              </div>
              <div className="stat-widget-icon stat-widget-blue" aria-hidden="true">
                <i className="bi bi-megaphone" />
              </div>
            </div>
          </div>
        </div>

        {/* Active Ads Card */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 bg-white shadow-sm p-4 rounded-4 h-100 position-relative overflow-hidden border-start border-success border-4">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ letterSpacing: '0.04em', fontSize: '0.72rem' }}>Active Ads</span>
                <h2 className="fw-medium text-success mb-0 font-monospace">{activeAds}</h2>
              </div>
              <div className="stat-widget-icon stat-widget-green" aria-hidden="true">
                <i className="bi bi-broadcast" />
              </div>
            </div>
          </div>
        </div>

        {/* Total Views Card */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 bg-white shadow-sm p-4 rounded-4 h-100 position-relative overflow-hidden border-start border-info border-4">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ letterSpacing: '0.04em', fontSize: '0.72rem' }}>Total Views</span>
                <h2 className="fw-medium text-dark mb-0 font-monospace">{totalViews.toLocaleString()}</h2>
              </div>
              <div className="stat-widget-icon bg-info bg-opacity-10 text-info" aria-hidden="true">
                <i className="bi bi-eye" />
              </div>
            </div>
          </div>
        </div>

        {/* Total Clicks & CTR Card */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 bg-white shadow-sm p-4 rounded-4 h-100 position-relative overflow-hidden border-start border-purple border-4" style={{ borderLeftColor: 'var(--accent)' }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ letterSpacing: '0.04em', fontSize: '0.72rem' }}>Clicks & CTR</span>
                <h2 className="fw-medium text-purple mb-0 font-monospace" style={{ color: 'var(--accent)' }}>
                  {totalClicks.toLocaleString()} <span className="text-muted fw-normal" style={{ fontSize: '0.95rem' }}>({overallCTR}%)</span>
                </h2>
              </div>
              <div className="stat-widget-icon stat-widget-purple" aria-hidden="true">
                <i className="bi bi-cursor" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ALERTS */}
      {success && (
        <div className="alert alert-success border-0 rounded-3 small mb-4 py-3 shadow-sm d-flex align-items-center animate-fade-in" role="alert">
          <i className="bi bi-check-circle-fill me-2 fs-5 text-success"></i>
          <span className="fw-semibold text-dark">{success}</span>
          <button type="button" className="btn-close ms-auto small py-1" onClick={() => setSuccess('')}></button>
        </div>
      )}

      {error && !showModal && (
        <div className="alert alert-danger border-0 rounded-3 small mb-4 py-3 shadow-sm d-flex align-items-center animate-fade-in" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2 fs-5 text-danger"></i>
          <span className="fw-semibold text-dark">{error}</span>
          <button type="button" className="btn-close ms-auto small py-1" onClick={() => setError('')}></button>
        </div>
      )}

      {/* TOOLBAR FILTERS SECTION */}
      <div className="card border-0 bg-white shadow-sm rounded-4 p-3 mb-4">
        <FilterToolbar columns={3} searchField={
            <label className="workspace-field">
              <span>Search campaigns</span>
              <input type="search" className="form-control" placeholder="Campaign name or URL" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </label>
        }>

          <label className="workspace-field">
            <span>Status</span>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="PAUSED">Paused</option>
              <option value="ENDED">Ended</option>
            </select>
          </label>

          <label className="workspace-field">
            <span>Placement</span>
            <select
              className="form-select"
              value={placementFilter}
              onChange={(e) => setPlacementFilter(e.target.value)}
            >
              <option value="ALL">All Placements</option>
              {AD_PLACEMENTS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>

          <label className="workspace-field">
            <span>Targeting</span>
            <select
              className="form-select"
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
            >
              <option value="ALL">All Targets</option>
              <option value="GLOBAL">Global Only</option>
              <option value="REGIONAL">Regional Only</option>
            </select>
          </label>
        </FilterToolbar>
      </div>

      {/* ADVERTISEMENT LIST (GRID LAYOUT) */}
      <div className="row g-4">
        {loading ? (
          <div className="col-12 text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        ) : filteredAds.length > 0 ? (
          filteredAds.map((ad) => {
            const hasRegionalLocations = ad.targeting?.type === 'REGIONAL' && ad.targeting.locations?.length > 0;
            const isExpanded = !!expandedAdIds[ad._id];
            const status = campaignStatus(ad, today);
            
            return (
              <div className="col-12 col-md-6 col-xl-4" key={ad._id}>
                <div className="card border-0 bg-white shadow-sm rounded-4 overflow-hidden h-100 d-flex flex-column justify-content-between card-hover transition-all">
                  <div>
                    {/* Image Banner Container */}
                    <div style={{ height: '165px', position: 'relative', overflow: 'hidden' }}>
                      <div 
                        className="w-100 h-100"
                        style={{
                          backgroundImage: `url(${ad.file})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundColor: '#eaeaea'
                        }}
                      ></div>
                      
                      {/* Active/Inactive badge absolute */}
                      <span className={`badge rounded-pill position-absolute top-0 end-0 m-3 shadow-sm px-2 py-1 fw-bold ${status === 'Active' ? 'bg-success text-white' : 'bg-secondary text-white'}`}>
                        {status}
                      </span>
                    </div>
                    
                    {/* Content Body */}
                    <div className="p-4">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h5 className="fw-bold text-dark mb-1 text-truncate" style={{ maxWidth: '270px' }} title={ad.name}>
                            {ad.name}
                          </h5>
                          {(ad.startDate || ad.endDate) && <p className="small text-muted mb-1">{describeSchedule(ad)} (UTC)</p>}
                          <a 
                            href={ad.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-primary small text-decoration-none d-inline-flex align-items-center gap-2 text-truncate"
                            style={{ fontSize: '0.78rem', fontWeight: '500' }}
                          >
                            <i className="bi bi-box-arrow-up-right small"></i>
                            {ad.url}
                          </a>
                        </div>
                      </div>

                      {/* Display Placements */}
                      <div className="mb-3 mt-3">
                        <span className="text-muted d-block small fw-bold mb-1.5" style={{ fontSize: '0.7rem', letterSpacing: '0.02em' }}>Placements:</span>
                        <div className="d-flex flex-wrap gap-2">
                          {ad.positions && ad.positions.map((pos, i) => (
                            <span key={i} className="badge bg-light text-dark border px-2 py-1 rounded-3 fw-semibold" style={{ fontSize: '0.68rem' }}>
                              {pos}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Target Audience Display */}
                      <div className="mb-3 py-3 border-top border-bottom">
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="text-muted small fw-bold" style={{ fontSize: '0.7rem' }}>Target Audience:</span>
                          {ad.targeting?.type === 'GLOBAL' ? (
                            <span className="badge bg-success-subtle text-success px-2 py-1 text-uppercase fw-bold" style={{ fontSize: '0.62rem' }}>Global</span>
                          ) : (
                            <span className="badge bg-info-subtle text-primary px-2 py-1 text-uppercase fw-bold" style={{ fontSize: '0.62rem' }}>Regional</span>
                          )}
                        </div>

                        {/* Interactive locations rendering */}
                        {hasRegionalLocations && (
                          <div className="mt-2 p-2 bg-light rounded-3">
                            <div className="d-flex align-items-center justify-content-between">
                              <span className="small text-dark fw-bold text-truncate" style={{ maxWidth: '210px', fontSize: '0.72rem' }}>
                                <i className="bi bi-geo-alt-fill text-danger me-1"></i>
                                {renderLocationLabel(ad.targeting.locations[0])}
                                {ad.targeting.locations.length > 1 && ` (+${ad.targeting.locations.length - 1} more)`}
                              </span>
                              <button 
                                className="btn btn-link btn-sm p-0 text-primary small text-decoration-none border-0 fw-bold"
                                style={{ fontSize: '0.72rem' }}
                                onClick={() => toggleExpandLocations(ad._id)}
                              >
                                {isExpanded ? 'Hide' : 'Expand'}
                              </button>
                            </div>

                            {/* Expanded list of locations */}
                            {isExpanded && (
                              <div className="mt-2 pt-2 border-top d-flex flex-wrap gap-1" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                                {ad.targeting.locations.map((loc, idx) => (
                                  <span key={idx} className="badge bg-white text-dark border px-2 py-1 rounded-2" style={{ fontSize: '0.65rem', fontWeight: '500' }}>
                                    {renderLocationLabel(loc)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Views/Clicks metrics row */}
                      <div className="row g-2 text-center text-muted bg-light rounded-3 py-2 px-1 mt-3" style={{ fontSize: '0.75rem' }}>
                        <div className="col-4 border-end">
                          <span className="d-block text-uppercase fw-bold mb-0.5 text-muted" style={{ fontSize: '0.6rem', letterSpacing: '0.04em' }}>Views</span>
                          <strong className="text-dark fs-6 font-monospace">{ad.views}</strong>
                        </div>
                        <div className="col-4 border-end">
                          <span className="d-block text-uppercase fw-bold mb-0.5 text-muted" style={{ fontSize: '0.6rem', letterSpacing: '0.04em' }}>Clicks</span>
                          <strong className="text-dark fs-6 font-monospace">{ad.clicks}</strong>
                        </div>
                        <div className="col-4">
                          <span className="d-block text-uppercase fw-bold mb-0.5 text-muted" style={{ fontSize: '0.6rem', letterSpacing: '0.04em' }}>CTR Ratio</span>
                          <strong className="text-purple fs-6 font-monospace" style={{ color: 'var(--accent)' }}>
                            {ad.views > 0 ? ((ad.clicks / ad.views) * 100).toFixed(1) : 0}%
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-3 bg-light border-top d-flex align-items-center justify-content-between">
                    {/* Status switch toggle */}
                    <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                      <input 
                        className="form-check-input" 
                        type="checkbox"
                        id={`switch-${ad._id}`}
                        style={{ cursor: 'pointer' }}
                        checked={ad.isActive} 
                        onChange={() => handleToggleAd(ad._id, ad.name)}
                      />
                      <label className="form-check-label text-dark small fw-bold cursor-pointer" htmlFor={`switch-${ad._id}`}>
                        Enabled
                      </label>
                    </div>

                    {/* Edit/Delete actions */}
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-outline-primary btn-sm rounded-pill px-3 py-1 fw-bold d-flex align-items-center gap-2 text-purple border-purple"
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: '0.72rem' }}
                        onClick={() => handleOpenEditModal(ad)}
                      >
                        <i className="bi bi-pencil-square"></i>
                        <span>Edit</span>
                      </button>
                      <button 
                        className="btn btn-outline-danger btn-sm rounded-pill px-3 py-1 fw-bold d-flex align-items-center gap-2"
                        style={{ fontSize: '0.72rem' }}
                        onClick={() => handleDeleteAd(ad._id, ad.name)}
                      >
                        <i className="bi bi-trash"></i>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-12 text-center py-5 text-muted bg-white rounded-4 border shadow-sm">
            <i className="bi bi- megaphone fs-1 text-muted opacity-50 d-block mb-2"></i>
            <span>No advertising campaigns match the selected filters.</span>
          </div>
        )}
      </div>

      {/* FIXED STRUCTURE: SCROLLABLE MODAL CARD */}
      {showModal && (
        <FormDialog labelledBy="ad-campaign-title" wide fullScreenOnMobile busy={uploading} onClose={closeCampaignForm}>
          <form onSubmit={handleFormSubmit} className="modal-content">

            {/* Modal Header */}
            <div className="modal-header border-0 pb-2">
              <div>
                <h2 id="ad-campaign-title" className="modal-title h5 fw-extrabold text-dark" style={{ fontSize: '1.3rem', letterSpacing: '-0.02em' }}>
                  {editId ? 'Edit Ad Campaign' : 'Create Advertisement'}
                </h2>
                <p className="text-muted small mb-0 mt-0.5">
                  {editId ? 'Modify campaign parameters, positions, and locations.' : 'Launch a new banner campaign across multiple placements.'}
                </p>
              </div>
              <button type="button" className="btn-close" aria-label="Close form" disabled={uploading} onClick={closeCampaignForm}></button>
            </div>

            {/* Modal Body split columns */}
            <div className="modal-body py-2">
              <div className="row g-4">
                {/* LEFT COLUMN: Basic Info & Placement */}
                <div className="col-12 col-md-6 campaign-form-details pe-md-4">

                  {/* SECTION 1: BASIC INFORMATION */}
                  <div className="mb-4">
                    <h3 className="portal-form-section-title"><i className="bi bi-image portal-form-icon" aria-hidden="true" /> Creative</h3>

                    {/* Campaign Name */}
                    <div className="mb-3">
                      <label htmlFor="campaign-campaign-name" className="form-label small fw-bold text-muted mb-1">Campaign Name</label>
                      <input id="campaign-campaign-name" 
                        type="text" 
                        className="form-control form-control-custom bg-light border-0 py-2 small fw-semibold"
                        placeholder="e.g. Summer Haircut Promotion"
                        value={adName}
                        onChange={(e) => setAdName(e.target.value)}
                        required
                      />
                    </div>

                    {/* Redirect Landing URL */}
                    <div className="mb-3">
                      <label htmlFor="campaign-redirect-landing-url" className="form-label small fw-bold text-muted mb-1">Redirect Landing URL</label>
                      <input id="campaign-redirect-landing-url" 
                        type="url" 
                        className="form-control form-control-custom bg-light border-0 py-2 small fw-semibold"
                        placeholder="https://salon-promotions.com/summer"
                        value={adUrl}
                        onChange={(e) => setAdUrl(e.target.value)}
                        required
                      />
                    </div>

                    <div className="campaign-creative">
                      <UploadField
                        id="campaign-banner-image"
                        icon="cloud-arrow-up"
                        label="Banner image"
                        action={adFile || existingBanner ? 'Replace banner' : 'Choose banner'}
                        hint="Image file, up to 2 MB"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                        required={!editId && !adFile}
                        errorId={bannerError ? 'campaign-banner-error' : undefined}
                      />
                      <div className="campaign-banner-preview">
                        {adFile || existingBanner ? (
                          <figure className="mb-0">
                            <img src={adFile || existingBanner} alt="Campaign banner preview" />
                            <figcaption>{bannerName || 'Current banner'}</figcaption>
                          </figure>
                        ) : <span>Banner preview</span>}
                      </div>
                    </div>
                    {readingBanner && <p className="small mt-2 mb-0" role="status">Reading banner…</p>}
                    {bannerError && <p id="campaign-banner-error" className="small text-danger mt-2 mb-0" role="alert">{bannerError}</p>}
                  </div>

                </div>
                <div className="col-12 col-md-6 ps-md-4">
                  <h3 className="portal-form-section-title"><i className="bi bi-geo-alt portal-form-icon" aria-hidden="true" /> Placement and audience</h3>
                  <div className="mb-3">
                    <h4 className="h6 mb-2">Ad placements</h4>

                    <div className="row g-2" role="group" aria-label="Ad placements">
                      {AD_PLACEMENTS.map((placement) => {
                        const isChecked = adPositions.includes(placement.label) || adPositions.includes(placement.id);
                        return (
                          <div className="col-6" key={placement.id}>
                            <button
                              type="button"
                              aria-pressed={isChecked}
                              className="campaign-choice d-flex align-items-center justify-content-between gap-2 text-start"
                              onClick={() => handleTogglePlacement(placement)}
                            >
                              <span className="small fw-bold text-dark">{placement.label}</span>
                              <span
                                aria-hidden="true"
                                className="rounded-circle d-flex flex-shrink-0 align-items-center justify-content-center border"
                                style={{ 
                                  width: '20px', 
                                  height: '20px', 
                                  backgroundColor: isChecked ? 'var(--accent)' : 'transparent',
                                  borderColor: isChecked ? 'var(--accent)' : '#dee2e6'
                                }}
                              >
                                {isChecked && <i className="bi bi-check text-white" style={{ fontSize: '0.9rem' }}></i>}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3">
                      <span className="badge bg-purple-subtle text-purple px-3 py-1 rounded-pill small" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.72rem' }}>
                        {adPositions.length} placement{adPositions.length !== 1 ? 's' : ''} selected
                      </span>
                    </div>
                  </div>

                  <h4 className="h6 mb-2">Target audience</h4>

                  {/* Large Radio Selection Cards */}
                  <div className="row g-2 mb-3" role="group" aria-label="Target audience">
                    {/* Global Radio Card */}
                    <div className="col-6">
                      <button
                        type="button"
                        aria-pressed={targetingType === 'GLOBAL'}
                        className="campaign-choice text-center h-100 d-flex flex-column justify-content-center align-items-center"
                        onClick={() => setTargetingType('GLOBAL')}
                      >
                        <span className="d-flex flex-wrap align-items-center justify-content-center gap-2 mb-1">
                          <i className={`bi bi-globe fs-5 ${targetingType === 'GLOBAL' ? 'text-purple' : 'text-muted'}`} style={{ color: targetingType === 'GLOBAL' ? 'var(--accent)' : 'inherit' }}></i>
                          <span className="small fw-bold text-dark">Global</span>
                        </span>
                        <span className="text-muted d-block" style={{ fontSize: '0.68rem' }}>Show advertisement everywhere</span>
                      </button>
                    </div>

                    {/* Specific Locations Radio Card */}
                    <div className="col-6">
                      <button
                        type="button"
                        aria-pressed={targetingType === 'REGIONAL'}
                        className="campaign-choice text-center h-100 d-flex flex-column justify-content-center align-items-center"
                        onClick={() => setTargetingType('REGIONAL')}
                      >
                        <span className="d-flex flex-wrap align-items-center justify-content-center gap-2 mb-1">
                          <i className={`bi bi-geo-alt-fill fs-5 ${targetingType === 'REGIONAL' ? 'text-purple' : 'text-muted'}`} style={{ color: targetingType === 'REGIONAL' ? 'var(--accent)' : 'inherit' }}></i>
                          <span className="small fw-bold text-dark">Specific locations</span>
                        </span>
                        <span className="text-muted d-block" style={{ fontSize: '0.68rem' }}>Target specific countries/regions</span>
                      </button>
                    </div>
                  </div>

                  {/* Geographic Selectors Hierarchy */}
                  {targetingType === 'REGIONAL' && (
                    <div className="bg-light p-3 rounded-4 border mb-2 animate-fade-in">

                      {/* selectors dropdowns */}
                      <div className="row g-2 mb-2">
                        {/* Country Selector */}
                        <div className="col-12">
                          <label htmlFor="campaign-country" className="form-label small text-muted fw-bold mb-1" style={{ fontSize: '0.68rem' }}>Country</label>
                          <select id="campaign-country" 
                            className="form-select form-select-sm border-0 shadow-sm py-2"
                            value={selectedCountryCode}
                            onChange={(e) => {
                              setSelectedCountryCode(e.target.value);
                              setSelectedStateCode('');
                              setSelectedCityName('');
                            }}
                          >
                            <option value="">-- Select Country --</option>
                            {countryData.map(c => (
                              <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* State Selector */}
                        <div className="col-6">
                          <label htmlFor="campaign-state-province" className="form-label small text-muted fw-bold mb-1" style={{ fontSize: '0.68rem' }}>State / Province</label>
                          <select id="campaign-state-province" 
                            className="form-select form-select-sm border-0 shadow-sm py-2"
                            disabled={!selectedCountryCode}
                            value={selectedStateCode}
                            onChange={(e) => {
                              setSelectedStateCode(e.target.value);
                              setSelectedCityName('');
                            }}
                          >
                            <option value="">[ All States / Entire Country ]</option>
                            {countryObj?.states?.map(s => (
                              <option key={s.code} value={s.code}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* City Selector */}
                        <div className="col-6">
                          <label htmlFor="campaign-city" className="form-label small text-muted fw-bold mb-1" style={{ fontSize: '0.68rem' }}>City</label>
                          <select id="campaign-city" 
                            className="form-select form-select-sm border-0 shadow-sm py-2"
                            disabled={!selectedStateCode || selectedStateCode === ''}
                            value={selectedCityName}
                            onChange={(e) => setSelectedCityName(e.target.value)}
                          >
                            <option value="">[ All Cities / Entire State ]</option>
                            {stateObj?.cities?.map(city => (
                              <option key={city} value={city}>{city}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Add button */}
                      <button 
                        type="button" 
                        className="btn btn-sm btn-purple w-100 py-2 text-white border-0 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm" 
                        style={{ backgroundColor: 'var(--action)', borderRadius: '8px', fontSize: '0.75rem' }}
                        onClick={handleAddLocation}
                        disabled={!selectedCountryCode}
                      >
                        <i className="bi bi-plus-lg"></i>
                        <span>Add {getAddLocationButtonText()}</span>
                      </button>

                      {/* Header of selected chips */}
                      <div className="mt-3 border-top pt-2 d-flex align-items-center justify-content-between">
                        <span className="small text-dark fw-bold" style={{ fontSize: '0.75rem' }}>
                          Targeted Areas ({selectedLocations.length})
                        </span>
                        {selectedLocations.length > 0 && (
                          <button 
                            type="button" 
                            className="btn btn-link btn-sm text-danger p-0 text-decoration-none border-0 fw-bold"
                            style={{ fontSize: '0.72rem' }}
                            onClick={() => setSelectedLocations([])}
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      {/* Chips Container */}
                      <div className="mt-2 d-flex flex-wrap gap-2 overflow-auto" style={{ maxHeight: '115px' }}>
                        {selectedLocations.length > 0 ? (
                          selectedLocations.map((loc, idx) => (
                            <span 
                              key={idx} 
                              className="d-inline-flex align-items-center gap-2 px-3 py-1 border animate-fade-in" 
                              style={{ 
                                fontSize: '0.72rem', 
                                backgroundColor: 'var(--accent-soft)', 
                                color: 'var(--accent)',
                                borderColor: '#dcd0ff',
                                borderRadius: '20px', 
                                fontWeight: '600' 
                              }}
                            >
                              <span>{renderLocationLabel(loc)}</span>
                              <button
                                type="button"
                                className="campaign-location-remove"
                                aria-label={`Remove ${renderLocationLabel(loc)}`}
                                onClick={() => setSelectedLocations(selectedLocations.filter((_, i) => i !== idx))}
                              ><i className="bi bi-x-lg" aria-hidden="true"></i></button>
                            </span>
                          ))
                        ) : (
                          <span className="text-muted small italic" style={{ fontSize: '0.7rem' }}>
                            No specific target locations assigned yet. Select parameters and click add.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <AdPlacementPreview image={adFile || existingBanner} positions={adPositions} />
              <section className="portal-form-summary mt-4" aria-labelledby="campaign-review-title">
                <h3 id="campaign-review-title" className="portal-form-section-title"><i className="bi bi-calendar-week portal-form-icon" aria-hidden="true" /> Schedule preview</h3>
                <div className="workspace-filters mb-2">
                  <label className="workspace-field">
                    <span>Start date (optional)</span>
                    <input className="form-control" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
                  </label>
                  <label className="workspace-field">
                    <span>End date (optional)</span>
                    <input className="form-control" type="date" min={startDate || undefined} value={endDate}
                      aria-invalid={invalidSchedule} onChange={event => setEndDate(event.target.value)} />
                  </label>
                </div>
                <p className="small text-muted mb-2">Dates use UTC. Ads can run through the end of the selected end date.</p>
                {invalidSchedule && <p className="small text-danger" role="alert">Choose an end date on or after the start date.</p>}
                <dl className="campaign-review">
                  <div>
                    <dt>Schedule</dt>
                    <dd>{describeSchedule({ startDate, endDate })}</dd>
                  </div>
                  <div>
                    <dt>Placements</dt>
                    <dd>{adPositions.map(position => AD_PLACEMENTS.find(option => option.id === position)?.label || position).join(', ') || 'Choose a placement'}</dd>
                  </div>
                  <div>
                    <dt>Audience</dt>
                    <dd>{targetingType === 'GLOBAL' ? 'Global' : selectedLocations.map(renderLocationLabel).join(' · ') || 'Add a location'}</dd>
                  </div>
                  <div>
                    <dt>Destination</dt>
                    <dd>{adUrl.trim() || 'Enter a destination URL'}</dd>
                  </div>
                </dl>
                <div className="mt-3">
                  {!audienceData && <p className="small text-muted mb-0" role="status">Loading matching businesses…</p>}
                  {audienceData?.error && (
                    <p className="small text-warning mb-0">Could not load matching businesses. <button type="button"
                      className="btn btn-sm btn-outline-secondary" onClick={() => setAudienceRetry(value => value + 1)}>Retry</button></p>
                  )}
                  {audienceData?.businesses && (
                    <details>
                      <summary>{matchingBusinesses.length} matching {matchingBusinesses.length === 1 ? 'business' : 'businesses'}</summary>
                      {matchingBusinesses.length ? <ul className="small text-muted mt-2 mb-0">
                        {matchingBusinesses.map(business => <li key={business._id}>{business.name}</li>)}
                      </ul> : <p className="small text-muted mt-2 mb-0">No registered businesses match this audience.</p>}
                    </details>
                  )}
                </div>
                {overlappingAds.length > 0 && (
                  <div className="alert alert-warning p-2 mt-3 mb-0" role="status">
                    <strong>Overlapping campaigns</strong>
                    <p className="small mb-0">These enabled campaigns share a placement, target area, and date range.</p>
                    <ul className="small mb-0">{overlappingAds.map(ad => <li key={ad._id}>{ad.name}</li>)}</ul>
                  </div>
                )}
              </section>

            </div>

            {/* Modal Footer Actions */}
            <div className="modal-footer border-0 pt-2 d-flex gap-2 justify-content-end">
              {error && <p className="small text-danger w-100 mb-0" role="alert">{error}</p>}
              <button 
                type="button" 
                className="btn btn-outline-secondary py-2 rounded-3 fw-bold small px-4" 
                onClick={closeCampaignForm}
                disabled={uploading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary py-2 rounded-3 fw-bold bg-purple border-0 small px-5" 
                style={{ backgroundColor: 'var(--action)' }} 
                disabled={uploading || readingBanner || invalidSchedule}
              >
                {uploading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1.5" role="status" aria-hidden="true"></span>
                    <span>Saving...</span>
                  </>
                ) : editId ? 'Save Changes' : 'Create Advertisement'}
              </button>
            </div>
          </form>
        </FormDialog>
      )}
    </div>
  );
};

export default SuperAdminAds;
