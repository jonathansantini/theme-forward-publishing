import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = '/api';

export function useSchedules() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE}/schedules`);
      setSchedules(response.data.schedules || []);
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSchedule = useCallback(async (scheduleData) => {
    try {
      const response = await axios.post(`${API_BASE}/schedules`, scheduleData);
      await fetchSchedules(); // Refresh the list
      return response.data.schedule;
    } catch (err) {
      console.error('Error creating schedule:', err);
      throw err;
    }
  }, [fetchSchedules]);

  const updateSchedule = useCallback(async (id, updates) => {
    try {
      const response = await axios.put(`${API_BASE}/schedules/${id}`, updates);
      await fetchSchedules(); // Refresh the list
      return response.data.schedule;
    } catch (err) {
      console.error('Error updating schedule:', err);
      throw err;
    }
  }, [fetchSchedules]);

  const deleteSchedule = useCallback(async (id) => {
    try {
      await axios.delete(`${API_BASE}/schedules/${id}`);
      await fetchSchedules(); // Refresh the list
    } catch (err) {
      console.error('Error deleting schedule:', err);
      throw err;
    }
  }, [fetchSchedules]);

  const finalizeSchedule = useCallback(async (id) => {
    try {
      const response = await axios.post(`${API_BASE}/schedules/${id}/finalize`);
      await fetchSchedules(); // Refresh the list
      return response.data.schedule;
    } catch (err) {
      console.error('Error finalizing schedule:', err);
      throw err;
    }
  }, [fetchSchedules]);

  const unpublishSchedule = useCallback(async (id) => {
    try {
      const response = await axios.post(`${API_BASE}/schedules/${id}/unpublish`);
      await fetchSchedules(); // Refresh the list
      return response.data.schedule;
    } catch (err) {
      console.error('Error unpublishing schedule:', err);
      throw err;
    }
  }, [fetchSchedules]);

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

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchSchedule = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(`${API_BASE}/schedules/${id}`);
        setSchedule(response.data.schedule);
      } catch (err) {
        console.error('Error fetching schedule:', err);
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [id]);

  return { schedule, loading, error };
}

export default useSchedules;
