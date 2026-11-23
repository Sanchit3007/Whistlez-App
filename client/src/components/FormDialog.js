import React, { useLayoutEffect, useRef } from 'react';

const FormDialog = ({ labelledBy, onClose, wide = false, fullScreenOnMobile = false, busy = false, className = '', children }) => {
  const dialogRef = useRef(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`portal-form-dialog${wide ? ' portal-form-dialog-wide' : ''}${fullScreenOnMobile ? ' portal-form-dialog-mobile-full' : ''}${className ? ` ${className}` : ''}`}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
};

export default FormDialog;
