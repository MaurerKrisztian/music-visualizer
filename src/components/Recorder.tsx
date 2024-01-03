import React, { useState, useRef, useEffect } from 'react';

const Recorder = ({ audioRef, canvasRef }) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const startRecording = () => {

        if (audioRef.current && canvasRef.current) {
            const audioStream = audioRef.current.captureStream();
            const canvasStream = canvasRef.current.captureStream(33); // Try 25 FPS

            console.log("Audio Stream Tracks:", audioStream.getTracks());
            console.log("Canvas Stream Tracks:", canvasStream.getTracks());

            const combinedStream = new MediaStream([...canvasStream.getTracks(), ...audioStream.getTracks()]);
            console.log("Combined Stream Tracks:", combinedStream.getTracks());

            mediaRecorderRef.current = new MediaRecorder(combinedStream, { mimeType: 'video/webm', videoBitsPerSecond: 2 * 1024 * 1024 });

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };
        }


        recordedChunksRef.current = [];
        mediaRecorderRef.current.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        saveRecording()
    };

    const saveRecording = () => {
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'recording.webm';
            a.click();
            URL.revokeObjectURL(url);
        };
    };

    return (
        <div className="recorder-controls">
            <button onClick={isRecording ? stopRecording : startRecording}>
                {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
        </div>
    );
};

export default Recorder;
