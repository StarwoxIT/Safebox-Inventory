export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state-panel" role="status">
      {Icon && (
        <span className="empty-state-icon">
          <Icon size={32} stroke={1.5} />
        </span>
      )}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {action}
    </div>
  );
}
