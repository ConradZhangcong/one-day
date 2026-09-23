import { Navigate } from 'react-router';

/** Compatibility entry for saved links to the former goals page. */
export function GoalsPage() {
  return <Navigate replace to="/long-term" />;
}
