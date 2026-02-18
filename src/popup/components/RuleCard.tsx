import type { PageRule } from '@shared/types.ts';

interface RuleCardProps {
  rule: PageRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export default function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: RuleCardProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{rule.name}</div>
          <div className="card-subtitle" title={rule.urlPattern}>
            {rule.urlPattern}
          </div>
        </div>
        <div className="card-actions">
          <span className={`badge ${rule.isActive ? 'badge-active' : 'badge-inactive'}`}>
            {rule.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
      {rule.prompt && (
        <div
          className="card-subtitle"
          style={{
            marginBottom: '8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Prompt: {rule.prompt.substring(0, 60)}
          {rule.prompt.length > 60 ? '...' : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="toggle">
          <input type="checkbox" checked={rule.isActive} onChange={onToggle} />
          <span className="toggle-slider" />
        </label>
        {onMoveUp && (
          <button className="btn btn-secondary btn-sm" onClick={onMoveUp} disabled={isFirst} title="Move up">
            &#x25B2;
          </button>
        )}
        {onMoveDown && (
          <button className="btn btn-secondary btn-sm" onClick={onMoveDown} disabled={isLast} title="Move down">
            &#x25BC;
          </button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
