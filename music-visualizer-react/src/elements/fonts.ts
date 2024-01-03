// // const fonts = [
// //     { name: 'Custom Font1', url: 'fonts/test.ttf' },
// //     { name: 'Custom Font2', url: 'fonts/DaughterOfAGlitch-mMBv.ttf' },
// //     { name: 'Custom Font3', url: 'fonts/BROLEH.ttf' },
// //     // Add more fonts here
// // ];
// //
// //
// // fonts.forEach(font => {
// //     let fontFace = new FontFace(font.name, `url(${font.url})`);
// //     fontFace.load().then(function(loadedFont) {
// //         document.fonts.add(loadedFont);
// //
// //         // Display fonts examples
// //         let fontExample = document.createElement('div');
// //         fontExample.innerText = 'Example Text - ' + font.name;
// //         fontExample.style.fontFamily = font.name;
// //         fontExample.style.cursor = 'pointer';
// //         fontExample.onclick = function() {
// //             currentFont = font.name;
// //             updateCanvas();
// //         };
// //         document.getElementById('fontSelector').appendChild(fontExample);
// //     });
// // });
//
//
// export function animateText(analyzer: AnalyserNode, dataArray:  Uint8Array, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, average) {
//     // analyzer.getByteFrequencyData(dataArray);
//     // let average = dataArray.reduce((a, b) => a + b) / dataArray.length;
//
//     // Controls for the animation
//     let maxSizeMultiplier = 3//parseFloat(document.getElementById('maxSizeMultiplier').value);
//     let smoothness = 2//parseInt(document.getElementById('smoothness').value);
//     let borderColor = "red"//document.getElementById('borderColorInput').value;
//     let borderThickness = 5//parseInt(document.getElementById('borderThickness').value);
//
//     // Calculate new font size based on the volume
//     let baseFontSize = 44//parseInt(document.getElementById('fontSizeInput').value) || 20;
//     let fontSize = (baseFontSize + average * maxSizeMultiplier / 255).toFixed(2);
//
//     // Update font size for measurement
//     // ctx.font = `${fontSize}px ${currentFont}`;
//     ctx.font = `${fontSize}px`;
//
//     // Measure text
//     let text = "hello world"//document.getElementById('textInput').value;
//     let textMetrics = ctx.measureText(text);
//
//     // Calculate centered positions
//     let canvasCenterX = canvas.width / 2;
//     let canvasCenterY = canvas.height / 2;
//     let textWidth = textMetrics.width;
//     let textHeight = fontSize; // Approximation of text height
//
//     // Adjust X and Y to center the text
//     let x = canvasCenterX - textWidth / 2;
//     let y = canvasCenterY + textHeight / 4; // Adjust for baseline positioning
//
//     // Clear the canvas
//     // ctx.clearRect(0, 0, canvas.width, canvas.height);
//
//     // Draw text border
//     ctx.strokeStyle = borderColor;
//     ctx.lineWidth = borderThickness;
//     ctx.strokeText(text, x, y);
//
//     // Draw text fill
//     // ctx.fillStyle = document.getElementById('fontColorInput').value;
//     ctx.fillText(text, x, y);
//
//     // Continue the animation
//     setTimeout(animateText, smoothness);
// }