
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Replace with YOUR config from Firebase Console

const firebaseConfig = {
  apiKey: "AIzaSyAQbxGI02ygdSsfBg68J39fO7evHpDbHXM",
  authDomain: "delhiairforecast.firebaseapp.com",
  projectId: "delhiairforecast",
  storageBucket: "delhiairforecast.firebasestorage.app",
  messagingSenderId: "352437477142",
  appId: "1:352437477142:web:e0a61941737e660de8fa37"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export { messaging, getToken, onMessage };