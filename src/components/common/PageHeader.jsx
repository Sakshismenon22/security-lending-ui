export default function PageHeader({ eyebrow, title, description, actions, className = "page-header", eyebrowClassName = "page-header-eyebrow" }) {
  return (
    <header className={className}>
      <div>
        {eyebrow && <div className={eyebrowClassName}>{eyebrow}</div>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
