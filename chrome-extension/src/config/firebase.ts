// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyA2igkvROnRDi6m2426a3QgYhzYvd2ztw8",
    authDomain: "north-star-ddcf9.firebaseapp.com",
    projectId: "north-star-ddcf9",
    storageBucket: "north-star-ddcf9.firebasestorage.app",
    messagingSenderId: "254647816522",
    appId: "1:254647816522:web:0dcc1d9e6322ca9c7631b3",
    measurementId: "G-DGXRWRJRJX"
};

// Initialize Firebase
// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Analytics not supported in Extension environment
// export const analytics = getAnalytics(app);
import { getFirestore } from "firebase/firestore";
export const db = getFirestore(app);