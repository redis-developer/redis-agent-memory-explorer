"use client";

import { useState, useEffect, useCallback } from "react";

import { fetchHealth } from "@/services/api.service";

const HEALTH_CHECK_INTERVAL_MS = 30000;

type UseBackendHealthResult = {
  serverOk: boolean;
  isChecking: boolean;
  checkNow: () => void;
};

const useBackendHealth = (): UseBackendHealthResult => {
  const [serverOk, setServerOk] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkHealth = useCallback(() => {
    setIsChecking(true);
    fetchHealth()
      .then(() => {
        setServerOk(true);
        setIsChecking(false);
      })
      .catch(() => {
        setServerOk(false);
        setIsChecking(false);
      });
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { serverOk, isChecking, checkNow: checkHealth };
};

export { useBackendHealth };
export type { UseBackendHealthResult };
