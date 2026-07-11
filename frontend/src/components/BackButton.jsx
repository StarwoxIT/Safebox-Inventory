import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';

// Returns to wherever the user came from (browser/app history) when possible,
// falling back to a fixed route when the page was opened directly (no history to go back to).
export default function BackButton({ fallback = '/', label = 'Back' }) {
  const navigate = useNavigate();

  const handleClick = () => {
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
