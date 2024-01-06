import React, { useEffect, useState } from 'react';

const FontsList = ({ textSettingsRef }) => {
    const fonts = [
        'public/fonts/test.ttf',
        'public/fonts/BROLEH.ttf',
        'public/fonts/DaughterOfAGlitch-mMBv.ttf',
        'public/fonts/Athletic-1VmB.ttf',
        'public/fonts/SandsGreyhoodSeven-D4W0.otf',
        'public/fonts/MarshalTheDead-ywjxM.ttf',
        'public/fonts/BambooBrush-gxd05.ttf',
        'public/fonts/LucySaidOkPersonalUseItalic-OV9ee.ttf',
        // ... other font files
    ];

    const [loadedFonts, setLoadedFonts] = useState({});
    const [fontBlobs, setFontBlobs] = useState({});
    const [hoveredFont, setHoveredFont] = useState(null);

    useEffect(() => {
        fonts.forEach((fontPath, index) => {
            const fontName = `CustomFont${index}`;

            fetch(fontPath)
                .then(response => response.blob())
                .then(blob => {
                    const font = new FontFace(fontName, `url(${URL.createObjectURL(blob)})`);
                    font.load().then((loadedFont) => {
                        document.fonts.add(loadedFont);
                        setLoadedFonts(prevFonts => ({ ...prevFonts, [fontName]: fontName }));
                        setFontBlobs(prevBlobs => ({ ...prevBlobs, [fontName]: blob }));
                    });
                })
                .catch(error => console.error('Error loading font:', error));
        });
    }, []);

    const handleFontClick = (fontName) => {
        const fontBlob = fontBlobs[fontName];
        if (fontBlob) {
            textSettingsRef.current.fontFile = fontBlob;
            textSettingsRef.current.selectedFont = fontName;
        }
    };

    const listItemStyle = (fontName) => ({
        cursor: 'pointer',
        fontFamily: loadedFonts[fontName],
        backgroundColor: hoveredFont === fontName ? '#696969' : 'transparent',
        padding: '5px',
        fontSize:  hoveredFont === fontName ? "43px" : "22px",
        WebkitTextStroke: hoveredFont === fontName ? "1px red" : "0px",
        borderRadius: '5px',
        margin: '5px 0'
    });

    return (
        <div style={{ overflowY: 'scroll', height: '400px' }}>
            {fonts.map((font, index) => {
                const fontName = `CustomFont${index}`;
                return (
                    <div
                        key={index}
                        onClick={() => handleFontClick(fontName)}
                        onMouseEnter={() => setHoveredFont(fontName)}
                        onMouseLeave={() => setHoveredFont(null)}
                        style={listItemStyle(fontName)}
                    >
                        <p>F o n t - Sample 1 2 3 - {font.split("/")[font.split("/").length-1]}</p>
                    </div>
                );
            })}
        </div>
    );
};

export default FontsList;
