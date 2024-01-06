export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}



export function base64ToBlob(base64: string): Blob {
    const byteString = atob(base64.split(',')[1]);
    const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];

    const byteNumbers = new Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        byteNumbers[i] = byteString.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], {type: mimeString});
}

export function base64ToImageUrl(base64) {
    // Decode the base64 string to binary data
    const binary = atob(base64.split(',')[1]);
    const array = [];
    for (let i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
    }

    // Create a Blob object
    const blob = new Blob([new Uint8Array(array)], { type: 'image/jpeg' });

    // Create a URL for the Blob object
    const imageUrl = URL.createObjectURL(blob);
    return imageUrl;
}


export function downloadString(text: string, filename: string) {
    // Create a Blob from the text
    const blob = new Blob([text], { type: 'text/plain' });

    // Create an anchor element (`<a>`) for the download
    const link = document.createElement('a');

    // Set the download attribute with the specified filename
    link.download = filename;

    // Create a URL for the Blob and set it as the href of the link
    link.href = window.URL.createObjectURL(blob);

    // Append the link to the body (required for Firefox)
    document.body.appendChild(link);

    // Simulate a click on the link to trigger the download
    link.click();

    // Remove the link after triggering the download
    document.body.removeChild(link);
}