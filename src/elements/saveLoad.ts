import {setBackgroundImage} from "./backgroundAnimation.ts";
import {base64ToBlob, base64ToImageUrl, blobToBase64} from "../utils.ts";
import {ISaveOptions} from "../interfaces/save-load.interface.ts";

export let fontFile = null;

export async function generateSaveDataString(saveOptions: ISaveOptions): Promise<string> {
    const options = Object.assign({}, saveOptions);
    if (options.background.backgroundImage !== "") {
        options.background.backgroundImage = await imageUrlToBase64(options.background.backgroundImage);
    }

    if (options.text.selectedFont == "CustomFont") {
        options.extra.fontFile = await blobToBase64(saveOptions.text.fontFile);
    }

    return JSON.stringify(options, null, 2);
}

export function loadFont(file: Blob, textSettingsRef) {

    const font = new FontFace('CustomFont', `url(${URL.createObjectURL(file)})`);
    font.load().then((loadedFont) => {
        document.fonts.add(loadedFont);
        textSettingsRef.current.selectedFont = 'CustomFont';
    }).catch(error => console.error('Error loading font:', error));
}

export async function loadFromString(options: string): Promise<ISaveOptions> {
    const parsedOptions: ISaveOptions = JSON.parse(options || "{}");

    if (typeof parsedOptions.background.backgroundImage === 'string' && parsedOptions.background.backgroundImage !== "") {
        parsedOptions.background.backgroundImage = base64ToImageUrl(parsedOptions.background.backgroundImage);
        setBackgroundImage(parsedOptions.background.backgroundImage)
    }

    if (parsedOptions.extra.fontFile) {
        fontFile = await base64ToBlob(parsedOptions.extra.fontFile)
    }

    return parsedOptions;
}

export async function saveToLocalstorage(saveOptions: ISaveOptions) {
    localStorage.setItem("save", await generateSaveDataString(saveOptions));
}

export async function imageUrlToBase64(url: string) {
    const blob = await fetch(url).then(res => res.blob());
    return blobToBase64(blob);
}

export function loadFromLocalstorage(): Promise<ISaveOptions> {
    const data = localStorage.getItem("save");
    if (!data) {
        console.warn("Nothing is saved");
    }
    return loadFromString(data);
}

