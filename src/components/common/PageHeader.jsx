export default function PageHeader({ eyebrow, title, description, actions, className = "page-header" }) {
  return (
    <header className={className}>
      <div>
        {eyebrow && <div className="page-header-eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
