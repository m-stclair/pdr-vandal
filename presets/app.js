// Built-in effect stack presets (not stored in localStorage)
export const builtInPresets = [
    {
        name: "Monkey Island",
        config: [
            {
                "name": "Pixelate",
                "config": {
                    "blockSize": 3,
                    "sampleStrategy": "corner",
                    "preserveAlpha": true
                }
            },
            {
                "name": "Pixel Sort",
                "config": {
                    "threshold": 0.68,
                    "direction": "vertical",
                    "useR": true,
                    "useG": true,
                    "useB": true,
                    "perlin": false
                }
            }
        ]
    },
    {
        name: "Moody Feedback",
        config: [
            {
                "name": "Invert",
                "config": {
                    "invert0": false,
                    "invert1": false,
                    "invert2": true,
                    "mode": "2"
                }
            },
            {
                "name": "Posterize",
                "config": {
                    "levels": 8,
                    "mode": "3",
                    "mod": 0.55,
                }
            },
            {
                "name": "Delay Line",
                "config": {
                    "delay": 178.49,
                    "window": "box",
                    "falloff": "uniform",
                    "density": 2,
                    "angle": 89.38,
                    "shearX": -0.7,
                    "shearY": 5,
                    "scaleX": 3,
                    "scaleY": 3
                }
            }
        ]
    },
    {
        "name": "Pastel Unfold",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.3,
                    "cycle": true,
                    "cycleMode": "spatial",
                    "hueShift": 150,
                    "saturation": 35,
                    "lightness": 61,
                    "hueSpread": 1,
                    "bleed": 0.17
                }
            },
            {
                "name": "Perlin Distort",
                "config": {
                    "boundMode": "fract",
                    "pitchX": 0,
                    "pitchY": 0,
                    "freqX": 1.0344800199802937,
                    "freqY": 1.0344800199802937,
                    "seed": 1,
                    "depth": 0.5,
                    "rate": 11.953835045930655,
                    "rateDrive": 0.47,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "pseudo"
                }
            }
        ]
    },
    {
        "name": "Action",
        "config": [{
            "name": "Look",
            "config": {
                "exposure": -0.1,
                "toneShoulder": 1.8,
                "toneCenter": -1.65,
                "curveStrength": 1,
                "chromaWeight": 1.01,
                "chromaFadeLow": -2,
                "chromaFadeHigh": 2.9,
                "tintHue": 68,
                "tintStrength": 0,
                "lift": 0,
                "gamma": -0.15,
                "gain": 0,
                "tintAxis": [1.27, 0.57, 0]
            }
        }, {
            "name": "Palette Synth",
            "config": {
                "paletteSize": 22,
                "deltaL": 28.5,
                "gammaC": 1,
                "cycleOffset": 0,
                "softness": 3.2,
                "blendK": 2,
                "lumaWeight": 1.04,
                "chromaWeight": 0.98,
                "hueWeight": 0.33,
                "selectWeights": [0, 0, 0, 0.2],
                "assignMode": "blend",
                "blendAmount": 1,
                "BLENDMODE": "10",
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": "1",
                "showPalette": "none",
                "chromaBoost": 1,
                "blockSize": 2,
                "seed": 1,
                "weightL": 0.2,
                "useFurthest": true,
                "doMerge": true
            }
        }]
    },
    {
        "name": "Under the Rift",
        "config": [
            {
                "name": "Wave Distortion",
                "config": {
                    "amplitude": 0.5,
                    "frequency": 0.4,
                    "direction": "horizontal"
                }
            },
            {
                "name": "Contour Synth",
                "config": {
                    "freq": 0.3190439989799574,
                    "freqScale": 7.249460795278276,
                    "phaseScale": 3.18256855947942,
                    "blend": 0.22,
                    "phaseOff": 25.5,
                    "spatialMode": "radial",
                    "colorMode": "none",
                    "hueModStrength": 0.63,
                    "waveform": "tri"
                }
            }
        ]
    },


    {
        "name": "Transfer Sunrise",
        "config": [{
            "name": "Posterize",
            "config": {
                "levels": 8,
                "mode": "1",
                "colorSpace": "0",
                "blendAmount": 1,
                "mod": 0.5,
                "c1": true,
                "c2": true,
                "c3": true
            }
        }, {
            "name": "Chromawave",
            "config": {
                "threshold": 0.37,
                "cycle": true,
                "cycleMode": "spatial",
                "hueShift": 1.26,
                "saturation": 34,
                "lightness": 48,
                "hueSpread": 0.6,
                "bleed": 0.77,
                "COLORSPACE": 0,
                "BLENDMODE": "1",
                "blendAmount": 1,
                "bandingSteps": 0,
                "waveType": "square",
                "dutyCycle": 0.5,
                "originX": 0.57,
                "originY": 0.42,
                "spatialPattern": "radial"
            }
        }, {
            "name": "Channel Mixer",
            "config": {
                "mix1": [1, 0, -0.04],
                "mix2": [0.4, 0.83, 0],
                "mix3": [0, -0.14, 1],
                "offset": [0, 0, 0],
                "colorSpace": "1"
            }
        }]
    },
    {
        "name": "Gouge Away",
        "config": [
            {
                "name": "Colorshred",
                "config": {
                    "density": 0.4,
                    "mode": 1
                }
            },
            {
                "name": "Pixel Sort",
                "config": {
                    "threshold": 0.4,
                    "direction": "horizontal",
                    "useR": true,
                    "useG": true,
                    "useB": true,
                    "perlin": false
                }
            }
        ]
    },
    {
        "name": "Detached Pastel",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.48,
                    "cycle": true,
                    "cycleMode": "brightness",
                    "hueShift": 208,
                    "saturation": 20,
                    "lightness": 57,
                    "hueSpread": 1.15,
                    "bleed": 0
                }
            },
            {
                "name": "Perlin Distort",
                "config": {
                    "boundMode": "clamp",
                    "pitchX": -0.98,
                    "pitchY": -0.76,
                    "freqX": 5.722920576554524,
                    "freqY": 0.25257086810163276,
                    "seed": 143,
                    "depth": 0.06,
                    "rate": 1.9581181956675286,
                    "rateDrive": 0,
                    "fc": [
                        8.25,
                        9.75,
                        15.75
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    noiseMode: "pseudo"
                }
            }
        ]
    },
    {
        "name": "Not Raining",
        "config": [
            {
                "name": "Perlin Distort",
                "config": {
                    "boundMode": "clamp",
                    "pitchX": -0.91,
                    "pitchY": 0,
                    "freqX": 9.069993561306088,
                    "freqY": 9.82365286443436,
                    "seed": 128,
                    "depth": 0.39,
                    "rate": 4,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "classic",
                    "clampScale": 0.5
                }
            },
            {
                "name": "Delay Line",
                "config": {
                    "delay": 5.74,
                    "window": "circle",
                    "falloff": "uniform",
                    "density": 1.6,
                    "angle": -99.23,
                    "shearX": 0,
                    "shearY": 0,
                    "scaleX": 1,
                    "scaleY": 1
                }
            },
            {
                "name": "Perlin Distort",
                "config": {
                    "boundMode": "clamp",
                    "pitchX": -1.23,
                    "pitchY": -0.1,
                    "freqX": 17.93629400332466,
                    "freqY": 14.810053228674818,
                    "seed": 251,
                    "depth": 0.5,
                    "rate": 4,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "classic",
                    "clampScale": 0.45
                }
            },
            {
                "name": "Delay Line",
                "config": {
                    "delay": 2.85,
                    "window": "box",
                    "falloff": "uniform",
                    "density": 2.1,
                    "angle": -99.23,
                    "shearX": 0,
                    "shearY": 0,
                    "scaleX": 1,
                    "scaleY": 1
                }
            },
            {
                "name": "Perlin Distort",
                "config": {
                    "boundMode": "clamp",
                    "pitchX": -1.07,
                    "pitchY": 0.11,
                    "freqX": 3.012220095961826,
                    "freqY": 4.452548829300998,
                    "seed": 182,
                    "depth": 0.55,
                    "rate": 4,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "classic",
                    "clampScale": 0.45
                }
            },
            {
                "name": "Channel Mixer",
                "config": {
                    "mix1": [
                        0.83,
                        0,
                        0
                    ],
                    "mix2": [
                        0,
                        1,
                        0
                    ],
                    "mix3": [
                        -0.14,
                        -0.04,
                        1
                    ],
                    "offset": [
                        0,
                        0,
                        0
                    ],
                    "colorSpace": '0'
                }
            }
        ]
    },

    {
        "name": "Failing Monitor",
        "config": [
            {
                "name": "Wave Distortion",
                "config": {
                    "amplitude": 0.05,
                    "frequency": 0.2,
                    "direction": "vertical"
                }
            },
            {
                "name": "Scanlines",
                "config": {
                    "lineSpacing": 135,
                    "intensity": 0.7,
                    "phase": 0.25
                }
            },
            {
                "name": "Chromatic Aberration",
                "config": {
                    "rdx": -3,
                    "rdy": 0,
                    "gdx": 0,
                    "gdy": 0,
                    "bdx": 0,
                    "bdy": 0
                }
            }
        ]
    },
    {
        "name": "Been There",
        "config": [{
            "name": "Desync Tiles",
            "config": {"tileSize": 60, "corruptionRate": 0.19, "maxOffset": 28, "freezeTiles": false}
        }, {
            "name": "Noise Mixer",
            "config": {
                "frequency": 1.8814068375361006,
                "freqShift": -0.15,
                "tint": [1, 1, 1],
                "seed": 208,
                "BLENDMODE": "1",
                "colorSpace": "1",
                "fc": [6, 15, 10],
                "components": [0.25, 0, 0.56, 0, 0, 0, 0],
                "blendAmount": 0.49,
                "colormap": "aqua_pink",
                "tintSpace": "RGB",
                "master": 0.49
            }
        }, {
            "name": "Auto Levels",
            "config": {"method": "percentile", "paramA": 55.5, "paramB": 100, "channelwise": true}
        }, {
            "name": "Pixel Sort",
            "config": {
                "threshold": 0.25,
                "direction": "horizontal",
                "useR": false,
                "useG": false,
                "useB": true,
                "perlin": false
            }
        }]
    },
    {
        "name": "Nagel",
        "config": [
            {
                "name": "Affine Transform",
                "config": {
                    "angle": {
                        "value": 23.13,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "shearX": 0,
                    "shearY": 0,
                    "scaleX": 1.0742140565555607,
                    "scaleY": 1,
                    "translateX": 0,
                    "translateY": 0,
                    "wrap": false
                }
            },
            {
                "name": "Pixel Sort",
                "config": {
                    "threshold": {
                        "value": 0.5,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "direction": "vertical",
                    "useR": true,
                    "useG": true,
                    "useB": true,
                    "perlin": false
                }
            },
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.28,
                    "cycle": false,
                    "cycleMode": "spatial",
                    "hueShift": 296,
                    "saturation": 60,
                    "lightness": 56,
                    "hueSpread": 0.4,
                    "bleed": 0.14
                }
            }
        ]
    },
    {
        "name": "Venetian Morning",
        "config": [
            {
                "name": "Invert",
                "config": {
                    "invert0": false,
                    "invert1": true,
                    "invert2": true,
                    "COLORSPACE": 1,
                    "mode": "lab",
                    "colorSpace": "1"
                }
            },
            {
                "name": "Mirrorband",
                "config": {
                    "bandSize": 0.25,
                    "orientation": 1,
                    "mirrorRate": 1,
                    "sBias": -0.5
                }
            }
        ]
    },

    {
        "name": "Blank",
        "config": []
    },

    {
        "name": "Blood Dragon",
        "config": [
            {
                "name": "Chromatic Aberration",
                "config": {
                    "rdx": 2,
                    "rdy": 0,
                    "gdx": -2,
                    "gdy": 1,
                    "bdx": 3,
                    "bdy": -1
                }
            },
            {
                "name": "Posterize",
                "config": {
                    "levels": 8,
                }
            },
            {
                "name": "Scanlines",
                "config": {
                    "lineSpacing": 225,
                    "intensity": 0.5,
                    "phase": 0.28
                }
            },
            {
                "name": "Colormap",
                "config": {
                    "colormap": "neon",
                    "reverse": false
                }
            }
        ]
    }, {
        "name": "Saudade",
        "config": [
            {
                "name": "Noise Mixer",
                "config": {
                    "frequency": 115.95100609902991,
                    "freqShift": 0.05,
                    "seed": 161,
                    "BLENDMODE": "10",
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "components": [
                        0.17,
                        0.03,
                        0.34,
                        0,
                        0.05,
                        0,
                        0
                    ],
                    "blur": 2
                }
            },
            {
                "name": "Auto Levels",
                "config": {
                    "method": "percentile",
                    "paramA": 1,
                    "paramB": 75,
                }
            },
            {
                "name": "Colormap",
                "config": {
                    "colormap": "cubehelix",
                    "reverse": false
                }
            }
        ]
    }, {
        "name": "Helium Afternoon",
        "config": [{
            "name": "Chromawave",
            "config": {
                "threshold": 0.3,
                "cycle": false,
                "cycleMode": "spatial",
                "hueShift": 1.55,
                "saturation": 71,
                "lightness": 65,
                "hueSpread": 0.6,
                "bleed": 0,
                "COLORSPACE": "0",
                "BLENDMODE": 1,
                "blendAmount": 0.39,
                "bandingSteps": 0,
                "waveType": 0,
                "dutyCycle": 0.5,
                "originX": 0.5,
                "originY": 0.5,
                "spatialPattern": "radial",
                "blendTarget": "0"
            }
        }, {
            "name": "Perlin Distort",
            "config": {
                "boundMode": "fract",
                "pitchX": 0.22,
                "pitchY": 0.32,
                "freqX": 0.6573439067386198,
                "freqY": 0.0748420839139603,
                "seed": 377,
                "depth": 0.35,
                "rate": 0,
                "rateDrive": 0,
                "fc": [6, 15, 10],
                "phase": [0, 0],
                "fuzz": 0,
                "noiseMode": "classic",
                "clampScale": 1.1
            }
        }, {
            "name": "Invert",
            "config": {
                "invert0": false,
                "invert1": true,
                "invert2": true,
                "COLORSPACE": 0,
                "mode": "2",
                "colorSpace": "1"
            }
        }, {"name": "B/C/S", "config": {"brightness": 0.1, "contrast": 1, "saturation": 0.84, "graypoint": 0.3}}]
    },
    {
        "name": "Untimely Met",
        "config": [
            {
                "name": "Perlin Distort",
                "config": {
                    "pitchX": -1.01,
                    "pitchY": 0.25,
                    "seed": 35,
                    "depth": 0.77,
                    "rate": 5.947282785909293,
                    "rateDrive": 0,
                    "fc": [
                        7.5,
                        17.25,
                        8.25
                    ],
                    "boundMode": "clamp"
                }
            },
            {
                "name": "Delay Line",
                "config": {
                    "delay": 8.62,
                    "window": "box",
                    "falloff": "uniform",
                    "density": 5.2,
                    "angle": -10.26,
                    "shearX": 0.3,
                    "shearY": -5,
                    "scaleX": 2.6,
                    "scaleY": 0.1
                }
            }
        ]
    },
    {
        "name": "Craquelure",
        "config": [
            {
                "name": "Colormap",
                "config": {
                    "colormap": "vaportrail",
                    "reverse": true
                }
            },
            {
                "name": "Contour Synth",
                "config": {
                    "freq": 2.0271722230442055,
                    "freqScale": 1.0044899294395582,
                    "phaseScale": 0.3152240342834747,
                    "blend": 0.59,
                    "phaseOff": 103.5,
                    "spatialMode": "xy",
                    "colorMode": "preserve",
                    "hueModStrength": 0.23,
                    "waveform": "sawtooth"
                }
            }
        ]
    },
    {
        "name": "Ardor",
        "config": [
            {
                "name": "Noise Mixer",
                "config": {
                    "frequency": 30.744329067236027,
                    "freqShift": -0.07,
                    "seed": 280,
                    "BLENDMODE": 9,
                    "fc": [
                        5,
                        13.75,
                        8.25
                    ],
                    "components": [
                        0,
                        0.44,
                        0,
                        0,
                        0.39,
                        0,
                        0
                    ],
                    "blur": 0
                }
            },
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.215,
                    "cycle": true,
                    "cycleMode": "brightness",
                    "hueShift": 70,
                    "saturation": 91,
                    "lightness": 49,
                    "hueSpread": 0.85,
                    "bleed": 0.31
                }
            },
            {
                "name": "Channel Mixer",
                "config": {
                    "colorSpace": '1',
                    "mixMatrix": [
                        [
                            1,
                            -0.05,
                            -0.09
                        ],
                        [
                            0.1,
                            0.8,
                            0.06
                        ],
                        [
                            -0.3,
                            0.28,
                            1
                        ]
                    ],
                    "offset": [
                        0,
                        0,
                        0
                    ],
                    "BLENDMODE": 1,
                    "blendAmount": 0.8
                }
            }
        ]
    },
    {
        "name": "Nickelodeon",
        "config": [
            {
                "name": "Noise Mixer",
                "config": {
                    "frequency": 70.25175969985042,
                    "freqShift": 0.15,
                    "tint": [
                        0.7,
                        0.33,
                        0.42
                    ],
                    "seed": 314,
                    "BLENDMODE": "10",
                    "tintSpace": "HSV",
                    "fc": [
                        7,
                        14.75,
                        11.75
                    ],
                    "components": [
                        0,
                        0.81,
                        0.23,
                        0,
                        0,
                        0,
                        0
                    ],
                    "master": 0.49,
                    "blur": 0
                }
            }
        ]
    },
    {
        "name": "Thrifted Lava",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.2,
                    "cycle": false,
                    "cycleMode": "spatial",
                    "hueShift": 188,
                    "saturation": 100,
                    "lightness": 50,
                    "hueSpread": 0.55,
                    "bleed": 0.88
                }
            },
            {
                "name": "Perlin Distort",
                "config": {
                    "boundMode": "fract",
                    "pitchX": -1.41,
                    "pitchY": {
                        "value": -1.06,
                        "mod": {
                            "type": "sine",
                            "freq": 0.01,
                            "phase": 0,
                            "rangeMode": "bipolar",
                            "scale": 2,
                            "offset": 0
                        }
                    },
                    "freqX": 3.3599009346722157,
                    "freqY": 5.959923872645924,
                    "seed": 381,
                    "depth": 0.44,
                    "rate": 4,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "classic"
                }
            }
        ]
    },
    {
        "name": "Vintage Lava",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.2,
                    "cycle": false,
                    "cycleMode": "spatial",
                    "hueShift": 188,
                    "saturation": 100,
                    "lightness": 50,
                    "hueSpread": 0.55,
                    "bleed": 0.88
                }
            },
            {
                "name": "Perlin Distort",
                "config": {
                    "boundMode": "fract",
                    "pitchX": -1.41,
                    "pitchY": {
                        "value": -1.06,
                        "mod": {
                            "type": "sine",
                            "freq": 0.01,
                            "phase": 0,
                            "rangeMode": "bipolar",
                            "scale": 2,
                            "offset": 0
                        }
                    },
                    "freqX": 3.3599009346722157,
                    "freqY": 5.959923872645924,
                    "seed": 381,
                    "depth": 0.44,
                    "rate": 4,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "classic"
                }
            }
        ]
    },
    {
        "name": "When Crayon",
        "config": [
            {
                "name": "Contour Synth",
                "config": {
                    "freq": 1,
                    "freqScale": 0.7780101850886281,
                    "phaseScale": 1.3454242035217665,
                    "blend": 0.36,
                    "phaseOff": -94.5,
                    "spatialMode": "none",
                    "colorMode": "pass",
                    "hueModStrength": 0.5
                }
            },
            {
                "name": "Noise Mixer",
                "config": {
                    "frequency": 74.06700812523023,
                    "freqShift": -0.01,
                    "tint": [
                        1,
                        1,
                        1
                    ],
                    "seed": 374,
                    "BLENDMODE": "9",
                    "colorSpace": "0",
                    "fc": [
                        5.75,
                        15,
                        10
                    ],
                    "components": [
                        0,
                        0.25,
                        0.45,
                        0,
                        0,
                        0,
                        0
                    ],
                    "blendAmount": 0.5,
                    "colormap": "inferno",
                    "tintSpace": "RGB",
                    "master": 0.69
                }
            },
            {
                "name": "B/C/S",
                "config": {
                    "brightness": 0,
                    "contrast": 1,
                    "saturation": 0.83,
                    "graypoint": 0.3
                }
            }
        ]
    },
    {
        "name": "Sheen",
        "config": [
            {
                "name": "Look",
                "config": {
                    "exposure": 1.05,
                    "toneShoulder": -1.25,
                    "toneCenter": 0.7,
                    "chromaWeight": 1.01,
                    "chromaFadeLow": -1.7,
                    "chromaFadeHigh": 4.1,
                    "tintAxis": [
                        0.55,
                        0.14,
                        0.18
                    ],
                    "tintStrength": 0.47
                }
            },
            {
                "name": "Noise Mixer",
                "config": {
                    "frequency": 206.5833893106919,
                    "freqShift": 0,
                    "tint": [
                        1,
                        1,
                        1
                    ],
                    "seed": {
                        "value": 1,
                        "mod": {
                            "type": "sine",
                            "freq": 0.5,
                            "phase": 0,
                            "rangeMode": "bipolar",
                            "scale": 500,
                            "offset": 249.5
                        }
                    },
                    "BLENDMODE": "5",
                    "BLEND_CHANNEL_MODE": "0",
                    "COLORSPACE": "1",
                    "components": [
                        0.68,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0
                    ],
                    "blendAmount": 0.38,
                    "colormap": "inferno",
                    "threshold": 0.585,
                    "cutoff": 0.78,
                    "gate": "1",
                    "burstThreshold": 0.1,
                    "burstFreq": 100,
                    "burstTheta": 0.52,
                    "burstDTheta": 0,
                    "ZONESHAPE": 2,
                    "zoneCX": 0.5,
                    "zoneSX": 0.6,
                    "zoneCY": 0.5,
                    "zoneSY": 0.6,
                    "zoneEllipseN": 2,
                    "zoneSoftness": 0.1,
                    "zoneAngle": 0,
                    "APPLY_MASK": false,
                    "burstModType": "simplex"
                }
            }
        ]
    },
    {
        "name": "Twitching Impressions",
        "config": [
            {
                "name": "flow()",
                "config": {
                    "BLENDMODE": "8",
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": "6",
                    "blendAmount": 1,
                    "warpStrength": 3.7,
                    "directionStrength": {
                        "value": 4.303666086524201,
                        "mod": {
                            "type": "impulse",
                            "freq": 5.949678,
                            "phase": 0,
                            "scale": 14.84,
                            "offset": 10
                        }
                    },
                    "u_directionChannel": 4,
                    "magChannel": "5",
                    "directionPolarity": false,
                    "magPolarity": false,
                    "threshLow": 0,
                    "threshHigh": 0.695,
                    "magGamma": 1.1480489088912065,
                    "kernelName": "gaussian",
                    "kernelRadiusX": 3,
                    "kernelRadiusY": 3,
                    "kernelSoftness": 10,
                    "directionChannel": "4"
                }
            }
        ]
    },
    {
        "name": "Black Light Party",
        "config": [{
            "name": "Invert",
            "config": {"invert0": false, "invert1": true, "invert2": true, "colorSpace": 1}
        }, {
            "name": "Noise Mixer",
            "config": {
                "frequency": 28.355256795885165,
                "freqShift": -0.05,
                "tint": [0, 1, 0],
                "seed": 160,
                "BLENDMODE": 10,
                "COLORSPACE": "0",
                "fc": [6, 14.75, 10],
                "components": [0, 0, 0.73, 0, 0, 0, 0],
                "blendAmount": 0.44,
                "colormap": "none",
                "tintSpace": "RGB",
                "master": 0.6,
            }
        }, {
            "name": "Look",
            "config": {
                "exposure": -0.95,
                "toneShoulder": -1.2,
                "toneCenter": 0.58,
                "chromaWeight": 4,
                "chromaFadeLow": -6,
                "chromaFadeHigh": -3.9,
                "tintAxis": [1.04, 1, 0.96],
                "tintStrength": 0
            }
        }]
    },
    {
        "name": "Puzzling",
        "config": [
            {
                "name": "Auto Levels",
                "config": {
                    "paramA": 25,
                    "paramB": 90,
                    "mode": "channelwise"
                }
            },
            {
                "name": "Pixelate",
                "config": {
                    "blockSize": 44,
                    "sampleStrategy": "center",
                    "preserveAlpha": true
                }
            },
            {
                "name": "Perlin Distort",
                "config": {
                    "boundMode": "clamp",
                    "pitchX": 0,
                    "pitchY": 0,
                    "freqX": 18.63212537688127,
                    "freqY": 17.597682203195408,
                    "seed": 145,
                    "depth": 0.07,
                    "rate": 5.049024392298793,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "phase": [
                        0,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "classic",
                    "clampScale": 1.15
                }
            },
        ]
    },
    {
        "name": "Surface Tension",
        "config": [
            {
                "name": "Perlin Distort",
                "config": {
                    "boundMode": "fract",
                    "pitchX": {
                        "value": 0.91,
                        "mod": {
                            "type": "saw",
                            "freq": 0.05433084042407615,
                            "phase": 0,
                            "scale": -1.8719999999999999,
                            "offset": 0
                        }
                    },
                    "pitchY": 0,
                    "freqX": 4,
                    "freqY": 4,
                    "seed": 231,
                    "depth": 0.66,
                    "rate": 4,
                    "rateDrive": 0,
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "reps": [
                        5,
                        5
                    ],
                    "phase": [
                        0.595,
                        0
                    ],
                    "fuzz": 0,
                    "noiseMode": "pseudo",
                    "clampScale": 1,
                    "BLENDMODE": "2",
                    "BLEND_CHANNEL_MODE": "4",
                    "COLORSPACE": "2",
                    "chromaBoost": 4,
                    "blendAmount": 0.88
                }
            },
            {
                "name": "flow()",
                "config": {
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": 0,
                    "blendAmount": 1,
                    "warpStrength": 0.67,
                    "directionAngle": {
                        "value": 1.6022122533308,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "modAmount": 0.54,
                    "driverChannel": "4",
                    "modulatorChannel": "0",
                    "driverPolarity": false,
                    "modulatorPolarity": true,
                    "threshLow": 0,
                    "threshHigh": 1,
                    "driverGamma": 0.14382963360314993,
                    "flatThreshold": false
                }
            },
            {
                "name": "Affine Transform",
                "config": {
                    "angle": 0,
                    "shearX": 0,
                    "shearY": 0,
                    "scaleX": "0.886148047765198",
                    "scaleY": "0.886148047765198",
                    "translateX": 0,
                    "translateY": -0.14,
                    "wrap": true
                }
            }
        ]
    },
    {
        "name": "Night City Waterfall",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.28,
                    "cycle": true,
                    "cycleMode": "spatial",
                    "hueShift": 143,
                    "saturation": 65,
                    "lightness": 42,
                    "hueSpread": 1.85,
                    "bleed": 0
                }
            },
            {
                "name": "Noise Mixer",
                "config": {
                    "frequency": 50,
                    "freqShift": 0,
                    "tint": [
                        1,
                        1,
                        0.42
                    ],
                    "seed": 321,
                    "BLENDMODE": "9",
                    "colorSpace": "0",
                    "fc": [
                        6,
                        15,
                        10
                    ],
                    "components": [
                        0.25,
                        0,
                        0,
                        0.22,
                        0,
                        0,
                        0
                    ],
                    "blendAmount": 0.5,
                    "colormap": "aqua_pink",
                    "tintSpace": "RGB",
                    "master": 1
                }
            },
            {
                "name": "Pixel Sort",
                "config": {
                    "threshold": 0.5,
                    "direction": "vertical",
                    "useR": false,
                    "useG": false,
                    "useB": true,
                    "perlin": false
                }
            },
            {
                "name": "Auto Levels",
                "config": {
                    "paramA": 1,
                    "paramB": 100,
                    "mode": "channelwise"
                }
            }
        ]
    },
    {
        "name": "Something Unpleasant",
        "config": [
            {
                "name": "Chromatic Aberration",
                "config": {
                    "BLENDMODE": 1,
                    "COLORSPACE": "5",
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 0.56,
                    "chromaBoost": 1,
                    "rdx": 3,
                    "rdy": -2,
                    "gdx": 5,
                    "gdy": 0,
                    "bdx": 0,
                    "bdy": 4
                }
            },
            {
                "name": "Bad TV",
                "config": {
                    "BLENDMODE": "10",
                    "COLORSPACE": "5",
                    "BLEND_CHANNEL_MODE": "0",
                    "blendAmount": 1,
                    "tearAmount": 0.61,
                    "flickerAmount": 0,
                    "jitter": 0.34,
                    "t_": {
                        "value": 0,
                        "mod": {
                            "type": "saw",
                            "freq": 0.011158323519625372,
                            "phase": 0,
                            "scale": 0.2010619298297468,
                            "offset": 3.141592653589793
                        }
                    },
                    "bias": 0.27,
                    "scale": 262,
                    "seed": 315,
                    "chunks": 28,
                    "tearMode": "band",
                    "ghostOffset": 0.05,
                    "noiseAmount": 0.53,
                    "chromaBoost": 2.175
                }
            }
        ]
    },
    {
        "name": "Not Raining 2",
        "config": [{
            "name": "Warp Zone",
            "config": {
                "COLORSPACE": 0,
                "BLENDMODE": 1,
                "blendAmount": 1,
                "BLEND_CHANNEL_MODE": 0,
                "ZONESHAPE": "2",
                "zoneCX": 0.5,
                "zoneSX": 1,
                "zoneCY": 0.5,
                "zoneSY": 1,
                "zoneEllipseN": 2,
                "zoneSoftness": 1,
                "WARPMODE": "sine",
                "paramA": 0,
                "paramB": 0,
                "warpStrength": 2,
                "PREBLEND_WARP_CHANNEL": 2,
                "WARPDRIVE_COLORSPACE": 6,
                "WARPDRIVE_MODE": 0,
                "WARPDRIVE_CHANNEL": 2,
                "zoneAngle": 0,
                "warpAngle": {
                    "value": 3.29867228626928,
                    "mod": {
                        "type": "sine",
                        "freq": 4.5009999999999994,
                        "phase": 0,
                        "scale": 0.21652170727806208,
                        "offset": 3.141592653589793
                    }
                },
                "chromaBoost": 1
            }
        }, {
            "name": "Perlin Distort",
            "config": {
                "boundMode": "clamp",
                "pitchX": {
                    "value": 0.12,
                    "mod": {
                        "type": "hold",
                        "freq": 0.1378066970214855,
                        "phase": 0,
                        "scale": 0.5840000000000001,
                        "offset": 0
                    }
                },
                "pitchY": -0.37,
                "freqX": 21.680709887174068,
                "freqY": 20.101434551747126,
                "seed": {
                    "value": 52,
                    "mod": {
                        "type": "hold",
                        "freq": 7.605309999999999,
                        "phase": 0,
                        "scale": 16.968000000000004,
                        "offset": 250.5
                    }
                },
                "depth": {
                    "value": 0.08,
                    "mod": {
                        "type": "sine",
                        "freq": 4.5009999999999994,
                        "phase": 0,
                        "scale": 0.03200000000000001,
                        "offset": 0.38
                    }
                },
                "rate": 4,
                "rateDrive": 0,
                "fc": [6, 15, 10],
                "reps": [5, 5],
                "phase": [0, 0],
                "fuzz": 0,
                "noiseMode": "pseudo",
                "clampScale": 0.7,
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": 0,
                "chromaBoost": 1,
                "blendAmount": 0.78
            }
        }, {
            "name": "2D Kernel",
            "config": {
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": 0,
                "blendAmount": 0.34,
                "chromaBoost": 1,
                "kernelName": "gaussian",
                "kernelRadiusX": 3,
                "kernelRadiusY": 3,
                "kernelSoftness": 3.28,
                "BLENDTARGET": 0
            }
        }, {
            "name": "Perlin Distort",
            "config": {
                "boundMode": "clamp",
                "pitchX": -1.23,
                "pitchY": -0.1,
                "freqX": 17.93629400332466,
                "freqY": 14.810053228674818,
                "seed": {
                    "value": 173,
                    "mod": {"type": "hold", "freq": 4.653966, "phase": 0, "scale": 34.487323136, "offset": 250.5}
                },
                "depth": {
                    "value": 0.24,
                    "mod": {
                        "type": "sine",
                        "freq": 0.660772888034983,
                        "phase": 0,
                        "scale": 0.05191149999999999,
                        "offset": 0.5
                    }
                },
                "rate": 4,
                "rateDrive": 0,
                "fc": [6, 15, 10],
                "reps": [5, 5],
                "phase": [0, 0],
                "fuzz": 0,
                "noiseMode": "pseudo",
                "clampScale": 1,
                "BLENDMODE": "1",
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": 0,
                "chromaBoost": 1,
                "blendAmount": 0.41
            }
        }, {
            "name": "Perlin Distort",
            "config": {
                "boundMode": "clamp",
                "pitchX": -0.98,
                "pitchY": 0.97,
                "freqX": {"value": 3.6352597211487447, "mod": {"type": "none"}},
                "freqY": 7.257172768093142,
                "seed": {
                    "value": 304,
                    "mod": {
                        "type": "hold",
                        "freq": 0.25263795805690975,
                        "phase": 0,
                        "scale": 28.939051915999997,
                        "offset": 250.5
                    }
                },
                "depth": {
                    "value": 0.29,
                    "mod": {"type": "sine", "freq": 0.09094797287833602, "phase": 0, "scale": 0.070304, "offset": 0.5}
                },
                "rate": 4,
                "rateDrive": 0,
                "fc": [6, 15, 10],
                "reps": [5, 5],
                "phase": [0, 0],
                "fuzz": 0,
                "noiseMode": "pseudo",
                "clampScale": 0.85,
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": 0,
                "chromaBoost": 1,
                "blendAmount": 0.68
            }
        }, {
            "name": "2D Kernel",
            "config": {
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": 0,
                "blendAmount": 0.34,
                "chromaBoost": 1,
                "kernelName": "gaussian",
                "kernelRadiusX": 3,
                "kernelRadiusY": 3,
                "kernelSoftness": 3.28,
                "BLENDTARGET": 0
            }
        }, {
            "name": "Channel Mixer",
            "config": {
                "mix1": [0.83, 0, 0],
                "mix2": [0, 1, 0],
                "mix3": [-0.14, -0.04, 1],
                "offset": [0, 0, 0],
                "COLORSPACE": 1,
                "colorSpace": "0"
            }
        }]
    },
    {
        "name": "Powder",
        "config": [
            {
                "name": "Posterize",
                "config": {
                    "levels": 8,
                    "mode": "2",
                    "colorSpace": "1",
                    "blendAmount": 1,
                    "mod": 0.25,
                    "c1": true,
                    "c2": false,
                    "c3": false
                }
            },
            {
                "name": "Colormap",
                "config": {
                    "colormap": "blush",
                    "reverse": true
                }
            },
            {
                "name": "Delay Line",
                "config": {
                    "delay": {
                        "value": 172.44,
                        "mod": {
                            "type": "sine",
                            "freq": 0.09,
                            "phase": 0,
                            "scale": 16.88,
                            "offset": 47.62
                        }
                    },
                    "window": "circle",
                    "falloff": "quadratic",
                    "density": {
                        "value": 2.3,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "angle": {
                        "value": -37.27,
                        "mod": {
                            "type": "sine",
                            "freq": 0.01,
                            "phase": 0,
                            "scale": 142.73,
                            "offset": -37.27
                        }
                    },
                    "shearX": -4,
                    "shearY": -1.2,
                    "scaleX": 1.5,
                    "scaleY": 0.3
                }
            },
            {
                "name": "Look",
                "config": {
                    "exposure": 0.9,
                    "toneShoulder": -0.15,
                    "toneCenter": 2,
                    "chromaWeight": 1.33,
                    "chromaFadeLow": -1.6,
                    "chromaFadeHigh": 3.4,
                    "tintAxis": [
                        1.04,
                        1,
                        0.96
                    ],
                    "tintStrength": 0.02
                }
            }
        ]
    },
    {
        "name": "NTSC Glass",
        "config": [
            {
                "name": "Bad TV",
                "config": {
                    "BLENDMODE": "1",
                    "COLORSPACE": "5",
                    "BLEND_CHANNEL_MODE": "2",
                    "blendAmount": 1,
                    "tearAmount": 0.25,
                    "flickerAmount": 0.19,
                    "jitter": 0.39,
                    "t_": {
                        "value": 3.11645991236107,
                        "mod": {
                            "type": "saw",
                            "freq": 0.03,
                            "phase": 0,
                            "scale": 0.2,
                            "offset": 1.62
                        }
                    },
                    "bias": 0.065,
                    "scale": 943.375,
                    "seed": 102,
                    "chunks": 2,
                    "tearMode": "chunk",
                    "ghostOffset": 0.3,
                    "noiseAmount": 0.22
                }
            },
            {
                "name": "Posterize",
                "config": {
                    "levels": {
                        "value": 9,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "mode": "3",
                    "COLORSPACE": "0",
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 1,
                    "mod": 0.86,
                    "c1": true,
                    "c2": true,
                    "c3": true
                }
            },
            {
                "name": "Desync Tiles",
                "config": {
                    "BLENDMODE": 1,
                    "COLORSPACE": 0,
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 1,
                    "tileCountX": {
                        "value": 10,
                        "mod": {
                            "type": "square",
                            "freq": 0.5,
                            "phase": 0,
                            "scale": 100,
                            "offset": 49.5
                        }
                    },
                    "tileCountY": 10,
                    "offsetAmount": 0.1,
                    "seed": 0
                }
            }
        ]
    },
    {
        "name": "Conte Brush",
        "config": [{
            "name": "Noise Mixer",
            "config": {
                "frequency": 44.734163413665485,
                "freqShift": 0,
                "tint": [0.56, 0.42, 0.28],
                "seed": 297,
                "BLENDMODE": "1",
                "colorSpace": "0",
                "fc": [6, 15, 10],
                "components": [0, 0, 0, 1, 0, 0, 0],
                "blendAmount": 0.41,
                "colormap": "sunset",
                "tintSpace": "HSV",
                "master": 0.73
            }
        }, {
            "name": "Delay Line",
            "config": {
                "delay": 16.86,
                "window": "box",
                "falloff": "diagonal",
                "density": 4.1,
                "angle": 0,
                "shearX": -2.7,
                "shearY": -1,
                "scaleX": 0.4,
                "scaleY": 0.3
            }
        }, {"name": "Auto Levels", "config": {"method": "stddev", "paramA": 2.5, "paramB": 98.5, "channelwise": true}}]
    },
    {
        "name": "Mirror Stage",
        "config": [{
            "name": "Look",
            "config": {
                "exposure": -0.1,
                "toneShoulder": 1.92,
                "toneCenter": -1.25,
                "curveStrength": 1,
                "chromaWeight": 1.31,
                "chromaFadeLow": -6,
                "chromaFadeHigh": 6,
                "tintHue": 68,
                "tintStrength": 0,
                "lift": 0,
                "gamma": 0,
                "gain": 0,
                "tintAxis": [0.96, 1, 0.96]
            }
        }, {
            "name": "Posterize",
            "config": {
                "levels": 12,
                "mode": "1",
                "COLORSPACE": 0,
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "blendAmount": 0.56,
                "mod": 0.5,
                "c1": true,
                "c2": false,
                "c3": false,
                "chromaBoost": 1,
                "colorSpace": "1"
            }
        }, {
            "name": "Perlin Distort",
            "config": {
                "boundMode": "clamp",
                "pitchX": {
                    "value": 0,
                    "mod": {"type": "sine", "freq": 0.01, "phase": 0, "rangeMode": "bipolar", "scale": 2, "offset": 0}
                },
                "pitchY": 0,
                "freqX": {
                    "value": 3.982172218161989,
                    "mod": {
                        "type": "sine",
                        "freq": 0.12,
                        "phase": 0,
                        "rangeMode": "bipolar",
                        "scale": 0.17,
                        "offset": 3.98
                    }
                },
                "freqY": {
                    "value": 3.982172218161989,
                    "mod": {
                        "type": "sine",
                        "freq": 0.01,
                        "phase": 0,
                        "rangeMode": "bipolar",
                        "scale": 2.05,
                        "offset": 3.98
                    }
                },
                "seed": 192,
                "depth": {"value": 0.5, "mod": {"type": "sine", "freq": 0.06, "phase": 0, "scale": 1, "offset": 0.1}},
                "rate": 0.7398770712450367,
                "rateDrive": 0,
                "fc": [5.5, 7, 6.75],
                "reps": [5, 5],
                "phase": [0, 0],
                "fuzz": 0,
                "noiseMode": "pseudo",
                "clampScale": 0.5,
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": 0,
                "chromaBoost": 1,
                "blendAmount": 1
            }
        }]
    },
    {
        "name": "Crew Mosaic",
        "config": [
            {
                "name": "Pixelate",
                "config": {
                    "blockSize": 44,
                    "sampleStrategy": "center",
                    "preserveAlpha": true
                }
            },
            {
                "name": "Contour Synth",
                "config": {
                    "freq": 2.992973354685282,
                    "freqScale": 0.9106275029062469,
                    "phaseScale": 1.8154937020529025,
                    "blend": 0.44,
                    "phaseOff": -102,
                    "spatialMode": "xy",
                    "colorMode": "pass",
                    "hueModStrength": 0.5,
                    "waveform": "sawtooth"
                }
            },
            {
                "name": "Wave Distortion",
                "config": {
                    "amplitude": 0.05,
                    "frequency": 1,
                    "direction": "vertical"
                }
            }
        ]
    },
    {
        "name": "Lean Close",
        "config": [{
            "name": "Bloom",
            "config": {
                "BLENDMODE": "1",
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": "6",
                "blendAmount": 1,
                "bloomThreshold": {
                    "value": 0.56,
                    "mod": {"type": "saw", "freq": 4, "phase": 0, "rangeMode": "bipolar", "scale": 0.06, "offset": 0.78}
                },
                "bloomSoftness": 0.27,
                "bloomStrength": 0.69,
                "kernelName": "sinc",
                "kernelRadius": 20,
                "kernelSoftness": {
                    "value": 8.79,
                    "mod": {
                        "type": "sine",
                        "freq": 3.32,
                        "phase": 0,
                        "rangeMode": "bipolar",
                        "scale": 1.89,
                        "offset": 9.5
                    }
                },
                "BLOOM_MODE": "0",
                "BLOOM_CHROMA_TAIL": true,
                "chromaOffset": [2.1, -4.95, 1.78],
                "chromaBoost": 1,
                "BLENDTARGET": "4"
            }
        }, {
            "name": "Look",
            "config": {
                "exposure": 0.15,
                "toneShoulder": 2.48,
                "toneCenter": -0.95,
                "curveStrength": 1,
                "chromaWeight": 1.35,
                "chromaFadeLow": -2.3,
                "chromaFadeHigh": 3.5,
                "tintHue": 68,
                "tintStrength": 0.16,
                "lift": 0,
                "gamma": 0,
                "gain": 0,
                "tintAxis": [1.27, 0.72, -1.1]
            }
        }, {
            "name": "Warp Zone",
            "config": {
                "COLORSPACE": 0,
                "BLENDMODE": "1",
                "blendAmount": {
                    "value": 1,
                    "mod": {
                        "type": "sine",
                        "freq": 0.08,
                        "phase": 0,
                        "rangeMode": "bipolar",
                        "scale": 0.2,
                        "offset": 0.75
                    }
                },
                "BLEND_CHANNEL_MODE": "0",
                "ZONESHAPE": 2,
                "zoneCX": {
                    "value": 0.585,
                    "mod": {
                        "type": "sine",
                        "freq": 0.04,
                        "phase": 0,
                        "rangeMode": "bipolar",
                        "scale": 0.2,
                        "offset": 0.5
                    }
                },
                "zoneSX": 1.35,
                "zoneCY": 0.48,
                "zoneSY": 0.72,
                "zoneEllipseN": 4.813,
                "zoneSoftness": 0.5,
                "WARPMODE": "lens",
                "paramA": 0,
                "paramB": 0,
                "warpStrength": 7,
                "PREBLEND_WARP_CHANNEL": 2,
                "WARPDRIVE_COLORSPACE": "0",
                "WARPDRIVE_MODE": "0",
                "WARPDRIVE_CHANNEL": "1",
                "zoneAngle": 0,
                "warpAngle": 0,
                "chromaBoost": 1,
                "DEBUG_MASK": false
            }
        }]
    },
    {
        "name": "Neon Grille",
        "config": [{
            "name": "Grid Pattern",
            "config": {
                "lineWidth": 4.404701675429672,
                "spacingFactor": 1.2278914891318364,
                "phaseX": {"value": 0.67, "mod": {"type": "none"}},
                "phaseY": {"value": 0, "mod": {"type": "none"}},
                "direction": "horizontal",
                "mode": "binary",
                "BLENDMODE": "1",
                "BLEND_CHANNEL_MODE": "0",
                "COLORSPACE": 0,
                "blendAmount": 0.51,
                "invert": true,
                "noiseScale": 0.01,
                "noiseAmount": 0,
                "skew": 0,
                "lumaMod": -0.26,
                "lumaThreshold": 0.255,
                "lumaSoftness": 0,
                "channelPhase0": 0,
                "channelPhase1": 0,
                "channelPhase2": 0,
                "color": [1, 0, 1],
                "lumaAngle": 0.15
            }
        }, {
            "name": "Look",
            "config": {
                "exposure": 1.65,
                "toneShoulder": -2.8,
                "toneCenter": 1.26,
                "chromaWeight": 1,
                "chromaFadeLow": -6,
                "chromaFadeHigh": 2.4,
                "tintAxis": [1.27, 0.57, 0],
                "tintStrength": 0
            }
        }]
    },
    {
        "name": "Jumpscare",
        "config": [
            {
                "name": "Affine Transform",
                "config": {
                    "BLENDMODE": "9",
                    "COLORSPACE": 0,
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 1,
                    "chromaBoost": 1,
                    "angle": 0,
                    "shearX": {
                        "value": 0,
                        "mod": {
                            "type": "impulse",
                            "freq": 1.41024838985062,
                            "phase": 0,
                            "scale": -1.0244910000000003,
                            "offset": 0
                        }
                    },
                    "shearY": 0,
                    "scaleX": 1,
                    "scaleY": {
                        "value": 0.9754419586243441,
                        "mod": {
                            "type": "impulse",
                            "freq": 1.6749813774604023,
                            "phase": 0,
                            "scale": 4.6457337376,
                            "offset": 5.05
                        }
                    },
                    "translateX": 0,
                    "translateY": 0,
                    "wrap": false
                }
            },
            {
                "name": "2D Kernel",
                "config": {
                    "BLENDMODE": 1,
                    "BLENDTARGET": 0,
                    "COLORSPACE": 0,
                    "blendAmount": 1,
                    "chromaBoost": 1,
                    "kernelName": "flattop",
                    "kernelRadiusX": 2,
                    "kernelRadiusY": 7,
                    "kernelSoftness": 2.52
                }
            },
            {
                "name": "basis()",
                "config": {
                    "mix1": [
                        1,
                        -0.44,
                        0
                    ],
                    "mix2": [
                        -0.21,
                        0.91,
                        0.59
                    ],
                    "mix3": [
                        0.23,
                        0.39,
                        -0.02
                    ],
                    "offset": [
                        -0.17,
                        0.26,
                        0
                    ],
                    "base1": [
                        0.39,
                        0.94,
                        0
                    ],
                    "base2": [
                        0,
                        1,
                        0
                    ],
                    "base3": [
                        0,
                        0,
                        1
                    ],
                    "base1Space": 0,
                    "base2Space": 0,
                    "base3Space": 0,
                    "CC_DEBUG_MODE": "0",
                    "CC_DEBUG_CHANNEL": 0,
                    "workSpace": 1,
                    "lastValidBasis": [
                        [
                            0.7042143216944913,
                            0.18958648054038946,
                            0.6842069537184464
                        ],
                        [
                            0.30521810802716604,
                            -0.9509345675274633,
                            -0.05064933181862943
                        ],
                        [
                            0.6410336150723155,
                            0.24450033676390925,
                            -0.727526968345266
                        ]
                    ],
                    "lastValidInverse": [
                        [
                            0.7042143216944937,
                            0.30521810802716687,
                            0.6410336150723176
                        ],
                        [
                            0.18958648054038868,
                            -0.950934567527463,
                            0.24450033676391025
                        ],
                        [
                            0.684206953718444,
                            -0.05064933181862798,
                            -0.7275269683452638
                        ]
                    ]
                }
            }
        ]
    },
    {
        "name": "Site Jitter",
        "config": [
            {
                "name": "Noise Mixer",
                "config": {
                    "frequency": 35.165954655638664,
                    "freqShift": 0,
                    "tint": [
                        1,
                        1,
                        1
                    ],
                    "seed": {
                        "value": 1,
                        "mod": {
                            "type": "sine",
                            "freq": 0.5,
                            "phase": 0,
                            "rangeMode": "bipolar",
                            "scale": 500,
                            "offset": 249.5
                        }
                    },
                    "BLENDMODE": "10",
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": "6",
                    "components": [
                        0.64,
                        0,
                        0,
                        0.29,
                        0,
                        0,
                        0
                    ],
                    "blendAmount": 0.5,
                    "colormap": "none",
                    "threshold": 0,
                    "cutoff": 1,
                    "gate": 0,
                    "burstThreshold": 0.1,
                    "burstFreq": 100,
                    "burstTheta": 0.52,
                    "burstDTheta": 0,
                    "ZONESHAPE": 2,
                    "zoneCX": 0.235,
                    "zoneSX": 0.2,
                    "zoneCY": 0.445,
                    "zoneSY": 0.21,
                    "zoneEllipseN": 2,
                    "zoneSoftness": 0.1,
                    "zoneAngle": 0,
                    "APPLY_MASK": true,
                    "burstModType": "simplex"
                }
            },
            {
                "name": "Warp Zone",
                "config": {
                    "COLORSPACE": "6",
                    "BLENDMODE": "6",
                    "blendAmount": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "ZONESHAPE": 2,
                    "zoneCX": 0.22,
                    "zoneSX": 0.26,
                    "zoneCY": 0.435,
                    "zoneSY": 0.245,
                    "zoneEllipseN": 2,
                    "zoneSoftness": 1,
                    "WARPMODE": "lens",
                    "paramA": 0,
                    "paramB": 0,
                    "warpStrength": -51,
                    "PREBLEND_WARP_CHANNEL": 2,
                    "WARPDRIVE_COLORSPACE": 6,
                    "WARPDRIVE_MODE": 0,
                    "WARPDRIVE_CHANNEL": 2,
                    "zoneAngle": 2.63893782901543,
                    "warpAngle": 2.79601746169492
                }
            }
        ]
    },
    {
        "name": "Someday",
        "config": [
            {
                "name": "Grid Pattern",
                "config": {
                    "lineWidth": 13.826194041024442,
                    "spacingFactor": 2.7589005745667357,
                    "phaseX": -0.04,
                    "phaseY": -0.49,
                    "direction": "grid",
                    "mode": "saw",
                    "BLENDMODE": "9",
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": "3",
                    "blendAmount": 0.42,
                    "invert": true,
                    "noiseScale": 0.1,
                    "noiseAmount": 0.3,
                    "skew": {
                        "value": -0.33,
                        "mod": {
                            "type": "saw",
                            "freq": 0.17,
                            "phase": 0,
                            "rangeMode": "bipolar",
                            "scale": 0.17,
                            "offset": -0.52
                        }
                    },
                    "lumaMod": 0,
                    "lumaThreshold": 0.225,
                    "lumaSoftness": 0,
                    "channelPhase0": 0.45,
                    "channelPhase1": -1,
                    "channelPhase2": -1,
                    "color": [
                        1,
                        1,
                        1
                    ],
                    "blendTarget": "0",
                    "colorSpace": "0"
                }
            },
            {
                "name": "Warp Zone",
                "config": {
                    "COLORSPACE": 0,
                    "BLENDMODE": 1,
                    "blendAmount": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "ZONESHAPE": 2,
                    "zoneCX": 0.5,
                    "zoneSX": 1,
                    "zoneCY": 0.5,
                    "zoneSY": 1,
                    "zoneEllipseN": 2,
                    "zoneSoftness": 0.955,
                    "WARPMODE": "lens",
                    "paramA": 0,
                    "paramB": 0,
                    "warpStrength": 25,
                    "PREBLEND_WARP_CHANNEL": 2,
                    "WARPDRIVE_COLORSPACE": "0",
                    "WARPDRIVE_MODE": "1",
                    "WARPDRIVE_CHANNEL": 2,
                    "zoneAngle": 0,
                    "warpAngle": {
                        "value": 4.68097305384879,
                        "mod": {
                            "type": "sine",
                            "freq": 0.01,
                            "phase": 0,
                            "rangeMode": "bipolar",
                            "scale": 6.28,
                            "offset": 3.14
                        }
                    }
                }
            }
        ]
    },
    {
        "name": "Undo (Moonlight)",
        "config": [
            {
                "name": "Invert",
                "config": {
                    "invert0": true,
                    "invert1": false,
                    "invert2": false,
                    "COLORSPACE": 0,
                    "mode": "2",
                    "colorSpace": "1"
                }
            },
            {
                "name": "Posterize",
                "config": {
                    "levels": 5,
                    "mode": "1",
                    "COLORSPACE": 0,
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 1,
                    "mod": 0.5,
                    "c1": false,
                    "c2": true,
                    "c3": true,
                    "colorSpace": "2"
                }
            }
        ]
    },
    {
        "name": "Mr. Johnson",
        "config": [
            {
                "name": "Edge Trace",
                "config": {
                    "BLENDMODE": "5",
                    "COLORSPACE": "5",
                    "BLEND_CHANNEL_MODE": "0",
                    "blendAmount": 0.85,
                    "threshold": 0.13,
                    "tint": [
                        0.38,
                        0.05,
                        0.63
                    ]
                }
            },
            {
                "name": "B/C/S",
                "config": {
                    "brightness": 0.01,
                    "contrast": 1,
                    "saturation": 0.9,
                    "graypoint": 0.3
                }
            }
        ]
    },
    {
        "name": "Line Ghosts",
        "config": [{
            "name": "2D Kernel",
            "config": {
                "BLENDMODE": "8",
                "BLENDTARGET": 0,
                "COLORSPACE": "0",
                "blendAmount": 1,
                "kernelName": "impulse",
                "kernelRadiusX": 8,
                "kernelRadiusY": 9,
                "kernelSoftness": 6.605
            }
        }, {
            "name": "flow()",
            "config": {
                "BLENDMODE": "4",
                "BLEND_CHANNEL_MODE": "4",
                "COLORSPACE": "2",
                "blendAmount": 1,
                "warpStrength": -0.73,
                "directionAngle": -1.4451326206513,
                "modAmount": 0.405,
                "driverChannel": "5",
                "modulatorChannel": "0",
                "driverPolarity": false,
                "modulatorPolarity": true,
                "threshLow": 0.17,
                "threshHigh": 0.4,
                "driverGamma": 0.7583998736407089,
                "flatThreshold": false
            }
        }]
    },
    {
        "name": "Gameboy",
        "config": [
            {
                "name": "Palette Synth",
                "config": {
                    "paletteSize": 16,
                    "weightL": 0.35,
                    "cycleOffset": 0,
                    "softness": 1,
                    "blendK": 3,
                    "useFurthest": true,
                    "lumaWeight": 0.88,
                    "chromaWeight": 1.4,
                    "hueWeight": 0.62,
                    "doMerge": true,
                    "assignMode": "blend",
                    "blendAmount": 1,
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": 0
                }
            },
            {
                "name": "Channel Mixer",
                "config": {
                    "mix1": [
                        1,
                        0,
                        0
                    ],
                    "mix2": [
                        -0.34,
                        0.99,
                        -0.14
                    ],
                    "mix3": [
                        0.02,
                        0,
                        1.1
                    ],
                    "offset": [
                        0,
                        0,
                        0
                    ],
                    "colorSpace": 1
                }
            }
        ]
    },
    {
        "name": "Lessening",
        "config": [{
            "name": "Posterize",
            "config": {
                "levels": 8,
                "mode": "2",
                "COLORSPACE": "4",
                "BLENDMODE": "10",
                "BLEND_CHANNEL_MODE": 0,
                "blendAmount": 1,
                "mod": 0.5,
                "c1": true,
                "c2": true,
                "c3": true,
                "chromaBoost": 1
            }
        }, {
            "name": "flow()",
            "config": {
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": 0,
                "blendAmount": 1,
                "warpStrength": -0.21,
                "directionStrength": 0.5,
                "directionChannel": 5,
                "magChannel": 0,
                "directionPolarity": false,
                "magPolarity": false,
                "threshLow": {
                    "value": 0.535,
                    "mod": {
                        "type": "walk",
                        "freq": 1.5378671720779535,
                        "phase": 0,
                        "scale": 0.354866144,
                        "offset": 0.533,
                        "_walkValue": 0.19748710763467564,
                        "_lastUpdate": 252.90000000000882
                    }
                },
                "threshHigh": 0.945,
                "magGamma": 1,
                "kernelName": "gaussian",
                "kernelRadiusX": 3,
                "kernelRadiusY": 3,
                "kernelSoftness": 10,
                "chromaBoost": 1,
                "directionAngle": -0.534070751110264,
                "modAmount": 0,
                "driverChannel": "1",
                "modulatorChannel": "5",
                "driverPolarity": true,
                "modulatorPolarity": false,
                "driverGamma": 1.1414812755524588,
                "flatThreshold": true
            }
        }]
    },
    {
        "name": "Dropped Textures",
        "config": [
            {
                "name": "Affine Transform",
                "config": {
                    "BLENDMODE": "2",
                    "COLORSPACE": "3",
                    "BLEND_CHANNEL_MODE": "2",
                    "blendAmount": {
                        "value": 0.7,
                        "mod": {
                            "type": "sine",
                            "freq": 0.22481875237483465,
                            "phase": 0,
                            "scale": 0.11017443199999999,
                            "offset": 0.204
                        }
                    },
                    "chromaBoost": 1.4125,
                    "angle": "0",
                    "shearX": "0.1",
                    "shearY": "-0.1",
                    "scaleX": "1.1082016542681",
                    "scaleY": "1.1082016542681",
                    "translateX": 0,
                    "translateY": "0",
                    "wrap": false
                }
            },
            {
                "name": "2D Kernel",
                "config": {
                    "BLENDMODE": "6",
                    "BLENDTARGET": 0,
                    "COLORSPACE": "4",
                    "blendAmount": 1,
                    "chromaBoost": 1,
                    "kernelName": "gabor",
                    "kernelRadiusX": 2,
                    "kernelRadiusY": 8,
                    "kernelSoftness": {
                        "value": 4.61,
                        "mod": {
                            "type": "sine",
                            "freq": 4.5009999999999994,
                            "phase": 0,
                            "scale": 1.608,
                            "offset": 10.5
                        }
                    },
                    "BLEND_CHANNEL_MODE": "0"
                }
            }
        ]
    },
    {
        "name": "Fog Glitch",
        "config": [{
            "name": "Colorshred",
            "config": {"density": 0.35, "INVERT_CHROMA_THRESHOLD": false}
        }, {
            "name": "Desync Tiles",
            "config": {
                "BLENDMODE": 1,
                "COLORSPACE": 0,
                "BLEND_CHANNEL_MODE": 0,
                "blendAmount": 1,
                "tileCountX": 50,
                "tileCountY": 50,
                "offsetAmount": 0.05,
                "seed": 10
            }
        }, {
            "name": "2D Kernel",
            "config": {
                "BLENDMODE": 1,
                "BLENDTARGET": 0,
                "COLORSPACE": 0,
                "blendAmount": 1,
                "kernelName": "gaussian",
                "kernelRadiusX": 5,
                "kernelRadiusY": 5,
                "kernelSoftness": 3.85
            }
        }]
    },
    {
        "name": "Rain like Sand",
        "config": [
            {
                "name": "Posterize",
                "config": {
                    "levels": 8,
                    "mode": "2",
                    "COLORSPACE": 0,
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 0.51,
                    "mod": 0.5,
                    "c1": true,
                    "c2": true,
                    "c3": true
                }
            },
            {
                "name": "flow()",
                "config": {
                    "BLENDMODE": "1",
                    "BLEND_CHANNEL_MODE": "1",
                    "COLORSPACE": "2",
                    "blendAmount": 1,
                    "warpStrength": 1.47,
                    "directionAngle": -1.539380400259,
                    "modAmount": 0.505,
                    "driverChannel": 0,
                    "modulatorChannel": "5",
                    "driverPolarity": false,
                    "modulatorPolarity": true,
                    "threshLow": 0.185,
                    "threshHigh": 0.4,
                    "driverGamma": 1.655170605255106,
                    "flatThreshold": false
                }
            }
        ]
    },

    {
        "name": "Affix",
        "config": [
            {
                "name": "Affine Transform",
                "config": {
                    "BLENDMODE": "9",
                    "COLORSPACE": 0,
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 1,
                    "chromaBoost": 1,
                    "angle": 0,
                    "shearX": {
                        "value": 0,
                        "mod": {
                            "type": "sine",
                            "freq": 4.5009999999999994,
                            "phase": 0,
                            "scale": -2.808,
                            "offset": 0
                        }
                    },
                    "shearY": 0,
                    "scaleX": 1,
                    "scaleY": {
                        "value": 0.9754419586243441,
                        "mod": {
                            "type": "sine",
                            "freq": 4.5009999999999994,
                            "phase": 0,
                            "scale": 0.41680000000000006,
                            "offset": 5.05
                        }
                    },
                    "translateX": 0,
                    "translateY": 0,
                    "wrap": false
                }
            },
            {
                "name": "basis()",
                "config": {
                    "mix1": [
                        1,
                        -0.44,
                        0
                    ],
                    "mix2": [
                        -0.21,
                        0.91,
                        0.59
                    ],
                    "mix3": [
                        0.23,
                        0.39,
                        -0.02
                    ],
                    "offset": [
                        -0.17,
                        0.26,
                        0
                    ],
                    "base1": [
                        0.39,
                        0.94,
                        0
                    ],
                    "base2": [
                        0,
                        1,
                        0
                    ],
                    "base3": [
                        0,
                        0,
                        1
                    ],
                    "base1Space": 0,
                    "base2Space": 0,
                    "base3Space": 0,
                    "CC_DEBUG_MODE": "0",
                    "CC_DEBUG_CHANNEL": 0,
                    "workSpace": 1,
                    "lastValidBasis": [
                        [
                            0.7042143216944913,
                            0.18958648054038946,
                            0.6842069537184464
                        ],
                        [
                            0.30521810802716604,
                            -0.9509345675274633,
                            -0.05064933181862943
                        ],
                        [
                            0.6410336150723155,
                            0.24450033676390925,
                            -0.727526968345266
                        ]
                    ],
                    "lastValidInverse": [
                        [
                            0.7042143216944937,
                            0.30521810802716687,
                            0.6410336150723176
                        ],
                        [
                            0.18958648054038868,
                            -0.950934567527463,
                            0.24450033676391025
                        ],
                        [
                            0.684206953718444,
                            -0.05064933181862798,
                            -0.7275269683452638
                        ]
                    ]
                }
            }
        ]
    },
    {
        "name": "Findings",
        "config": [{
            "name": "Mirrorband",
            "config": {
                "bandSize": 0.29,
                "orientation": 1,
                "mirrorRate": {
                    "value": 1,
                    "mod": {"type": "sine", "freq": 0.5783231773605787, "phase": 0, "scale": 0.605, "offset": 0.738}
                },
                "offset": 0.35,
                "noiseAmount": 0,
                "colorNoise": 0,
                "blendAmount": 0.88,
                "COLORSPACE": "8",
                "BLENDMODE": "10",
                "BLEND_CHANNEL_MODE": "1",
                "chromaBoost": 1,
                "seed": {
                    "value": 258,
                    "mod": {
                        "type": "hold",
                        "freq": 4.5009999999999994,
                        "phase": 0,
                        "scale": 16.000000000000004,
                        "offset": 250
                    }
                },
                "levels": 2,
                "rotationAmount": 1.25,
                "sBias": 0.5,
                "vBias": 0.86,
                "hue": 0,
                "colorBlend": "1"
            }
        }, {
            "name": "flow()",
            "config": {
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": 0,
                "blendAmount": 1,
                "warpStrength": {
                    "value": 1.45,
                    "mod": {
                        "type": "hold",
                        "freq": 1.4517663453033853,
                        "phase": 0,
                        "scale": 0.16000000000000014,
                        "offset": 0
                    }
                },
                "directionStrength": 3.5825756949558434,
                "directionChannel": "4",
                "magChannel": 0,
                "directionPolarity": false,
                "magPolarity": false,
                "threshLow": 0,
                "threshHigh": 0.23,
                "magGamma": 1,
                "kernelName": "gaussian",
                "kernelRadiusX": 3,
                "kernelRadiusY": 3,
                "kernelSoftness": 10,
                "chromaBoost": 1
            }
        }]
    },
    {
        "name": "Satflow",
        "config": [
            {
                "name": "Affine Transform",
                "config": {
                    "BLENDMODE": "10",
                    "COLORSPACE": 0,
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 0.39,
                    "chromaBoost": 1,
                    "angle": {
                        "value": 0,
                        "mod": {
                            "type": "sine",
                            "freq": 0.14375353127783347,
                            "phase": 0,
                            "scale": 2.1599999999999966,
                            "offset": 0
                        }
                    },
                    "shearX": 0,
                    "shearY": 0,
                    "scaleX": {
                        "value": 0.9754419586243441,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "scaleY": {
                        "value": 0.9754419586243441,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "translateX": 0,
                    "translateY": 0,
                    "wrap": true
                }
            },
            {
                "name": "flow()",
                "config": {
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": 0,
                    "blendAmount": 1,
                    "warpStrength": {
                        "value": 3.45,
                        "mod": {
                            "type": "sine",
                            "freq": 0.0930204568902073,
                            "phase": 0,
                            "scale": -4.68,
                            "offset": 0
                        }
                    },
                    "directionStrength": {
                        "value": 6.642623913567831,
                        "mod": {
                            "type": "saw",
                            "freq": 0.10868533648676124,
                            "phase": 0,
                            "scale": 14.5,
                            "offset": 10
                        }
                    },
                    "u_directionChannel": 4,
                    "magChannel": "5",
                    "directionPolarity": false,
                    "magPolarity": false,
                    "threshLow": {
                        "value": 0.065,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "threshHigh": 0.475,
                    "magGamma": 4.096394216229076,
                    "kernelName": "gaussian",
                    "kernelRadiusX": 3,
                    "kernelRadiusY": 3,
                    "kernelSoftness": 10,
                    "chromaBoost": 1,
                    "directionChannel": "0"
                }
            }
        ],

    },
    {
        "name": "Trapped in Ink",
        "config": [
            {
                "name": "basis()",
                "config": {
                    "mix1": [
                        0.68,
                        0.55,
                        0
                    ],
                    "mix2": [
                        0.31,
                        -0.35,
                        -0.18
                    ],
                    "mix3": [
                        -0.07,
                        0,
                        1
                    ],
                    "offset": [
                        -0.13,
                        0.12,
                        0.07
                    ],
                    "base1": [
                        0.42,
                        0.71,
                        0.08
                    ],
                    "base2": [
                        0,
                        1,
                        0.33
                    ],
                    "base3": [
                        0,
                        0,
                        1
                    ],
                    "base1Space": "1",
                    "base2Space": 0,
                    "base3Space": 0,
                    "CC_DEBUG_MODE": 0,
                    "CC_DEBUG_CHANNEL": 0,
                    "workSpace": 1,
                    "lastValidBasis": [
                        [
                            0.5067602388992434,
                            0.8566661181391971,
                            0.09652575979033208
                        ],
                        [
                            0.5601234448666801,
                            -0.41230055034520147,
                            0.7185192987635943
                        ],
                        [
                            -0.655328762363949,
                            0.3100506704030211,
                            0.6887763025839173
                        ]
                    ],
                    "lastValidInverse": [
                        [
                            0.5067602388992432,
                            0.5601234448666801,
                            -0.655328762363949
                        ],
                        [
                            0.8566661181391972,
                            -0.41230055034520163,
                            0.3100506704030214
                        ],
                        [
                            0.09652575979033212,
                            0.7185192987635941,
                            0.6887763025839172
                        ]
                    ]
                }
            },
            {
                "name": "flow()",
                "config": {
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": "4",
                    "blendAmount": 0.5,
                    "warpStrength": {
                        "value": 5,
                        "mod": {
                            "type": "sine",
                            "freq": 0.006149956622611644,
                            "phase": 0,
                            "scale": 5,
                            "offset": -4.8
                        }
                    },
                    "directionStrength": 0.5129404142770122,
                    "u_directionChannel": 4,
                    "magChannel": 0,
                    "directionPolarity": false,
                    "magPolarity": false,
                    "threshLow": 0.08,
                    "threshHigh": 0.595,
                    "magGamma": 1,
                    "kernelName": "gaussian",
                    "kernelRadiusX": 3,
                    "kernelRadiusY": 3,
                    "kernelSoftness": 10,
                    "chromaBoost": 1,
                    "directionChannel": "2"
                }
            }
        ]
    },
    {
        "name": "Take Me On",
        "config": [
            {
                "name": "field()",
                "config": {
                    "weights": [
                        2,
                        0,
                        0.75,
                        0,
                        0,
                        -0.09
                    ],
                    "FIELD_SIGNAL_COMPRESSION_KNEE": 0.75,
                    "FIELD_SIGNAL_NORMALIZE": false,
                    "FIELD_HUE_H": 0,
                    "FIELD_HUE_WIDTH": 0.3,
                    "FIELD_HUE_CHROMA_BOOST": 1,
                    "FIELD_CHROMA_EXP": 1,
                    "FIELD_LIGHT_CENTER": {
                        "value": 0.48,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "FIELD_LIGHT_WIDTH": 0.6238,
                    "FIELD_DOT_VECTOR": [
                        1,
                        0,
                        0
                    ],
                    "FIELD_DISPLAY_MODE": "5",
                    "blendAmount": 1,
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": 0,
                    "FIELD_TINT_COLOR": [
                        0.6,
                        0.3,
                        0.2
                    ],
                    "FIELD_EDGE_CENTER": 0.5,
                    "FIELD_EDGE_WIDTH": 0.1,
                    "FIELD_CHROMA_BOOST_MULT": 2.225,
                    "FIELD_LIGHT_DIR": [
                        0.25,
                        0.75
                    ],
                    "FIELD_LIGHT_Z": 1.5,
                    "FIELD_HUE1_CENTER": {
                        "value": 0.195,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "FIELD_HUE1_WIDTH": 0.1,
                    "FIELD_HUE2_CENTER": 0.8,
                    "FIELD_HUE2_WIDTH": 0.1,
                    "FIELD_HUE_GRAD_CHROMA_GAMMA": 1
                }
            },
            {
                "name": "flow()",
                "config": {
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": "4",
                    "blendAmount": 0.5,
                    "warpStrength": {
                        "value": 5,
                        "mod": {
                            "type": "hold",
                            "freq": 8.883026,
                            "phase": 0,
                            "scale": 5,
                            "offset": -0.6299999999999999
                        }
                    },
                    "directionStrength": 0.5129404142770122,
                    "u_directionChannel": 4,
                    "magChannel": 0,
                    "directionPolarity": false,
                    "magPolarity": false,
                    "threshLow": 0,
                    "threshHigh": 1,
                    "magGamma": 0.010000000000000009,
                    "kernelName": "gaussian",
                    "kernelRadiusX": 3,
                    "kernelRadiusY": 3,
                    "kernelSoftness": 10,
                    "chromaBoost": 1,
                    "directionChannel": "1"
                }
            }
        ]
    },
    {
        "name": "Light and Shadow",
        "config": [
            {
                "name": "Noise Mixer",
                "config": {
                    "frequency": 9.563907508300666,
                    "freqShift": 0.09,
                    "tint": [
                        1,
                        1,
                        1
                    ],
                    "seed": {
                        "value": 1,
                        "mod": {
                            "type": "sine",
                            "freq": 0.3,
                            "phase": 0,
                            "scale": 500,
                            "offset": 249.5
                        }
                    },
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": 0,
                    "components": [
                        0,
                        0.07,
                        0,
                        0,
                        0,
                        0,
                        0
                    ],
                    "blendAmount": 0.02,
                    "colormap": "none",
                    "threshold": 0,
                    "cutoff": 1,
                    "gate": 0,
                    "burstThreshold": 0.1,
                    "burstFreq": 100,
                    "burstTheta": 0.52,
                    "burstDTheta": 0,
                    "ZONESHAPE": 2,
                    "zoneCX": 0.5,
                    "zoneSX": 0.6,
                    "zoneCY": 0.5,
                    "zoneSY": 0.6,
                    "zoneEllipseN": 2,
                    "zoneSoftness": 0.1,
                    "zoneAngle": 0,
                    "APPLY_MASK": false,
                    "burstModType": "simplex"
                }

            },
            {
                "name": "Palette Synth",
                "config": {
                    "paletteSize": 26,
                    "weightL": 1.1,
                    "cycleOffset": 0,
                    "softness": 1.2,
                    "blendK": 3,
                    "useFurthest": true,
                    "lumaWeight": {
                        "value": 0.49,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "chromaWeight": {
                        "value": 1.31,
                        "mod": {
                            "type": "sine",
                            "freq": 0.15,
                            "phase": 0,
                            "scale": 1.22,
                            "offset": 1.55
                        }
                    },
                    "hueWeight": {
                        "value": 0.36,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "doMerge": true,
                    "assignMode": "blend",
                    "blendAmount": 1,
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": 0
                }
            },
        ]
    },
    {
        "name": "Night: a Thousand Eyes",
        "config": [
            {
                "name": "flow()",
                "config": {
                    "BLENDMODE": "10",
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": "2",
                    "blendAmount": 0.4,
                    "warpStrength": {
                        "value": 0.1,
                        "mod": {
                            "type": "impulse",
                            "freq": 4.5009999999999994,
                            "phase": 0,
                            "scale": 1.2300000000000004,
                            "offset": -0.33000000000000007
                        }
                    },
                    "directionStrength": {
                        "value": 6.550115783062797,
                        "mod": {
                            "type": "hold",
                            "freq": 4.653966,
                            "phase": 0,
                            "scale": 0.6400000000000001,
                            "offset": 10
                        }
                    },
                    "u_directionChannel": 4,
                    "magChannel": "1",
                    "directionPolarity": false,
                    "magPolarity": false,
                    "threshLow": 0,
                    "threshHigh": 1,
                    "magGamma": 6.979888937669975,
                    "kernelName": "gaussian",
                    "kernelRadiusX": 1,
                    "kernelRadiusY": 1,
                    "kernelSoftness": 10,
                    "chromaBoost": 1
                }
            },
            {
                "name": "Delay Line",
                "config": {
                    "delay": 147.18,
                    "window": "circle",
                    "falloff": "quadratic",
                    "density": 2.2,
                    "angle": {
                        "value": 0,
                        "mod": {
                            "type": "saw",
                            "freq": 0.05983465683709041,
                            "phase": 0,
                            "scale": -168.48,
                            "offset": 0
                        }
                    },
                    "shearX": {
                        "value": 0.1,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "shearY": -1.6,
                    "scaleX": 1.7,
                    "scaleY": 3,
                    "COLORSPACE": "0",
                    "BLENDMODE": "10",
                    "blendAmount": 0.48,
                    "blendTarget": "0",
                    "jitter": 0,
                    "chromaBoost": 1.1875,
                    "BLEND_CHANNEL_MODE": "0"
                }
            }]
    },
    {
        "name": "Chromawoof",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0,
                    "cycle": true,
                    "cycleMode": "spatial",
                    "hueShift": {
                        "value": 2,
                        "mod": {
                            "type": "hold",
                            "freq": 4.878915999999999,
                            "phase": 0,
                            "scale": 0.5158496080000001,
                            "offset": 1
                        }
                    },
                    "saturation": 100,
                    "lightness": 48,
                    "hueSpread": 4.230713735302785,
                    "bleed": 0,
                    "COLORSPACE": 0,
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 1,
                    "bandingSteps": 0,
                    "waveType": 0,
                    "dutyCycle": 0.5,
                    "originX": 0.5,
                    "originY": 0.5,
                    "spatialPattern": "radial",
                    "blendTarget": "0"
                }
            },
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.3,
                    "cycle": true,
                    "cycleMode": "spatial",
                    "hueShift": {
                        "value": 0.51,
                        "mod": {
                            "type": "walk",
                            "freq": 1.5824898442403836,
                            "phase": 0,
                            "scale": 2,
                            "offset": 1,
                            "_walkValue": 0.6886539534563602,
                            "_lastUpdate": 360.922
                        }
                    },
                    "saturation": 100,
                    "lightness": 48,
                    "hueSpread": {
                        "value": 1.7707152252711142,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "bleed": 0,
                    "COLORSPACE": "4",
                    "BLENDMODE": "10",
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 1,
                    "bandingSteps": 1,
                    "waveType": "sine",
                    "dutyCycle": 0.5,
                    "originX": 0.26,
                    "originY": 0.37,
                    "spatialPattern": "radial",
                    "blendTarget": "0"
                }
            },
            {
                "name": "Auto Levels",
                "config": {
                    "mode": "channelwise",
                    "paramA": 1,
                    "paramB": 100
                }
            },
            {
                "name": "flow()",
                "config": {
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": 0,
                    "blendAmount": 1,
                    "warpStrength": {
                        "value": 0.88,
                        "mod": {
                            "type": "saw",
                            "freq": 0.017830828180739,
                            "phase": 0,
                            "scale": 1.108,
                            "offset": 1
                        }
                    },
                    "directionAngle": {
                        "value": 1.4765485471872,
                        "mod": {
                            "type": "saw",
                            "freq": 0.1804814460139499,
                            "phase": 0,
                            "scale": 0.1947787445225675,
                            "offset": 1.5330972149518187
                        }
                    },
                    "modAmount": 0.42,
                    "driverChannel": 0,
                    "modulatorChannel": "4",
                    "driverPolarity": false,
                    "modulatorPolarity": false,
                    "threshLow": 0,
                    "threshHigh": 1,
                    "driverGamma": 0.5650845800732875,
                    "flatThreshold": false
                }
            }
        ]
    },
    {
        "name": "Chromasplash",
        "config": [
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0,
                    "cycle": true,
                    "cycleMode": "spatial",
                    "hueShift": {
                        "value": 2,
                        "mod": {
                            "type": "hold",
                            "freq": 4.878915999999999,
                            "phase": 0,
                            "scale": 0.5158496080000001,
                            "offset": 1
                        }
                    },
                    "saturation": 100,
                    "lightness": 48,
                    "hueSpread": 4.230713735302785,
                    "bleed": 0,
                    "COLORSPACE": 0,
                    "BLENDMODE": "10",
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 0.6,
                    "chromaBoost": 1,
                    "bandingSteps": 0,
                    "waveType": 0,
                    "dutyCycle": 0.5,
                    "originX": 0.5,
                    "originY": 0.5,
                    "spatialPattern": "radial",
                    "blendTarget": "0"
                }
            },
            {
                "name": "Chromawave",
                "config": {
                    "threshold": 0.3,
                    "cycle": true,
                    "cycleMode": "spatial",
                    "hueShift": {
                        "value": 0.51,
                        "mod": {
                            "type": "walk",
                            "freq": 0.954400895717668,
                            "phase": 0,
                            "scale": 0.06400000000000002,
                            "offset": 1,
                            "_walkValue": 0.5284797481111897,
                            "_lastUpdate": 98.04309999998212
                        }
                    },
                    "saturation": 100,
                    "lightness": 48,
                    "hueSpread": {
                        "value": 1.7707152252711142,
                        "mod": {
                            "type": "none"
                        }
                    },
                    "bleed": 0,
                    "COLORSPACE": "4",
                    "BLENDMODE": "6",
                    "BLEND_CHANNEL_MODE": 0,
                    "blendAmount": 0.7,
                    "chromaBoost": 1,
                    "bandingSteps": 1,
                    "waveType": "sine",
                    "dutyCycle": 0.5,
                    "originX": 0.26,
                    "originY": 0.37,
                    "spatialPattern": "radial",
                    "blendTarget": "0"
                }
            },
            {
                "name": "Auto Levels",
                "config": {
                    "mode": "channelwise",
                    "paramA": 17,
                    "paramB": 100
                }
            },
            {
                "name": "flow()",
                "config": {
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": 0,
                    "blendAmount": 1,
                    "warpStrength": {
                        "value": 0.9,
                        "mod": {
                            "type": "saw",
                            "freq": 0.04807140887689735,
                            "phase": 0,
                            "scale": -4.68,
                            "offset": 0
                        }
                    },
                    "directionStrength": 0.5,
                    "u_directionChannel": 4,
                    "magChannel": 0,
                    "directionPolarity": false,
                    "magPolarity": false,
                    "threshLow": 0,
                    "threshHigh": 1,
                    "magGamma": 1,
                    "kernelName": "gaussian",
                    "kernelRadiusX": 3,
                    "kernelRadiusY": 3,
                    "kernelSoftness": 10,
                    "chromaBoost": 1,
                    "directionAngle": {
                        "value": 1.4765485471872,
                        "mod": {
                            "type": "saw",
                            "freq": 0.1804814460139499,
                            "phase": 0,
                            "scale": 0.1947787445225675,
                            "offset": 1.5330972149518187
                        }
                    },
                    "modAmount": 0.42,
                    "driverChannel": 0,
                    "modulatorChannel": "4",
                    "driverPolarity": false,
                    "modulatorPolarity": false,
                    "driverGamma": 0.5650845800732875,
                    "flatThreshold": false
                }
            }
        ]
    },
    {
        "name": "Reverse Oilslick",
        "config": [{
            "name": "Chromawave",
            "config": {
                "threshold": {"value": 0.12, "mod": {"type": "none"}},
                "cycle": true,
                "cycleMode": "spatial",
                "hueShift": 180,
                "saturation": 82,
                "lightness": 63,
                "hueSpread": 1,
                "bleed": 0.39,
                "COLORSPACE": 0,
                "BLENDMODE": "10",
                "BLEND_CHANNEL_MODE": 0,
                "blendAmount": 1,
                "chromaBoost": 1,
                "bandingSteps": 0,
                "waveType": 0,
                "dutyCycle": 0.5,
                "originX": 0.5,
                "originY": 0.5,
                "spatialPattern": "radial"
            }
        }, {
            "name": "flow()",
            "config": {
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": 0,
                "blendAmount": 1,
                "warpStrength": {
                    "value": 0.2,
                    "mod": {
                        "type": "sine",
                        "freq": 0.00802482581416809,
                        "phase": 0,
                        "scale": -0.658746680000001,
                        "offset": 0
                    }
                },
                "directionStrength": 1.6171059036866482,
                "u_directionChannel": 4,
                "magChannel": 0,
                "directionPolarity": false,
                "magPolarity": false,
                "threshLow": 0,
                "threshHigh": 1,
                "magGamma": 1,
                "kernelName": "gaussian",
                "kernelRadiusX": 3,
                "kernelRadiusY": 3,
                "kernelSoftness": 10,
                "chromaBoost": 1,
                "directionChannel": "4"
            }
        }, {
            "name": "Pixelate",
            "config": {
                "blockSize": 30,
                "BLENDMODE": "10",
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": "2",
                "blendAmount": 0.63,
                "chromaBoost": 1
            }
        }]
    },
    {
        "name": "Light-up Floor",
        "config": [
            {
                "name": "Mirrorband",
                "config": {
                    "bandSize": 0.2,
                    "orientation": 1,
                    "mirrorRate": 1,
                    "offset": 0.35,
                    "noiseAmount": 0,
                    "colorNoise": 0,
                    "blendAmount": 0.57,
                    "COLORSPACE": 0,
                    "BLENDMODE": "10",
                    "BLEND_CHANNEL_MODE": 0,
                    "chromaBoost": 1,
                    "seed": {
                        "value": 258,
                        "mod": {
                            "type": "hold",
                            "freq": 4.5009999999999994,
                            "phase": 0,
                            "scale": 16.000000000000004,
                            "offset": 250
                        }
                    },
                    "levels": 2,
                    "rotationAmount": 0,
                    "sBias": 0.5,
                    "vBias": 0.86,
                    "hue": 0,
                    "colorBlend": "1"
                }
            },
            {
                "name": "flow()",
                "config": {
                    "BLENDMODE": 1,
                    "BLEND_CHANNEL_MODE": 0,
                    "COLORSPACE": 0,
                    "blendAmount": 1,
                    "warpStrength": 0.1,
                    "directionStrength": 3.5825756949558434,
                    "directionChannel": "4",
                    "magChannel": 0,
                    "directionPolarity": false,
                    "magPolarity": false,
                    "threshLow": 0,
                    "threshHigh": 0.23,
                    "magGamma": 1,
                    "kernelName": "gaussian",
                    "kernelRadiusX": 3,
                    "kernelRadiusY": 3,
                    "kernelSoftness": 10,
                    "chromaBoost": 1
                }
            }
        ]
    },
    {
        "name": "An End to Landscape",
        "config": [{
            "name": "field()",
            "config": {
                "weights": [0.29, -0.13, 2, 0, -0.04, 0.06],
                "FIELD_SIGNAL_COMPRESSION_KNEE": 0.5347,
                "FIELD_SIGNAL_NORMALIZE": false,
                "FIELD_HUE_H": 0,
                "FIELD_HUE_WIDTH": 0.3,
                "FIELD_HUE_CHROMA_BOOST": 1,
                "FIELD_CHROMA_EXP": 1,
                "FIELD_LIGHT_CENTER": {
                    "value": 0.42,
                    "mod": {"type": "sine", "freq": 0.05566404101306507, "phase": 0, "scale": 0.888, "offset": 0.617}
                },
                "FIELD_LIGHT_WIDTH": 0.54955,
                "FIELD_DOT_VECTOR": [1, 0, 0],
                "FIELD_DISPLAY_MODE": "1",
                "blendAmount": 1,
                "BLENDMODE": "9",
                "BLEND_CHANNEL_MODE": "0",
                "COLORSPACE": 0,
                "chromaBoost": 1,
                "FIELD_TINT_COLOR": [0.6, 0.3, 0.2],
                "FIELD_EDGE_CENTER": 0.5,
                "FIELD_EDGE_WIDTH": 0.1,
                "FIELD_CHROMA_BOOST_MULT": 2,
                "FIELD_LIGHT_DIR": [0.25, 0.75],
                "FIELD_LIGHT_Z": 1.5,
                "FIELD_HUE1_CENTER": 0.2,
                "FIELD_HUE1_WIDTH": 0.1,
                "FIELD_HUE2_CENTER": 0.8,
                "FIELD_HUE2_WIDTH": 0.1,
                "FIELD_HUE_GRAD_CHROMA_GAMMA": 1
            }
        }, {
            "name": "Pixelate",
            "config": {
                "blockSize": {
                    "value": 3,
                    "mod": {"type": "hold", "freq": 1.2172126609195149, "phase": 0, "scale": 1.0009585, "offset": 22.3}
                },
                "BLENDMODE": "7",
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": "6",
                "blendAmount": 1,
                "chromaBoost": 1,
                "sampleStrategy": "corner",
                "preserveAlpha": true
            }
        }, {
            "name": "flow()",
            "config": {
                "BLENDMODE": 1,
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": 0,
                "blendAmount": 1,
                "warpStrength": {
                    "value": 0.2,
                    "mod": {
                        "type": "triangle",
                        "freq": 0.081165698816699,
                        "phase": 0,
                        "scale": -0.5763200000000008,
                        "offset": 0
                    }
                },
                "directionStrength": 0.5,
                "directionChannel": 5,
                "magChannel": "5",
                "directionPolarity": false,
                "magPolarity": false,
                "threshLow": 0,
                "threshHigh": 1,
                "magGamma": 1,
                "kernelName": "gaussian",
                "kernelRadiusX": 3,
                "kernelRadiusY": 3,
                "kernelSoftness": 10,
                "chromaBoost": 1
            }
        }]
    },
    {
        "name": "Phaser Barrage",
        "config": [{
            "name": "Grid Pattern",
            "config": {
                "lineWidth": {
                    "value": 22.164404157881304,
                    "mod": {"type": "sine", "freq": 0.072, "phase": 0, "scale": 46.51, "offset": 22.164404157881304}
                },
                "spacingFactor": {
                    "value": 1.2329961103921538,
                    "mod": {"type": "sine", "freq": 0.098, "phase": 0, "scale": 0.36, "offset": 1.2329961103921538}
                },
                "phaseX": 0.3400000000000001,
                "phaseY": 0.3400000000000001,
                "skew": 0.96,
                "noiseScale": {
                    "value": 0.052000000000000005,
                    "mod": {"type": "sine", "freq": 0.078, "phase": 0, "scale": 0, "offset": 0.052000000000000005}
                },
                "noiseAmount": 0.28,
                "direction": "grid",
                "mode": "saw",
                "lumaThreshold": 0.98,
                "lumaAngle": 0.27,
                "lumaMod": -1.04,
                "invert": true,
                "blendAmount": 0.75,
                "BLENDMODE": "1",
                "COLORSPACE": "3",
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": 0.9,
                "color": [0.29, 0.43, 0.68],
                "channelPhase0": {
                    "value": -0.48,
                    "mod": {
                        "type": "sine",
                        "freq": 4.5009999999999994,
                        "phase": 0,
                        "scale": -0.9359999999999999,
                        "offset": 0
                    }
                },
                "channelPhase1": -0.29999999999999993,
                "channelPhase2": -0.38
            }
        }]
    },
    {
        "name": "Furze", "config": [{
            "name": "field()", "config": {
                "weights": [0.10999999999999988, 0.8299999999999998, -0.16000000000000003, 1.04, -0.55, 0.58],
                "FIELD_SIGNAL_NORMALIZE": true,
                "FIELD_SIGNAL_COMPRESSION_KNEE": {
                    "value": 0.0199,
                    "mod": {"type": "impulse", "freq": 0.05399999999999999, "phase": 0, "scale": 0.08, "offset": 0.0199}
                },
                "FIELD_DISPLAY_MODE": 5,
                "FIELD_CHROMA_BOOST_MULT": 0.6,
                "FIELD_TINT_COLOR": [0.8200000000000001, 0.04, 0.79],
                "FIELD_EDGE_CENTER": 0.53,
                "FIELD_EDGE_WIDTH": 0.42515,
                "FIELD_LIGHT_DIR": [0.8, 0.5800000000000001],
                "FIELD_LIGHT_Z": 2.5515,
                "FIELD_HUE_H": 4.77508,
                "FIELD_HUE_WIDTH": {
                    "value": 1.9819,
                    "mod": {"type": "fm-lfo", "freq": 0.05, "phase": 0, "scale": 0.54, "offset": 1.9819}
                },
                "FIELD_HUE_CHROMA_BOOST": 0.45331834004703764,
                "FIELD_HUE1_CENTER": {
                    "value": 0.08,
                    "mod": {"type": "sine", "freq": 0.076, "phase": 0, "scale": 0.17, "offset": 0.08}
                },
                "FIELD_HUE1_WIDTH": 0.4265,
                "FIELD_HUE2_CENTER": 0.04,
                "FIELD_HUE2_WIDTH": 0.1864,
                "FIELD_CHROMA_EXP": {
                    "value": 3.7260000000000004,
                    "mod": {
                        "type": "walk",
                        "freq": 0.195,
                        "phase": 0,
                        "scale": 0.38,
                        "offset": 3.7260000000000004,
                        "_walkValue": 0.9041497742329742,
                        "_lastUpdate": 1206.9899999991442
                    }
                },
                "FIELD_LIGHT_CENTER": 0.23,
                "FIELD_LIGHT_WIDTH": 0.5049999999999999,
                "FIELD_HUE_GRAD_CHROMA_GAMMA": 0.5082399653118496,
                "FIELD_DOT_VECTOR": [-0.28, 0.6200000000000001, 0.30000000000000004],
                "blendAmount": 0.35,
                "BLENDMODE": "6",
                "COLORSPACE": 3,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": 0.9
            }
        }, {
            "name": "Contour Synth",
            "config": {
                "phaseOff": {
                    "value": -40,
                    "mod": {
                        "type": "walk",
                        "freq": 0.29400000000000004,
                        "phase": 0,
                        "scale": 28.49,
                        "offset": -40,
                        "_walkValue": -0.8774644981370188,
                        "_lastUpdate": 1206.9899999991442
                    }
                },
                "phaseScale": {
                    "value": 2.981852653289741,
                    "mod": {"type": "fm-lfo", "freq": 0.074, "phase": 0, "scale": 0.44, "offset": 2.981852653289741}
                },
                "waveform": "Tri",
                "spatialWaveform": "Checkerboard",
                "freq": 0.65,
                "freqScale": {
                    "value": 0.4,
                    "mod": {"type": "impulse", "freq": 0.084, "phase": 0, "scale": 0.81, "offset": 0.4}
                },
                "blendAmount": 0.35,
                "BLENDMODE": 9,
                "COLORSPACE": 0,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": {
                    "value": 0.1,
                    "mod": {"type": "triangle", "freq": 0.053, "phase": 0, "scale": 0.38, "offset": 0.9}
                }
            }
        }]
    },
    {
        "name": "Plane of Gel",
        "config": [{
            "name": "flow()",
            "config": {
                "warpStrength": 0.43200000000000005,
                "threshLow": 0.095,
                "threshHigh": 0.6895,
                "magGamma": 0.5410955468700279,
                "magChannel": 2,
                "magPolarity": true,
                "directionStrength": 0.6989700043360187,
                "directionChannel": 5,
                "directionPolarity": false,
                "kernelRadiusX": 9,
                "kernelRadiusY": 29,
                "kernelSoftness": 1.38,
                "kernelName": "box",
                "blendAmount": {
                    "value": 0.29,
                    "mod": {"type": "triangle", "freq": 0.013, "phase": 0, "scale": 0.32, "offset": 0.35}
                },
                "BLENDMODE": 2,
                "COLORSPACE": 4,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": 0.9
            }
        }, {
            "name": "Noise Mixer", "config": {
                "seed": {
                    "value": 260,
                    "mod": {"type": "sine", "freq": 0.08, "phase": 0, "scale": 166.67, "offset": 260}
                },
                "components": [0.55, 0.9500000000000001, 0.62, 0.88, 0.8, 0.37, 0.32],
                "frequency": 4.643464520719637,
                "freqShift": 0.96,
                "gate": 1,
                "threshold": 0.405,
                "cutoff": {
                    "value": 0.7165,
                    "mod": {"type": "sine", "freq": 0.069, "phase": 0, "scale": 0.05, "offset": 0.7165}
                },
                "burstThreshold": 0.92,
                "burstFreq": 4.591089104998618,
                "burstModType": "pseudoperlin",
                "burstTheta": {
                    "value": 2.1676989309769574,
                    "mod": {"type": "sine", "freq": 0.05, "phase": 0, "scale": 0.44, "offset": 2.1676989309769574}
                },
                "burstDTheta": 0.942477796076938,
                "blendAmount": {
                    "value": 0.35000000000000003,
                    "mod": {"type": "sine", "freq": 0.036, "phase": 0, "scale": 0.37, "offset": 0.35000000000000003}
                },
                "BLENDMODE": 9,
                "COLORSPACE": 5,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": 0.9,
                "colormap": "rainbow",
                "tint": [0.61, 0.85, 0.26],
                "APPLY_MASK": false,
                "ZONESHAPE": 0,
                "zoneCX": 0.33,
                "zoneSX": 0.454,
                "zoneCY": 0.21,
                "zoneSY": 0.67,
                "zoneEllipseN": 3.266,
                "zoneSoftness": 0.37,
                "zoneAngle": {
                    "value": 6.220353454107791,
                    "mod": {"type": "sine", "freq": 0.025, "phase": 0, "scale": 0.84, "offset": 6.220353454107791}
                }
            }
        }, {
            "name": "Perlin Distort",
            "config": {
                "seed": 305,
                "depth": {
                    "value": 0.696,
                    "mod": {"type": "sine", "freq": 0.085, "phase": 0, "scale": 0.38, "offset": 0.696}
                },
                "freqX": 41.69605392106569,
                "freqY": 6.734368642364779,
                "pitchX": -1.56,
                "pitchY": -1.96,
                "rate": 2,
                "rateDrive": 0.07,
                "phase": [0.26, 0.13],
                "fuzz": 0,
                "noiseMode": "classic",
                "boundMode": "fract",
                "clampScale": 2.28,
                "fc": [1.38, 15.63, 9.93],
                "reps": [10.69, 9.36],
                "blendAmount": 0.35,
                "BLENDMODE": 7,
                "COLORSPACE": 2,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": 0.9
            }
        }]
    },
    {
        "name": "UFO Landing",
        "config": [{
            "name": "Chromawave",
            "config": {
                "threshold": 0,
                "cycle": true,
                "cycleMode": "spatial",
                "hueShift": {
                    "value": 2,
                    "mod": {"type": "sine", "freq": 0.12653520217187506, "phase": 0, "scale": 2, "offset": 1}
                },
                "saturation": 100,
                "lightness": 50,
                "hueSpread": 1,
                "bleed": 0,
                "COLORSPACE": "3",
                "BLENDMODE": "6",
                "BLEND_CHANNEL_MODE": "1",
                "blendAmount": 1,
                "chromaBoost": 0.85,
                "bandingSteps": 0,
                "waveType": "square",
                "dutyCycle": 0.5,
                "originX": 0.5,
                "originY": 0.5,
                "spatialPattern": "vertical"
            }
        }]
    },
    {
        "name": "Galactic",
        "config": [{
            "name": "Affine Transform",
            "config": {
                "angle": -158.4,
                "scaleX": 0.72636714137856,
                "scaleY": 1.6442505393252127,
                "shearX": 0.17999999999999972,
                "shearY": 0.8999999999999999,
                "translateX": -0.96,
                "translateY": -0.64,
                "wrap": true,
                "blendAmount": {
                    "value": 0.47000000000000003,
                    "mod": {"type": "hold", "freq": 0.026, "phase": 0, "scale": 0.04, "offset": 0.47000000000000003}
                },
                "BLENDMODE": 4,
                "COLORSPACE": 5,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": 0.9
            }
        }, {
            "name": "Warp Zone",
            "config": {
                "ZONESHAPE": 3,
                "zoneCX": 0.87,
                "zoneSX": 0.74,
                "zoneCY": 0,
                "zoneSY": 0.8300000000000001,
                "zoneEllipseN": {
                    "value": 4.358,
                    "mod": {"type": "triangle", "freq": 0.079, "phase": 0, "scale": 2.46, "offset": 4.358}
                },
                "zoneSoftness": {
                    "value": 0.165,
                    "mod": {"type": "sine", "freq": 0.021, "phase": 0, "scale": 0.12, "offset": 0.165}
                },
                "zoneAngle": {
                    "value": 5.717698629533424,
                    "mod": {"type": "sine", "freq": 0.063, "phase": 0, "scale": 1.54, "offset": 5.717698629533424}
                },
                "warpAngle": {
                    "value": 5.089380098815465,
                    "mod": {
                        "type": "walk",
                        "freq": 0.33,
                        "phase": 0,
                        "scale": 0.04,
                        "offset": 5.089380098815465,
                        "_walkValue": 0.7364068557686569,
                        "_lastUpdate": 185.97000000000628
                    }
                },
                "warpStrength": 87.25,
                "paramA": 0.62,
                "WARPMODE": "noise",
                "blendAmount": 0.756,
                "BLENDMODE": 10,
                "COLORSPACE": 0,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": 0.9,
                "WARPDRIVE_MODE": 1,
                "WARPDRIVE_COLORSPACE": 0,
                "WARPDRIVE_CHANNEL": 0,
                "paramB": {
                    "value": 0.26,
                    "mod": {"type": "hold", "freq": 0.025, "phase": 0, "scale": 0.25, "offset": 0.26}
                },
                "PREBLEND_WARP_CHANNEL": 2
            }
        }, {
            "name": "Colormap",
            "config": {
                "colormap": "moonbow",
                "reverse": false,
                "blendAmount": 0.871,
                "BLENDMODE": 10,
                "COLORSPACE": 0,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": 0.9
            }
        }]
    },
    {
        "name": "Over the Edge",
        "config": [{
            "name": "Edge Trace",
            "config": {
                "threshold": {
                    "value": 0.96,
                    "mod": {"type": "sine", "freq": 0.024, "phase": 0, "scale": 0.24, "offset": 0.96}
                },
                "blendAmount": {
                    "value": 0.8300000000000001,
                    "mod": {"type": "hold", "freq": 0.013, "phase": 0, "scale": 0.26, "offset": 0.8300000000000001}
                },
                "BLENDMODE": 5,
                "COLORSPACE": 4,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": 0.9,
                "tint": [0.59, 0.55, 0.52]
            }
        }, {
            "name": "Pixelate",
            "config": {
                "blockSize": {
                    "value": 23,
                    "mod": {"type": "sine", "freq": 0.096, "phase": 0, "scale": 14.58, "offset": 23}
                },
                "blendAmount": 0.6,
                "BLENDMODE": 9,
                "COLORSPACE": 7,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": {
                    "value": 1.9500000000000002,
                    "mod": {"type": "saw", "freq": 0.106, "phase": 0, "scale": 0.23, "offset": 0.9}
                }
            }
        }, {
            "name": "Delay Line",
            "config": {
                "delay": 194,
                "density": 1.42,
                "window": "circle",
                "falloff": "yRamp",
                "jitter": {
                    "value": 0.16,
                    "mod": {"type": "fm-lfo", "freq": 0.082, "phase": 0, "scale": 0.47, "offset": 0.16}
                },
                "angle": 25.200000000000017,
                "shearX": {
                    "value": 0.20000000000000018,
                    "mod": {"type": "saw", "freq": 0.039, "phase": 0, "scale": 3.47, "offset": 0.20000000000000018}
                },
                "shearY": -3.7,
                "scaleX": 1.1440000000000001,
                "scaleY": 1.666,
                "blendAmount": 0.74,
                "BLENDMODE": 4,
                "COLORSPACE": 4,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": 0.9
            }
        }]
    },
    {
        "name": "Sliding Doors",
        "config": [{
            "name": "Chromawave",
            "config": {
                "threshold": 0.17400000000000002,
                "cycleMode": "luma",
                "hueShift": 1.3,
                "hueSpread": 1.8697439987548659,
                "spatialPattern": "angle",
                "originX": {
                    "value": 0.3,
                    "mod": {"type": "saw", "freq": 0.052, "phase": 0, "scale": 0.14, "offset": 0.3}
                },
                "originY": 0.14,
                "saturation": 87,
                "lightness": 53,
                "bleed": 0.2,
                "waveType": "tri",
                "bandingSteps": 2,
                "dutyCycle": 0.1962,
                "blendAmount": 0.35,
                "BLENDMODE": 10,
                "COLORSPACE": 3,
                "BLEND_CHANNEL_MODE": 3,
                "chromaBoost": 0.9
            }
        }, {
            "name": "Mirrorband",
            "config": {
                "bandSize": 0.2893,
                "orientation": 0,
                "mirrorRate": {
                    "value": 0.73,
                    "mod": {
                        "type": "impulse-ease",
                        "freq": 0.123,
                        "phase": 0,
                        "scale": 0.21000000000000002,
                        "offset": 0.73
                    }
                },
                "offset": -0.07999999999999996,
                "seed": 280,
                "colorMode": 1,
                "colorBlend": 0,
                "hue": 0.11,
                "sBias": {
                    "value": 0.265,
                    "mod": {
                        "type": "walk",
                        "freq": 0.10799999999999998,
                        "phase": 0,
                        "scale": 0.38,
                        "offset": 0.265,
                        "_walkValue": 0.3126180602972707,
                        "_lastUpdate": 359.9399999999144
                    }
                },
                "vBias": 0.64,
                "levels": 1,
                "rotationAmount": {
                    "value": 1.4451326206513049,
                    "mod": {"type": "sine", "freq": 0.051, "phase": 0, "scale": 1.47, "offset": 1.4451326206513049}
                },
                "blendAmount": 0.53,
                "BLENDMODE": 1,
                "COLORSPACE": 8,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": 0.9
            }
        }, {
            "name": "Desync Tiles",
            "config": {
                "seed": 260,
                "tileCountX": 7,
                "tileCountY": {
                    "value": 11,
                    "mod": {"type": "saw", "freq": 0.078, "phase": 0, "scale": 14.43, "offset": 11}
                },
                "offsetAmount": {
                    "value": 0.9945000000000002,
                    "mod": {"type": "sine", "freq": 0.033, "phase": 0, "scale": 0.08, "offset": 0.9945000000000002}
                },
                "blendAmount": {
                    "value": 0.8200000000000001,
                    "mod": {"type": "fm-lfo", "freq": 0.012, "phase": 0, "scale": 0.17, "offset": 0.75}
                },
                "BLENDMODE": 1,
                "COLORSPACE": 8,
                "BLEND_CHANNEL_MODE": 0,
                "chromaBoost": {
                    "value": 0.5750000000000001,
                    "mod": {"type": "fm-lfo", "freq": 0.027, "phase": 0, "scale": 0.19, "offset": 0.9}
                }
            }
        }]
    },
    {
        "name": "Blurted Out",
        "config": [{
            "name": "Warp Zone",
            "config": {
                "COLORSPACE": 0,
                "BLENDMODE": 1,
                "blendAmount": 1,
                "BLEND_CHANNEL_MODE": 0,
                "ZONESHAPE": 2,
                "zoneCX": 0.245,
                "zoneSX": 1,
                "zoneCY": 0.305,
                "zoneSY": 1,
                "zoneEllipseN": 7.5885,
                "zoneSoftness": 1,
                "WARPMODE": "lens",
                "paramA": 0,
                "paramB": 0,
                "warpStrength": -1,
                "PREBLEND_WARP_CHANNEL": 2,
                "WARPDRIVE_COLORSPACE": 6,
                "WARPDRIVE_MODE": 0,
                "WARPDRIVE_CHANNEL": 2,
                "zoneAngle": 4.02123859659494,
                "warpAngle": {
                    "value": 0,
                    "mod": {
                        "type": "sine",
                        "freq": 0.049270599654435775,
                        "phase": 0,
                        "scale": 6.283185307179586,
                        "offset": 3.141592653589793
                    }
                },
                "chromaBoost": 1
            }
        }, {
            "name": "Warp Zone",
            "config": {
                "COLORSPACE": 0,
                "BLENDMODE": 1,
                "blendAmount": 1,
                "BLEND_CHANNEL_MODE": 0,
                "ZONESHAPE": 2,
                "zoneCX": 0.775,
                "zoneSX": 1,
                "zoneCY": 0.305,
                "zoneSY": 1,
                "zoneEllipseN": 1.446,
                "zoneSoftness": 1,
                "WARPMODE": "lens",
                "paramA": 0.745,
                "paramB": 0,
                "warpStrength": -4,
                "PREBLEND_WARP_CHANNEL": 2,
                "WARPDRIVE_COLORSPACE": 6,
                "WARPDRIVE_MODE": 0,
                "WARPDRIVE_CHANNEL": 2,
                "zoneAngle": 0,
                "warpAngle": {
                    "value": 1.38230076757951,
                    "mod": {
                        "type": "triangle",
                        "freq": 0.0930204568902073,
                        "phase": 0,
                        "scale": 6.283185307179586,
                        "offset": 3.141592653589793
                    }
                },
                "chromaBoost": 1
            }
        }, {
            "name": "Warp Zone",
            "config": {
                "COLORSPACE": 0,
                "BLENDMODE": 1,
                "blendAmount": 1,
                "BLEND_CHANNEL_MODE": 0,
                "ZONESHAPE": "2",
                "zoneCX": 0.965,
                "zoneSX": 1,
                "zoneCY": 1,
                "zoneSY": 1,
                "zoneEllipseN": 10,
                "zoneSoftness": 1,
                "WARPMODE": "lens",
                "paramA": 0.3,
                "paramB": 0,
                "warpStrength": -3,
                "PREBLEND_WARP_CHANNEL": 2,
                "WARPDRIVE_COLORSPACE": 6,
                "WARPDRIVE_MODE": 0,
                "WARPDRIVE_CHANNEL": 2,
                "zoneAngle": 0,
                "warpAngle": {
                    "value": 0,
                    "mod": {
                        "type": "sine",
                        "freq": 0.27797761400704635,
                        "phase": 0,
                        "scale": 0.24977860710896366,
                        "offset": 3.524866957327748
                    }
                },
                "chromaBoost": 1
            }
        }, {
            "name": "Warp Zone",
            "config": {
                "COLORSPACE": 0,
                "BLENDMODE": 1,
                "blendAmount": 1,
                "BLEND_CHANNEL_MODE": 0,
                "ZONESHAPE": "2",
                "zoneCX": 0.23,
                "zoneSX": 1,
                "zoneCY": 1,
                "zoneSY": 1,
                "zoneEllipseN": 10,
                "zoneSoftness": 1,
                "WARPMODE": "lens",
                "paramA": 0.3,
                "paramB": 0,
                "warpStrength": 1,
                "PREBLEND_WARP_CHANNEL": 2,
                "WARPDRIVE_COLORSPACE": 6,
                "WARPDRIVE_MODE": 0,
                "WARPDRIVE_CHANNEL": 2,
                "zoneAngle": 0,
                "warpAngle": {
                    "value": 0,
                    "mod": {
                        "type": "sine",
                        "freq": 0.05174712477472756,
                        "phase": 0,
                        "scale": 6.283185307179586,
                        "offset": 3.141592653589793
                    }
                },
                "chromaBoost": 1
            }
        }, {
            "name": "Bloom",
            "config": {
                "bloomThreshold": 0.33,
                "bloomSoftness": 0.37,
                "bloomStrength": 1.365,
                "kernelName": "gabor",
                "kernelRadius": 15,
                "kernelSoftness": {
                    "value": 4.23,
                    "mod": {
                        "type": "triangle",
                        "freq": 0.09728629881908396,
                        "phase": 0,
                        "scale": 2.6152989080000006,
                        "offset": 4.629
                    }
                },
                "BLOOM_MODE": "0",
                "chromaOffset": [-2.32, -2.05, 1.38],
                "BLOOM_CHROMA_TAIL": false,
                "blendAmount": {"value": 0.63, "mod": {"type": "none"}},
                "BLENDMODE": "6",
                "COLORSPACE": "4",
                "BLEND_CHANNEL_MODE": "0",
                "chromaBoost": {
                    "value": 0.225,
                    "mod": {
                        "type": "walk",
                        "freq": 0.21299999999999997,
                        "phase": 0,
                        "scale": 0.11,
                        "offset": 0.9,
                        "_walkValue": -0.5317879426825523,
                        "_lastUpdate": 5813.48999999746
                    }
                }
            }
        }]
    },
    {
        "name": "Black Light Party",
        "config": [{
            "name": "Invert",
            "config": {"invert0": false, "invert1": true, "invert2": true, "COLORSPACE": "1", "colorSpace": 1}
        }, {
            "name": "Noise Mixer",
            "config": {
                "frequency": 30.744329067236027,
                "freqShift": -0.03,
                "tint": [0, 1, 0],
                "seed": {"value": 160, "mod": {"type": "none"}},
                "BLENDMODE": 10,
                "BLEND_CHANNEL_MODE": 0,
                "COLORSPACE": "0",
                "chromaBoost": 1,
                "components": [0, 0, 0.68, 0, 0, 0, 0],
                "blendAmount": 0.5,
                "colormap": "none",
                "threshold": 0,
                "cutoff": 1,
                "gate": 0,
                "burstThreshold": 0.1,
                "burstFreq": 100,
                "burstTheta": 0.52,
                "burstDTheta": 0,
                "ZONESHAPE": 2,
                "zoneCX": 0.5,
                "zoneSX": 0.6,
                "zoneCY": 0.5,
                "zoneSY": 0.6,
                "zoneEllipseN": 2,
                "zoneSoftness": 0.1,
                "zoneAngle": 0,
                "APPLY_MASK": false,
                "burstModType": "simplex",
                "shiftX": 0,
                "shiftY": 0,
                "fc": [6, 14.75, 10],
                "tintSpace": "RGB",
                "master": 0.6
            }
        }, {
            "name": "Look",
            "config": {
                "exposure": 0,
                "toneShoulder": 2.02,
                "toneCenter": -0.8,
                "curveStrength": 1,
                "chromaWeight": 4,
                "chromaFadeLow": -6,
                "chromaFadeHigh": -6,
                "tintHue": 68,
                "tintStrength": 0,
                "lift": -0.2,
                "gamma": 0,
                "gain": 0.08
            }
        }]
    }
]