export default function ConfirmDialog({ title, message, onConfirm, onCancel, loading }) {
  return (
    // Clicking the dark backdrop (not the dialog itself) cancels
    <div className="confirm-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div id="confirm-title" className="confirm-title">{title}</div>
        <div className="confirm-text">{message}</div>
        <div className="confirm-actions">
          <button className="confirm-delete-btn" onClick={onConfirm} disabled={loading}>
            {loading ? '...' : 'Delete'}
          </button>
          <button className="confirm-cancel-btn" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}