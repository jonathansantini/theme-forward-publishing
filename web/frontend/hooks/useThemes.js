import { useState, useEffect, useCallback } from 'react';
import { useAuthenticatedFetch } from '@shopify/app-bridge-react';

const API_BASE = '/api';

export function useThemes() {
  const [publishedTheme, setPublishedTheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetch = useAuthenticatedFetch();

  const fetchPublishedTheme = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/themes/published`);
      const data = await response.json();
      setPublishedTheme(data.theme);
    } catch (err) {
      console.error('Error fetching published theme:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetch]);

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
  const fetch = useAuthenticatedFetch();

  useEffect(() => {
    if (!themeId) {
      setLoading(false);
      return;
    }

    const fetchTemplates = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/themes/${encodeURIComponent(themeId)}/templates`);
        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (err) {
        console.error('Error fetching templates:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [themeId, fetch]);

  return { templates, loading, error };
}

export function useSections(themeId, templateName) {
  const [sections, setSections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetch = useAuthenticatedFetch();

  useEffect(() => {
    if (!themeId || !templateName) {
      setLoading(false);
      return;
    }

    const fetchSections = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE}/themes/${encodeURIComponent(themeId)}/templates/${encodeURIComponent(templateName)}/sections`
        );
        const data = await response.json();
        setSections(data.sections);
      } catch (err) {
        console.error('Error fetching sections:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, [themeId, templateName, fetch]);

  return { sections, loading, error };
}

export default useThemes;
