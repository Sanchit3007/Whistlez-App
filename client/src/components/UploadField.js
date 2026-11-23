const UploadField = ({ id, label, action, hint, icon, accept, onChange, required, disabled, errorId }) => (
  <label className="portal-upload" htmlFor={id}>
    <i className={`bi bi-${icon} portal-form-icon`} aria-hidden="true" />
    <span className="portal-upload-copy">
      <strong>{label}</strong>
      <small id={`${id}-hint`}>{hint}</small>
    </span>
    <span className="portal-upload-action">{action}</span>
    <input
      id={id}
      type="file"
      accept={accept}
      aria-label={`${action} — ${label}`}
      aria-describedby={errorId ? `${id}-hint ${errorId}` : `${id}-hint`}
      aria-invalid={errorId ? true : undefined}
      onChange={onChange}
      required={required}
      disabled={disabled}
    />
  </label>
);

export default UploadField;
