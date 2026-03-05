/* global firebase */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Replace with YOUR config from Firebase Console
firebase.initializeApp({
  apiKey: "AIzaSyAQbxGI02ygdSsfBgG8J39fO7evHpDbHXM",
  authDomain: "delhiairforecast.firebaseapp.com",
  projectId: "delhiairforecast",
  storageBucket: "delhiairforecast.firebasestorage.app",
  messagingSenderId: "352437477142",
  appId: "1:352437477142:web:e0a6194173766600de8fa37"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);

  // Now all fields come from payload.data (no payload.notification)
  const { title, body, severity } = payload.data;

  const notificationOptions = {
    body: body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
    requireInteraction: severity === 'critical'
  };

  // This is now the ONLY place this notification gets shown (background)
  return self.registration.showNotification(title, notificationOptions);
});