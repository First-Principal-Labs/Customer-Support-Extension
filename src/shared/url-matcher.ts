export function globToRegex(pattern: string): RegExp {
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  if (!regexStr.startsWith('https?') && !regexStr.startsWith('http')) {
    regexStr = '(https?://)?' + regexStr;
  }

  return new RegExp('^' + regexStr + '$', 'i');
}

export function urlMatchesPattern(url: string, pattern: string): boolean {
  try {
    const regex = globToRegex(pattern);
    return regex.test(url);
  } catch {
    return false;
  }
}

export function findMatchingRule<T extends { urlPattern: string; isActive: boolean; id: string }>(
  url: string,
  rules: T[]
): T | null {
  for (const rule of rules) {
    if (rule.isActive && urlMatchesPattern(url, rule.urlPattern)) {
      return rule;
    }
  }
  return null;
}

export function isValidPattern(pattern: string): boolean {
  try {
    globToRegex(pattern);
    return pattern.length > 0;
  } catch {
    return false;
  }
}
