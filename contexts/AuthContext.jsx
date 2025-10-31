import React, { createContext, useContext, useState, useEffect } from 'react';

// Create AuthContext
const AuthContext = createContext();

// Provider
export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);

    useEffect(() => {
        // Check if shop & access token are in query or localStorage
        const params = new URLSearchParams(window.location.search);
        const shop = params.get('shop');
        const host = params.get('host');
        const accessToken = localStorage.getItem('accessToken'); // optional storage

        if (shop && host) {
            setSession({
                shop,
                host,
                accessToken: accessToken || '', // if you persist token after OAuth
            });
        }
    }, []);

    return (
        <AuthContext.Provider value={{ session, setSession }}>
            {children}
        </AuthContext.Provider>
    );
};

// Hook
export const useAuth = () => useContext(AuthContext);
