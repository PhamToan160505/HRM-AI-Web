import React, { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { roleBase } from './salesUtils';

const SalesPage = lazy(() => import('./SalesPage'));

export function SalesRedirect() {
  const { role } = useAuth();
  return <Navigate to={`${roleBase(role)}/sales`} replace />;
}

export default function SalesRoute() {
  return <Suspense fallback={<p className="p-6 text-slate-600">Đang tải Kinh doanh…</p>}><SalesPage /></Suspense>;
}
