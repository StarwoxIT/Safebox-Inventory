export default function PageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="ph">
      <div className="ph-heading">
        {Icon && (
          <span className="ph-icon">
            <Icon size={20} />
          </span>
        )}
        <div>
          <h1 className="ph-title">{title}</h1>
          {subtitle && <p className="ph-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </div>
  );
}
