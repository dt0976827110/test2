importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD6srrR4Mg18cBDavmzJ4PDg4uFPPYPXbc",
  authDomain: "superunion-pwa.firebaseapp.com",
  projectId: "superunion-pwa",
  storageBucket: "superunion-pwa.appspot.com",
  messagingSenderId: "959968900132",
  appId: "1:959968900132:web:4403e5ab3685ded0ae94b1"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/top.jpg'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
