import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider, useStore } from './store/StoreContext.jsx';
import Login from './pages/Login.jsx';
import Worksheets from './pages/Worksheets.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Calendar from './pages/Calendar.jsx';
import LectureLog from './pages/LectureLog.jsx';
import ContestTracker from './pages/ContestTracker.jsx';
import RevisionQueue from './pages/RevisionQueue.jsx';
import Settings from './pages/Settings.jsx';
import LogLecturePage from './pages/LogLecturePage.jsx';
import ActiveRecall from './pages/ActiveRecall.jsx';

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <AccountApp />
      </BrowserRouter>
    </StoreProvider>
  );
}

function AccountApp() {
  const { account, isWorksheet } = useStore();
  React.useEffect(() => {
    if (isWorksheet) document.documentElement.dataset.theme = 'worksheet';
    else delete document.documentElement.dataset.theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [isWorksheet]);
  if (account.status !== 'signed-in') return <Login />;
  return (
        <Layout>
          <Routes>
            <Route path="/"         element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/log"      element={<LectureLog />} />
            <Route path="/lecture/new" element={<LogLecturePage />} />
            <Route path="/contest"  element={isWorksheet ? <Navigate to="/worksheets" replace /> : <ContestTracker />} />
            <Route path="/worksheets" element={isWorksheet ? <Worksheets /> : <Navigate to="/" replace />} />
            <Route path="/revision" element={<RevisionQueue />} />
            <Route path="/recall" element={<ActiveRecall />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
  );
}
