import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = '/api';

export function useThemes() {
  const [publishedTheme, setPublishedTheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPublishedTheme = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE}/themes/published`);
      setPublishedTheme(response.data.theme);
    } catch (err) {
      console.error('Error fetching published theme:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPublishedTheme();
  }, [fetchPublishedTheme]);

  return {
    publishedTheme,
    loading,
    error,
    refetch: fetchPublishedTheme,
  };
}

export function useTemplates(themeId) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!themeId) {
      setLoading(false);
      return;
    }

    const fetchTemplates = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(`${API_BASE}/themes/${themeId}/templates`);
        setTemplates(response.data.templates || []);
      } catch (err) {
        console.error('Error fetching templates:', err);
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [themeId]);

  return { templates, loading, error };
}

export function useSections(themeId, templateName) {
  const [sections, setSections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!themeId || !templateName) {
      setLoading(false);
      return;
    }

    const fetchSections = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(
          `${API_BASE}/themes/${themeId}/templates/${templateName}/sections`
        );
        setSections(response.data.sections);
      } catch (err) {
        console.error('Error fetching sections:', err);
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, [themeId, templateName]);

  return { sections, loading, error };
}

export default useThemes;
