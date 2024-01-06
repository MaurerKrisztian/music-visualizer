import React from 'react';
import {fontFile, loadFont, loadFromLocalstorage, saveToLocalstorage} from "../elements/saveLoad.ts";

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

    return (
        <div style={{textAlign: 'right', margin: '10px'}}>
            <button onClick={handleSave}>Save</button>
            <button onClick={handleLoad} style={{margin: '5px'}}>Load</button>
        </div>
    );
};

export default SaveLoadButtons;