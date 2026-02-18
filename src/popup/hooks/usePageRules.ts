import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { PageRule } from '@shared/types.ts';
import { useStorage } from './useStorage.ts';
import { STORAGE_KEYS } from '@shared/constants.ts';

export function usePageRules() {
  const [rules, setRules, loading] = useStorage<PageRule[]>(
    STORAGE_KEYS.PAGE_RULES,
    []
  );

  const addRule = useCallback(
    async (data: Omit<PageRule, 'id' | 'createdAt' | 'updatedAt'>) => {
      const newRule: PageRule = {
        ...data,
        id: uuidv4(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await setRules((prev) => [...prev, newRule]);
      return newRule;
    },
    [setRules]
  );

  const updateRule = useCallback(
    async (id: string, updates: Partial<PageRule>) => {
      await setRules((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
        )
      );
    },
    [setRules]
  );

  const deleteRule = useCallback(
    async (id: string) => {
      await setRules((prev) => prev.filter((r) => r.id !== id));
    },
    [setRules]
  );

  const toggleRule = useCallback(
    async (id: string) => {
      await setRules((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, isActive: !r.isActive, updatedAt: Date.now() } : r
        )
      );
    },
    [setRules]
  );

  const reorderRule = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      await setRules((prev) => {
        const index = prev.findIndex((r) => r.id === id);
        if (index < 0) return prev;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= prev.length) return prev;
        const newRules = [...prev];
        [newRules[index], newRules[newIndex]] = [newRules[newIndex], newRules[index]];
        return newRules;
      });
    },
    [setRules]
  );

  return { rules, addRule, updateRule, deleteRule, toggleRule, reorderRule, loading };
}
