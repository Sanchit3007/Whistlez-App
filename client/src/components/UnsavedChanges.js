import { useCallback, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import FormDialog from './FormDialog';

const UnsavedChanges = ({ dirty, onSave }) => {
  const blocker = useBlocker(dirty);
  const [saving, setSaving] = useState(false);

  useBeforeUnload(useCallback(event => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  }, [dirty]));

  const saveAndLeave = async () => {
    setSaving(true);
    try {
      // Close the confirmation before validating or focusing the actual form.
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (await onSave()) blocker.proceed();
      else blocker.reset();
    } catch {
      blocker.reset();
    } finally {
      setSaving(false);
    }
  };

  if (blocker.state !== 'blocked' || saving) return null;

  return (
    <FormDialog labelledBy="unsaved-changes-title" onClose={blocker.reset}>
      <div className="modal-content">
        <div className="modal-header"><h2 id="unsaved-changes-title" className="h5 mb-0">Unsaved changes</h2></div>
        <div className="modal-body">Save your changes before you leave this page?</div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline-secondary" onClick={blocker.reset}>Keep editing</button>
          <button type="button" className="btn btn-outline-danger" onClick={blocker.proceed}>Discard changes</button>
          <button type="button" className="btn btn-primary" onClick={saveAndLeave}>Save and leave</button>
        </div>
      </div>
    </FormDialog>
  );
};

export default UnsavedChanges;
