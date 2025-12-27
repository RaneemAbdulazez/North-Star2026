import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyA2igkvROnRDi6m2426a3QgYhzYvd2ztw8",
    authDomain: "north-star-ddcf9.firebaseapp.com",
    projectId: "north-star-ddcf9",
    storageBucket: "north-star-ddcf9.firebasestorage.app",
    messagingSenderId: "254647816522",
    appId: "1:254647816522:web:0dcc1d9e6322ca9c7631b3",
    measurementId: "G-DGXRWRJRJX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
