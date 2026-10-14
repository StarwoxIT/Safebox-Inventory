import { useEffect, useState } from 'react';
import { IconDownload, IconX } from '@tabler/icons-react';

export default function DocumentPreviewDialog({ pdfBlob, documentName, onClose }) {
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfBlob]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${documentName || 'document'}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="dialog-overlay document-preview-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="document-preview-dialog" role="dialog" aria-modal="true" aria-label={`${documentName} preview`}>
        <div className="document-preview-header">
          <h2>{documentName} Preview</h2>
          <div className="document-preview-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownload} disabled={!pdfUrl}>
              <IconDownload size={16} /> Download PDF
            </button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close preview">
              <IconX size={20} />
            </button>
          </div>
        </div>
        <iframe className="document-preview-frame" src={pdfUrl || undefined} title={`${documentName} PDF preview`} />
      </section>
    </div>
  );
}
