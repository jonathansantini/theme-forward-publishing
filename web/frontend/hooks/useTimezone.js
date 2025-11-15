import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = '/api';

export function useTimezone() {
  const [shopTimezone, setShopTimezone] = useState('UTC');
  const [shopInfo, setShopInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchShopInfo = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(`${API_BASE}/shop`);
        setShopInfo(response.data.shop);
        setShopTimezone(response.data.shop.ianaTimezone || 'UTC');
      } catch (err) {
        console.error('Error fetching shop info:', err);
        setError(err.response?.data?.error || err.message);
        // Default to UTC on error
        setShopTimezone('UTC');
      } finally {
        setLoading(false);
      }
    };

    fetchShopInfo();
  }, []);

  /**
   * Format a date in shop timezone
   */
  const formatDate = (date, format = 'default') => {
    const dateObj = new Date(date);

    if (format === 'short') {
      return dateObj.toLocaleDateString();
    } else if (format === 'long') {
      return dateObj.toLocaleString();
    } else {
      return dateObj.toLocaleString(undefined, {
        timeZone: shopTimezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  /**
   * Get relative time (e.g., "in 2 hours", "3 days ago")
   */
  const getRelativeTime = (date) => {
    const now = new Date();
    const targetDate = new Date(date);
    const diffMs = targetDate - now;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) {
      // Past
      const absMins = Math.abs(diffMins);
      if (absMins < 60) return `${absMins} minute${absMins !== 1 ? 's' : ''} ago`;
      const hours = Math.floor(absMins / 60);
      if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else {
      // Future
      if (diffMins < 60) return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
      const hours = Math.floor(diffMins / 60);
      if (hours < 24) return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
      const days = Math.floor(hours / 24);
      return `in ${days} day${days !== 1 ? 's' : ''}`;
    }
  };

  return {
    shopTimezone,
    shopInfo,
    loading,
    error,
    formatDate,
    getRelativeTime,
  };
}

export default useTimezone;
