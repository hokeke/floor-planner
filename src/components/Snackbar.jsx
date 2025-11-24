import React, { useEffect } from 'react';

const Snackbar = ({ message, type = 'info', onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`snackbar snackbar-${type}`}>
      {message}
    </div>
  );
};

export default Snackbar;
