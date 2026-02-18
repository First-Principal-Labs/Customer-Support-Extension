import { useState } from 'react';
import { usePageRules } from '../hooks/usePageRules.ts';
import RuleCard from '../components/RuleCard.tsx';
import ConfirmDialog from '../components/ConfirmDialog.tsx';
import PageRuleEditor from './PageRuleEditor.tsx';
import type { PageRule } from '@shared/types.ts';

export default function PageRules() {
  const { rules, addRule, updateRule, deleteRule, toggleRule, reorderRule, loading } = usePageRules();
  const [editing, setEditing] = useState<PageRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleSave = async (data: Omit<PageRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) {
      await updateRule(editing.id, data);
    } else {
      await addRule(data);
    }
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
    setEditing(null);
    setCreating(false);
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteRule(deleteTarget);
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
      setDeleteTarget(null);
    }
  };

  const handleToggle = async (id: string) => {
    await toggleRule(id);
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    await reorderRule(id, direction);
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

  if (creating || editing) {
    return (
      <PageRuleEditor
        rule={editing || undefined}
        onSave={handleSave}
        onCancel={() => {
          setEditing(null);
          setCreating(false);
        }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {rules.length} rule{rules.length !== 1 ? 's' : ''}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          + Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="empty-state">
          <p>No page rules yet. Add a rule to activate the AI assistant on specific pages.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Create Your First Rule
          </button>
        </div>
      ) : (
        rules.map((rule, index) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onEdit={() => setEditing(rule)}
            onDelete={() => setDeleteTarget(rule.id)}
            onToggle={() => handleToggle(rule.id)}
            onMoveUp={() => handleReorder(rule.id, 'up')}
            onMoveDown={() => handleReorder(rule.id, 'down')}
            isFirst={index === 0}
            isLast={index === rules.length - 1}
          />
        ))
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Rule"
          message="Are you sure you want to delete this rule? This will also clear its conversation history."
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
