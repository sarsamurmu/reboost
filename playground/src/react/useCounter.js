import { useState } from 'react';

export const useCounter = (initialValue) => {
  const [state, setState] = useState(initialValue || 0);
  return [state, () => setState(state + 1), () => setState(state - 1)];
}
