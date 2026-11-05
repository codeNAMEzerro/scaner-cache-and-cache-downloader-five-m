import { useEffect, useRef } from 'react';

/**
 * Custom hook to listen for NUI messages from FiveM client lua
 */
export function useNuiEvent(action, handler) {
  const savedHandler = useRef();

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const eventListener = (event) => {
      const { action: eventAction, ...data } = event.data || {};
      if (savedHandler.current && eventAction === action) {
        savedHandler.current(data);
      }
    };

    window.addEventListener('message', eventListener);
    return () => window.removeEventListener('message', eventListener);
  }, [action]);
}
