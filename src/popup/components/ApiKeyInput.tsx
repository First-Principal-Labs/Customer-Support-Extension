import { useState } from 'react';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function ApiKeyInput({ value, onChange, placeholder }: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="api-key-input">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Enter your API key'}
      />
      <button
        type="button"
        className="toggle-visibility"
        onClick={() => setVisible(!visible)}
        title={visible ? 'Hide key' : 'Show key'}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
