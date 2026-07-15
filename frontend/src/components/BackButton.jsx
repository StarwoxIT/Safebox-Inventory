import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';

// Returns to wherever the user came from (browser/app history) when possible,
// falling back to a fixed route when the page was opened directly (no history to go back to).
// Pass `alwaysTo` instead of relying on history when the button should always land on one
// fixed destination regardless of how the user got to this page.
export default function BackButton({ fallback = '/', label = 'Back', alwaysTo }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (alwaysTo) {
      navigate(alwaysTo);
      return;
    }
    const canGoBack = Boolean(window.history.state && window.history.state.idx > 0);
    if (canGoBack) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button type="button" className="btn btn-secondary back-button" onClick={handleClick}>
      <IconArrowLeft size={16} /> {label}
    </button>
  );
}
