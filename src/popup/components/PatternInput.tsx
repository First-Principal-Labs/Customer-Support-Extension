import { useState } from 'react';
import { isValidPattern, urlMatchesPattern } from '@shared/url-matcher.ts';

interface PatternInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PatternInput({ value, onChange }: PatternInputProps) {
  const [testUrl, setTestUrl] = useState('');
  const [showTest, setShowTest] = useState(false);

  const valid = value.length === 0 || isValidPattern(value);
  const testResult =
    testUrl && value ? urlMatchesPattern(testUrl, value) : null;

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="*.example.com/support/*"
        className={
          value.length > 0 ? (valid ? 'pattern-valid' : 'pattern-invalid') : ''
        }
      />
      <div className="hint">
        Use * for any segment, ** for any path.{' '}
        <button
          type="button"
          onClick={() => setShowTest(!showTest)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: '11px',
            textDecoration: 'underline',
          }}
        >
          {showTest ? 'Hide test' : 'Test pattern'}
        </button>
      </div>
      {showTest && (
        <div style={{ marginTop: '6px' }}>
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="https://example.com/support/tickets"
            style={{ fontSize: '12px' }}
          />
          {testResult !== null && (
            <div className={`test-result ${testResult ? 'match' : 'no-match'}`}>
              {testResult ? 'Match' : 'No match'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
