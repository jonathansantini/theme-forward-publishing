import { useState, useEffect, useCallback } from 'react';
import { useAuthenticatedFetch } from '@shopify/app-bridge-react';

const API_BASE = '/api';

export function useSchedules() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetch = useAuthenticatedFetch();

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/schedules`);
      const data = await response.json();
      setSchedules(data.schedules || []);
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetch]);

  const createSchedule = useCallback(async (scheduleData) => {
    try {
      const response = await fetch(`${API_BASE}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData),
      });
      const data = await response.json();
      await fetchSchedules(); // Refresh the list
      return data.schedule;
    } catch (err) {
      console.error('Error creating schedule:', err);
      throw err;
    }
  }, [fetch, fetchSchedules]);

  const updateSchedule = useCallback(async (id, updates) => {
    try {
      const response = await fetch(`${API_BASE}/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      await fetchSchedules(); // Refresh the list
      return data.schedule;
    } catch (err) {
      console.error('Error updating schedule:', err);
      throw err;
    }
  }, [fetch, fetchSchedules]);

  const deleteSchedule = useCallback(async (id) => {
    try {
      await fetch(`${API_BASE}/schedules/${id}`, {
        method: 'DELETE',
      });
      await fetchSchedules(); // Refresh the list
    } catch (err) {
      console.error('Error deleting schedule:', err);
      throw err;
    }
  }, [fetch, fetchSchedules]);

  const finalizeSchedule = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE}/schedules/${id}/finalize`, {
        method: 'POST',
      });
      const data = await response.json();
      await fetchSchedules(); // Refresh the list
      return data.schedule;
    } catch (err) {
      console.error('Error finalizing schedule:', err);
      throw err;
    }
  }, [fetch, fetchSchedules]);

  const unpublishSchedule = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE}/schedules/${id}/unpublish`, {
        method: 'POST',
      });
      const data = await response.json();
      await fetchSchedules(); // Refresh the list
      return data.schedule;
    } catch (err) {
      console.error('Error unpublishing schedule:', err);
      throw err;
    }
  }, [fetch, fetchSchedules]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return {
    schedules,
    loading,
    error,
    refetch: fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    finalizeSchedule,
    unpublishSchedule,
  };
}

export function useSchedule(id) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetch = useAuthenticatedFetch();

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchSchedule = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/schedules/${id}`);
        const data = await response.json();
        setSchedule(data.schedule);
      } catch (err) {
        console.error('Error fetching schedule:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [id, fetch]);

  return { schedule, loading, error };
}

export default useSchedules;
