// core/authManager.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAH-mM4QI_yLxJY1iUAmaJD-mQpEaxeugw",
    authDomain: "vnvcloudbook.firebaseapp.com",
    projectId: "vnvcloudbook",
    storageBucket: "vnvcloudbook.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Registers a new user as a superAdmin and creates their Firestore record.
 * @param {string} email 
 * @param {string} password 
 * @returns {Object} User session state
 */
export async function signUpUser(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userData = {
            uid: user.uid,
            email: user.email,
            role: 'superAdmin',
            companyId: null,
            createdAt: new Date().toISOString()
        };

        // Create the user document in Firestore
        await setDoc(doc(db, "users", user.uid), userData);

        // Persist to local storage
        localStorage.setItem('vnv_uid', user.uid);
        localStorage.setItem('vnv_role', 'superAdmin');
        localStorage.setItem('vnv_companyId', 'null');

        return { user, role: 'superAdmin', companyId: null, needsSetup: true };
    } catch (error) {
        console.error("Sign Up Error:", error);
        throw error;
    }
}

/**
 * Logs in a user, retrieves their role/companyId, and checks if setup is required.
 * @param {string} email 
 * @param {string} password 
 * @returns {Object} User session state
 */
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Fetch user data from Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            throw new Error("User record not found in database.");
        }

        const userData = userDoc.data();
        
        // Persist session state
        localStorage.setItem('vnv_uid', user.uid);
        localStorage.setItem('vnv_role', userData.role);
        if (userData.companyId) {
            localStorage.setItem('vnv_companyId', userData.companyId);
        } else {
            localStorage.setItem('vnv_companyId', 'null');
        }

        const needsSetup = !userData.companyId;

        return { 
            user, 
            role: userData.role, 
            companyId: userData.companyId, 
            needsSetup 
        };
    } catch (error) {
        console.error("Login Error:", error);
        throw error;
    }
}

/**
 * Logs out the current user and clears local state.
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        localStorage.removeItem('vnv_uid');
        localStorage.removeItem('vnv_role');
        localStorage.removeItem('vnv_companyId');
        // Optionally redirect to login screen here
    } catch (error) {
        console.error("Logout Error:", error);
        throw error;
    }
}

/**
 * Utility to grab the current synchronized state without querying Firebase.
 */
export function getLocalSession() {
    return {
        uid: localStorage.getItem('vnv_uid'),
        role: localStorage.getItem('vnv_role'),
        companyId: localStorage.getItem('vnv_companyId') === 'null' ? null : localStorage.getItem('vnv_companyId')
    };
}
