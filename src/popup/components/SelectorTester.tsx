import { useState } from 'react';

interface SelectorTesterProps {
  selector: string;
}

interface TestResult {
  found: boolean;
  tag?: string;
  text?: string;
  error?: string;
}

export default function SelectorTester({ selector }: SelectorTesterProps) {
  const [result, setResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!selector.trim()) return;
    setTesting(true);
    setResult(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_SELECTOR',
        selector: selector.trim(),
      });
      setResult(response as TestResult);
    } catch {
      setResult({ found: false, error: 'Could not reach the active tab' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={handleTest}
        disabled={testing || !selector.trim()}
        style={{ marginTop: '6px' }}
      >
        {testing ? 'Testing...' : 'Test Selector'}
      </button>
      {result && (
        <div className={`selector-test-result ${result.found ? 'found' : 'not-found'}`}>
          {result.found ? (
            <>
              Found: <code>&lt;{result.tag}&gt;</code>
              {result.text && (
                <span className="selector-test-text">
                  {' '}&mdash; "{result.text.length > 60 ? result.text.substring(0, 60) + '...' : result.text}"
                </span>
              )}
            </>
          ) : (
            <span>{result.error || 'No element matched this selector'}</span>
          )}
        </div>
      )}
    </div>
  );
}
