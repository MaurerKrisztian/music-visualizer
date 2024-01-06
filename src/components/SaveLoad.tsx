import React, {useRef} from 'react';
import {
    fontFile,
    generateSaveDataString,
    loadFont,
    loadFromLocalstorage, loadFromString,
    saveToLocalstorage
} from "../elements/saveLoad.ts";
import {downloadString} from "../utils.ts";

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

const SaveLoadButtons: React.FC<SaveLoadButtonsProps> = ({settings}) => {

    const {
        settingsVisibility,
        simpleBarSettingsRef,
        circleAnimationSettingsRef,
        backgroundSettingsRef,
        textSettingsRef,
        renderingSettingsRef,
        enableVisualsSettingsRef
    } = settings;
    const handleSave = () => {
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
            extra: {}
        })
        downloadString(data, "save-preset.canvasbeats")
    }

    const handleLoad = async () => {
        const options = await loadFromLocalstorage();
        circleAnimationSettingsRef.current = options.circle;
        backgroundSettingsRef.current = options.background;
        textSettingsRef.current = options.text;
        enableVisualsSettingsRef.current = options.enableVisuals;
        renderingSettingsRef.current = options.rendering;
        simpleBarSettingsRef.current = options.simpleBars

        textSettingsRef.current.fontFile = fontFile


        if (fontFile) {
            loadFont(fontFile, textSettingsRef);
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

            textSettingsRef.current.fontFile = fontFile


            if (fontFile) {
                loadFont(fontFile, textSettingsRef);
            }
        };
        reader.readAsText(file);
    };


    return (
        <div style={{textAlign: 'right', margin: '10px'}}>
            <button onClick={handleSave}>Quick save</button>
            <button onClick={handleLoad} style={{margin: '5px'}}>Quick load</button>
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