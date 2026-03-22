import { useState, useEffect } from 'react';
import { messaging, getToken, onMessage } from '../firebase-config';
import axios from 'axios';

import { API_BASE_URL } from '../config';


export const useFCM = () => {
  const [fcmToken, setFcmToken] = useState(null);
  const [fcmError, setFcmError] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('fcm_token');
    const storedRegistered = localStorage.getItem('fcm_registered');

    if (storedToken) {
      setFcmToken(storedToken);
      setIsRegistered(storedRegistered === 'true');
      console.log('✓ Loaded FCM token from storage');
    }
  }, []);

  // Request FCM token
  const requestFCMToken = async () => {
    try {
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        setFcmError('Notification permission denied');
        return null;
      }

      const token = await getToken(messaging, {
        vapidKey: 'BL1YjZlvMIh0X9A0LaJLExchfxiE4zBmm0a69G2wkxBFwG7v_j25kcm64N0rpzrX7J3IgTuk0KpWNSUF_wJjOHA'
      });

      if (token) {
        console.log('FCM Token:', token);
        setFcmToken(token);
        setFcmError(null);

        // Save to localStorage
        localStorage.setItem('fcm_token', token);

        return token;
      } else {
        setFcmError('No FCM token available');
        return null;
      }
    } catch (error) {
      console.error('FCM token error:', error);
      setFcmError(error.message);
      return null;
    }
  };

  // Register token with backend
  const registerToken = async (preferences) => {
    if (!fcmToken) {
      console.error('No FCM token to register');
      return false;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/notifications/register`, {
        fcm_token: fcmToken,
        aqi_threshold: preferences.aqiThreshold,
        notify_critical: preferences.notifyOn.includes('critical'),
        notify_high: preferences.notifyOn.includes('high'),
        notify_moderate: preferences.notifyOn.includes('moderate'),
        monitored_sites: preferences.selectedSites
      });

      if (response.data.success) {
        setIsRegistered(true);

        // Save registration status to localStorage
        localStorage.setItem('fcm_registered', 'true');

        console.log('Token registered successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token registration failed:', error);
      setFcmError(error.message);
      return false;
    }
  };

  // Update preferences
  const updatePreferences = async (preferences) => {
    if (!fcmToken) return false;

    try {
      const response = await axios.put(`${API_BASE_URL}/notifications/preferences`, {
        fcm_token: fcmToken,
        aqi_threshold: preferences.aqiThreshold,
        notify_critical: preferences.notifyOn.includes('critical'),
        notify_high: preferences.notifyOn.includes('high'),
        notify_moderate: preferences.notifyOn.includes('moderate'),
        monitored_sites: preferences.selectedSites
      });

      return response.data.success;
    } catch (error) {
      console.error('Preference update failed:', error);
      return false;
    }
  };

  // Unregister token
  const unregisterToken = async () => {
    if (!fcmToken) return false;

    try {
      const response = await axios.post(`${API_BASE_URL}/notifications/unregister`, {
        fcm_token: fcmToken
      });

      if (response.data.success) {
        setIsRegistered(false);
        setFcmToken(null);

        // Clear from localStorage
        localStorage.removeItem('fcm_token');
        localStorage.removeItem('fcm_registered');

        return true;
      }
      return false;
    } catch (error) {
      console.error('Token unregistration failed:', error);
      return false;
    }
  };

  // Listen for foreground messages
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);

      // Read from data (since we removed the notification field from backend)
      const title = payload.data?.title;
      const body = payload.data?.body;
      const severity = payload.data?.severity;

      if (title) {
        new Notification(title, {
          body: body,
          icon: '/favicon.ico',
          requireInteraction: severity === 'critical'
        });
      }
    });
    return () => unsubscribe();
  }, []);

  return {
    fcmToken,
    fcmError,
    isRegistered,
    requestFCMToken,
    registerToken,
    updatePreferences,
    unregisterToken
  };
};