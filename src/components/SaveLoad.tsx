import React, {useEffect, useRef, useState} from 'react';
import {
    generateSaveDataString,
    loadFont,
    loadFromLocalstorage, loadFromString,
    saveToLocalstorage
} from "../elements/saveLoad.ts";
import {downloadString} from "../utils.ts";
import MyNotification from "./Notification.tsx";

interface SaveLoadButtonsProps {
    settings: {
        settingsVisibility: any;
        simpleBarSettingsRef: any;
        circleAnimationSettingsRef: any;
        backgroundSettingsRef: any;
        textSettingsRef: any;
        renderingSettingsRef: any;
        enableVisualsSettingsRef: any;
    }
}

// TODO: refactor this component
const SaveLoadButtons: React.FC<SaveLoadButtonsProps> = ({settings}) => {
    const [saveMessage, setSaveMessage] = useState('');

    useEffect(() => {
        const handleKeyPress = (event) => {
            // Example: Ctrl + S for Save, Ctrl + L for Load
            if (event.ctrlKey && event.key === 's') {
                event.preventDefault();
                handleSaveShortcut();
            } else if (event.ctrlKey && event.key === 'l') {
                event.preventDefault();
                handleLoadShortcut();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        // Cleanup
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, []); // Empty dependency array means this effect runs once on mount

    const handleSaveShortcut = () => {
        console.log("Project saved")
        handleSaveToLocalstorage()

        setSaveMessage('Project saved successfully!');
        // Reset the message after a delay
        setTimeout(() => setSaveMessage(''), 3000);
    };

    const handleLoadShortcut = () => {
        handleLoadFromLocalstorage()
    };


    const {
        settingsVisibility,
        simpleBarSettingsRef,
        circleAnimationSettingsRef,
        backgroundSettingsRef,
        textSettingsRef,
        renderingSettingsRef,
        enableVisualsSettingsRef
    } = settings;
    const handleSaveToLocalstorage = () => {
        saveToLocalstorage({
            text: textSettingsRef.current,
            background: backgroundSettingsRef.current,
            circle: circleAnimationSettingsRef.current,
            rendering: renderingSettingsRef.current,
            enableVisuals: enableVisualsSettingsRef.current,
            simpleBars: simpleBarSettingsRef.current,
            extra: {}
        })
    }
    const handleSaveToFile = async () => {
      const data = await  generateSaveDataString({
            text: textSettingsRef.current,
            background: backgroundSettingsRef.current,
            circle: circleAnimationSettingsRef.current,
            rendering: renderingSettingsRef.current,
            enableVisuals: enableVisualsSettingsRef.current,
            simpleBars: simpleBarSettingsRef.current,
        })
        downloadString(data, "save-preset.canvasbeats")
    }

    const handleLoadFromLocalstorage = async () => {
        const options = await loadFromLocalstorage();
        circleAnimationSettingsRef.current = options.circle;
        backgroundSettingsRef.current = options.background;
        textSettingsRef.current = options.text;
        enableVisualsSettingsRef.current = options.enableVisuals;
        renderingSettingsRef.current = options.rendering;
        simpleBarSettingsRef.current = options.simpleBars


        if (textSettingsRef.current.fontFile) {
            loadFont(textSettingsRef.current.fontFile, textSettingsRef);
        }
    }

    const fileInputRef = useRef(null);

    const handleLoadFromFile = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) {
            console.log("No file selected.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (readEvent) => {
            const options = await loadFromString(readEvent.target.result)

            circleAnimationSettingsRef.current = options.circle;
            backgroundSettingsRef.current = options.background;
            textSettingsRef.current = options.text;
            enableVisualsSettingsRef.current = options.enableVisuals;
            renderingSettingsRef.current = options.rendering;
            simpleBarSettingsRef.current = options.simpleBars

            // textSettingsRef.current.fontFile = fontFile


            if (textSettingsRef.current.fontFile) {
                loadFont(textSettingsRef.current.fontFile, textSettingsRef);
            }
        };
        reader.readAsText(file);
    };




    return (
        <div style={{textAlign: 'right', margin: '10px'}}>
            <MyNotification message={saveMessage} duration={3000} />
            <button onClick={handleSaveToLocalstorage}>Quick save</button>
            <button onClick={handleLoadFromLocalstorage} style={{margin: '5px'}}>Quick load</button>
            <button onClick={handleSaveToFile}>Save to file</button>
            <button onClick={handleLoadFromFile}>Load from file</button>
            <input
                type="file"
                ref={fileInputRef}
                style={{display: 'none'}}
                onChange={handleFileChange}
                accept=".canvasbeats"
            />
        </div>

    );
};

export default SaveLoadButtons;