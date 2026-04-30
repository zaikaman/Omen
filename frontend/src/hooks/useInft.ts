import { useCallback, useEffect, useRef, useState } from 'react';

import { getInftProof, type InftProofResponse } from '../lib/api/inft';

export const useInftProof = (options: { refreshIntervalMs?: number } = {}) => {
  const [proof, setProof] = useState<InftProofResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    setIsLoading(!hasDataRef.current);
    setIsRefreshing(hasDataRef.current);
    setError(null);

    try {
      setProof(await getInftProof());
      hasDataRef.current = true;
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError
          : new Error('Failed to load iNFT proof.'),
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();

    if (!options.refreshIntervalMs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void load();
    }, options.refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [load, options.refreshIntervalMs]);

  return {
    proof,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};
