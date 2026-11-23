import React, { useState } from 'react';
import { AD_PLACEMENTS } from '../utils/adSchedule';

const previewRatios = { HOME_1: '16 / 9', HOME_2: '4 / 3', SIDEBAR: '3 / 4', FOOTER: '4 / 1' };

const AdPlacementPreview = ({ image, positions }) => {
  const [chosen, setChosen] = useState('');
  const placements = AD_PLACEMENTS.filter(placement => positions.includes(placement.id) || positions.includes(placement.label));
  if (!image || !placements.length) return null;

  const selected = placements.find(placement => placement.id === chosen) || placements[0];
  return (
    <section className="portal-form-summary mt-4" aria-labelledby="ad-crop-preview-title">
      <h3 id="ad-crop-preview-title" className="portal-form-section-title">
        <i className="bi bi-aspect-ratio portal-form-icon" aria-hidden="true" />Banner crop preview
      </h3>
      <p className="small text-muted mb-3">Preview the centered crop in example placement frames.</p>
      {placements.length > 1 && (
        <label className="workspace-field ad-crop-picker mb-3">
          <span>Preview placement</span>
          <select className="form-select" value={selected.id} onChange={event => setChosen(event.target.value)}>
            {placements.map(placement => <option value={placement.id} key={placement.id}>{placement.label}</option>)}
          </select>
        </label>
      )}
      <div className="ad-crop-grid">
        {placements.map(placement => (
          <figure className="ad-crop-item" data-current={selected.id === placement.id} key={placement.id}>
            <div className="ad-crop-frame" style={{ aspectRatio: previewRatios[placement.id] }}>
              <img src={image} alt={`Banner cropped for ${placement.label}`} />
            </div>
            <figcaption className="small text-muted">{placement.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
};

export default AdPlacementPreview;
