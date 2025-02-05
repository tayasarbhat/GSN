import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { SheetRow } from './types';
import { fetchSheetData, updateStatus } from './api';
import { DataTable } from './components/DataTable';
import { Stats } from './components/Stats';
import { Toast } from './components/Toast';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

const FETCH_INTERVAL = 5000; // 5 seconds
const IDLE_FETCH_INTERVAL = 2000; // 2 seconds when page is idle/hidden

export default function App() {
  const [data, setData] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());

  const loadData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setRefreshing(true);
      }
      setError(null);
      const sheetData = await fetchSheetData();
      setData(sheetData);
      setLastFetchTime(Date.now());
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error fetching data:', err);
    } finally {
      if (showLoading) {
        setRefreshing(false);
      }
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => loadData(true), [loadData]);

  const handleStatusChange = useCallback(async (rowIndex: number, newStatus: 'Open' | 'Reserved') => {
    try {
      await updateStatus(rowIndex, newStatus);
      setData((prevData) =>
        prevData.map((row, idx) =>
          idx === rowIndex ? { ...row, statusByCallCenter: newStatus } : row
        )
      );
      setToast({
        message: `Number ${data[rowIndex].msisdn} has been ${newStatus.toLowerCase()}`,
        type: 'success'
      });
      // Refresh data after status update to ensure consistency
      setTimeout(() => loadData(), 500);
    } catch (err) {
      setError('Failed to update status. Please try again.');
      setToast({
        message: 'Failed to update status',
        type: 'error'
      });
      loadData();
    }
  }, [loadData, data]);

  const handleCategoryClick = useCallback((category: string) => {
    setSelectedCategory(prev => prev === category ? null : category);
  }, []);

  const filteredData = useMemo(() => {
    if (!selectedCategory) return data;
    return data.filter(row => row.category === selectedCategory);
  }, [data, selectedCategory]);

  // Setup automatic data fetching
  useEffect(() => {
    let fetchInterval: number | undefined;
    let idleInterval: number | undefined;

    const startFetching = (interval: number) => {
      stopFetching();
      return window.setInterval(() => {
        // Only fetch if enough time has passed since the last fetch
        if (Date.now() - lastFetchTime >= interval) {
          loadData();
        }
      }, interval);
    };

    const stopFetching = () => {
      if (fetchInterval) window.clearInterval(fetchInterval);
      if (idleInterval) window.clearInterval(idleInterval);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, switch to more frequent updates
        idleInterval = startFetching(IDLE_FETCH_INTERVAL);
      } else {
        // Page is visible, switch to normal interval
        fetchInterval = startFetching(FETCH_INTERVAL);
        // Fetch immediately when page becomes visible
        loadData();
      }
    };

    // Initial fetch
    loadData();

    // Start normal interval
    fetchInterval = startFetching(FETCH_INTERVAL);

    // Setup visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Setup idle detection
    let idleTimeout: number;
    const handleUserActivity = () => {
      window.clearTimeout(idleTimeout);
      idleTimeout = window.setTimeout(() => {
        idleInterval = startFetching(IDLE_FETCH_INTERVAL);
      }, 60000); // Switch to idle mode after 1 minute of inactivity
    };

    // Monitor user activity
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    return () => {
      stopFetching();
      window.clearTimeout(idleTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
    };
  }, [loadData, lastFetchTime]);

  const LoadingSpinner = useMemo(() => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin">
        <RefreshCw size={32} className="text-white" />
      </div>
    </div>
  ), []);

  if (loading && !data.length) {
    return LoadingSpinner;
  }

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="glass rounded-xl p-6 sm:p-8 mb-8 transition-all duration-300">
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 glass rounded-lg">
                <FileSpreadsheet size={32} className="text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
                Google Sheets Manager
                {selectedCategory && (
                  <span className="text-sm font-normal ml-2 text-white/60">
                    Filtering by: {selectedCategory}
                  </span>
                )}
              </h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg 
                hover:bg-white/20 disabled:opacity-50 transition-all duration-300 
                hover:shadow-lg hover:scale-105 active:scale-95"
            >
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-200/20 text-white rounded-lg 
              animate-fade-in backdrop-blur-sm">
              {error}
            </div>
          )}

          <Stats 
            data={data} 
            onCategoryClick={handleCategoryClick} 
            selectedCategory={selectedCategory}
          />

          <Suspense fallback={<div className="text-white">Loading table...</div>}>
            {filteredData.length > 0 && (
              <DataTable data={filteredData} onStatusChange={handleStatusChange} />
            )}
          </Suspense>
        </div>
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}