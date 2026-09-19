import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './store/StoreContext.jsx';
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
        <Layout>
          <Routes>
            <Route path="/"         element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/log"      element={<LectureLog />} />
            <Route path="/lecture/new" element={<LogLecturePage />} />
            <Route path="/contest"  element={<ContestTracker />} />
            <Route path="/revision" element={<RevisionQueue />} />
            <Route path="/recall" element={<ActiveRecall />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </StoreProvider>
  );
}
