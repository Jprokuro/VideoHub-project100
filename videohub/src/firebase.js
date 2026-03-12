// ══════════════════════════════════════════════════
//  FIREBASE CONFIG — আপনার নিজের config দিয়ে replace করুন
//  Firebase Console → Project Settings → Your apps → Web app
// ══════════════════════════════════════════════════
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey:            "AIzaSyC86lpQaSuAcfCdx6TPOoTn8jS7EwdiPvM",
  authDomain:        "videohub-f1940.firebaseapp.com",
  databaseURL:       "https://videohub-f1940-default-rtdb.firebaseio.com",
  projectId:         "videohub-f1940",
  storageBucket:     "videohub-f1940.firebasestorage.app",
  messagingSenderId: "835766018921",
  appId:             "1:835766018921:web:20c2588996bc79a93653f8",
};

const app = initializeApp(firebaseConfig);
export const db  = getDatabase(app);
