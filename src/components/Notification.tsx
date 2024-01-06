import React, { useState, useEffect } from 'react';

 const MyNotification = ({ message, duration }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [message, duration]);

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: 'lightgreen',
            padding: '10px',
            borderRadius: '5px',
            color: "black",
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }}>
            {message}
        </div>
    );
};
export default MyNotification;