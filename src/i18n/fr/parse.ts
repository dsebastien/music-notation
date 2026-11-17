/** French texts: blocks, theory, chord, chords, voicings (exactly the keys of the English file). */
export const frParse = {
    'blocks.source.expected': 'Attendu "clé: valeur", reçu "{line}"',
    'blocks.source.strings':
        'strings: utilisez des numéros de corde de 1 (la plus aiguë) à {count}, par ex. 1-4',
    'blocks.caption.fingeringChordOnly':
        "caption: fingering ne sert qu'aux blocs d'accord : utilisez formula ou none ici",
    'blocks.caption.useAll':
        'caption: utilisez fingering (le doigté en toutes lettres), formula (notes et intervalles), fingering, formula (les deux) ou none, reçu "{written}"',
    'blocks.caption.useFormula':
        'caption: utilisez formula (notes et intervalles) ou none, reçu "{written}"',
    'blocks.noteSet.chordOrArpeggio': 'Utilisez chord ou arpeggio, pas les deux',
    'blocks.noteSet.invalidRoot':
        'Fondamentale "{root}" invalide : utilisez un nom de note, par ex. root: C',
    'blocks.noteSet.notAList':
        '"{head}" n\'est pas une liste de notes : utilisez par ex. notes: C Eb G',
    'blocks.noteSet.addNotesForRoot':
        'Ajoutez les notes de la fondamentale : par ex. notes: C Eb G',
    'blocks.noteSet.addRoot': 'Ajoutez une fondamentale : C {scale}',
    'blocks.noteSet.addSource': 'Ajoutez "scale:", "chord:" ou "notes:"',
    'blocks.noteSet.rootListsOnlyScale':
        "root ne s'applique qu'aux listes de notes (notes: C E G) : une gamme a sa propre fondamentale",
    'blocks.noteSet.rootListsOnlyChord':
        "root ne s'applique qu'aux listes de notes (notes: C E G) : un accord a sa propre fondamentale",
    'blocks.noteSet.unknownLabelsFingers':
        'labels "{value}" inconnu : utilisez notes, degrees, intervals, fingers ou none',
    'blocks.noteSet.unknownLabels':
        'labels "{value}" inconnu : utilisez notes, degrees, intervals ou none',
    'blocks.noteSet.invalidNotes': 'Notes "{notes}" invalides',
    'blocks.noteSet.unknownScale': 'Gamme "{scale}" inconnue',
    'blocks.noteSet.unknownChord': 'Accord "{chord}" inconnu',
    'blocks.noteSet.notAScaleChordOrList':
        '"{head}" n\'est ni une gamme, ni un accord, ni une liste de notes',
    'blocks.noteSet.highlightNeedsIntervals':
        "highlight demande une gamme, un accord ou une fondamentale : une liste de notes n'a pas d'intervalles (ajoutez par ex. root: C)",
    'blocks.noteSet.notInSet':
        '"{label}" n\'est pas dans {title} : utilisez ses intervalles (R, b3, 5…)',
    'theory.key.needsSharps': '{name} demande {count} dièses : écrivez {write}',
    'theory.key.needsFlats': '{name} demande {count} bémols : écrivez {write}',
    'theory.key.noSignature': 'sans ♯ ni ♭',
    'theory.harmonize.unknownScale':
        'Gamme "{text}" inconnue : utilisez par ex. key: G major, key: A harmonic minor ou key: D dorian',
    'theory.harmonize.sevenNotes': 'harmonize demande une gamme de 7 notes : {name} en a {count}',
    'theory.harmonize.noNamedChord': 'pas un accord nommé',
    'theory.harmonize.noFifth': 'pas de quinte juste',
    'theory.harmonize.noFourthOrSecond': 'pas de quarte juste ni de seconde majeure',
    'blocks.progression.yesNo': '{key} doit valoir yes ou no, reçu "{text}"',
    'blocks.progression.majorMinorKeys':
        'Les tonalités d\'une progression sont majeures ou mineures : écrivez key: {tonic} major ou key: {tonic} minor, reçu "{text}"',
    'blocks.progression.unknownKey':
        'Tonalité "{text}" inconnue : utilisez par ex. key: G, key: Em ou key: F# minor',
    'blocks.progression.unread':
        '"{token}" n\'est pas compris : écrivez des chiffres romains (I V vi IV, bVII, V7, V/V, I6, V65), des chiffres Nashville (1 5 6m 4) ou des accords (G D Em C)',
    'blocks.progression.harmonizeKind':
        'harmonize : écrivez triads, sevenths, sus ou power, reçu "{kind}"',
    'blocks.progression.harmonizeNothing':
        'harmonize : écrivez triads, sevenths, sus ou power, rien reçu',
    'blocks.progression.harmonizeNoChords':
        'harmonize dessine les accords de la gamme : retirez les accords ({written})',
    'blocks.progression.addScale': 'Ajoutez la gamme : par ex. key: A harmonic minor',
    'blocks.progression.transposeWhole':
        'transpose doit être un nombre entier de demi-tons, par ex. transpose: -2',
    'blocks.progression.addChords':
        'Ajoutez les accords : par ex. I V vi IV avec key: G, 1 5 6m 4, ou G D Em C',
    'blocks.progression.addKey': 'Ajoutez la tonalité : par ex. key: G ou key: E minor',
    'blocks.progression.unknownTuning': 'Accordage "{text}" inconnu',
    'blocks.progression.tempo':
        'tempo: écrivez un nombre de temps par minute de {min} à {max}, reçu "{text}"',
    'blocks.progression.strum':
        'strum: écrivez beats, bar, arpeggio ou un rythme de grattage (D DU UDU) : {reason}',
    'blocks.progression.key': 'Tonalité : {name}',
    'blocks.progression.blues': '(blues)',
    'blocks.progression.orKeys': '(ou {list})',
    'blocks.progression.leftOut': 'Écartés : {list}',
    'blocks.progression.leftOutDegree': 'degré {degree} ({note}), {reason}',
    'blocks.progression.unknownInstrument':
        'Instrument "{instrument}" inconnu : utilisez guitar ou piano',
    'blocks.progression.numerals': 'numerals: utilisez roman, nashville ou none, reçu "{style}"',
    'blocks.progression.voiceLeadingPiano':
        "voice-leading ne sert qu'au piano : ajoutez instrument: piano",
    'blocks.progression.pianoOnly':
        "{key} ne sert qu'aux accords de piano : ajoutez instrument: piano",
    'blocks.progression.voiceLeadingHands':
        'voice-leading va avec hands: left+right (une basse à la main gauche sous chaque accord), pas avec une seule main',
    'blocks.progression.voiceLeadingOrKey': 'Utilisez voice-leading ou {key}, pas les deux',
    'blocks.progression.addChordsAfterShared':
        'Ajoutez les accords après les réglages communs, après une ligne "---"',
    'blocks.progression.maxChords': 'Au plus {max} accords par bloc, {count} trouvés',
    'theory.chord.suggest': '{root}, {root}m, {root}7 ou {spelled} {quality}',
    'blocks.render.maxStrings': 'Au plus {max} cordes',
    'blocks.render.invalidRange': 'Étendue "{text}" invalide : utilisez par ex. C3-B4',
    'blocks.render.maxKeys':
        'Au plus {max} touches : donnez une étendue plus petite, par ex. range: C3-B5',
    'blocks.render.wholeFrom1': '{what} doit être un nombre entier à partir de 1, reçu "{text}"',
    'blocks.render.unrecognized': '"{written}" n\'est pas reconnu : essayez {suggestions}',
    'blocks.render.rootForListsOnly':
        "root ne s'applique qu'aux listes de notes sur les manches et les claviers (notes: C E G avec root: C) : un accord a sa propre fondamentale",
    'blocks.chord.capoNotPiano':
        "capo ne sert qu'à la guitare et aux autres instruments à frettes, pas au piano",
    'blocks.chord.pitchesGivenKeys':
        "{given} va avec un symbole d'accord : pitches donne déjà les touches à jouer",
    'blocks.chord.autoNeedsSymbol':
        "fingering: auto va avec un symbole d'accord : écrivez les doigts, par ex. 1 3 5",
    'blocks.chord.invalidPitches': 'Hauteurs "{text}" invalides',
    'blocks.chord.autoCovers':
        "fingering: auto couvre les accords de trois sons et de quatre sons (septièmes, sixtes) en position serrée, ainsi que les voicings sans fondamentale et « shell » qu'une main peut atteindre : écrivez les doigts, par ex. fingering: 1 2 3 4 5",
    'blocks.chord.addSymbolOrPitches': 'Ajoutez un symbole d\'accord ou "pitches:"',
    'blocks.chord.unknownInstrument':
        'Instrument "{instrument}" inconnu : utilisez guitar ou piano, ou donnez un accordage',
    'blocks.chord.invalidFrets': 'Cases "{text}" invalides : utilisez par ex. x02220',
    'blocks.chord.nutAtCapo':
        'Avec frets-from: nut, chaque case jouée est au capodastre ({capo}) ou au-delà : écrivez x pour les cordes en deçà',
    'blocks.chord.capoMaxFret': "Avec un capodastre en {capo}, les cases vont jusqu'à {max}",
    'blocks.chord.fingersCount': '"{text}" donne {fingers} doigts pour {strings} cordes',
    'blocks.chord.noVoicing': 'Aucun voicing {n} trouvé pour "{symbol}" : ajoutez "frets:"',
    'blocks.chord.addFretsFor': 'Ajoutez "frets:" pour {symbol} (par ex. frets: x02220)',
    'blocks.chord.addSymbolAndFrets': 'Ajoutez un symbole d\'accord et "frets:"',
    'blocks.chord.positionAboveLowest':
        'position {base} est au-dessus de la note frettée la plus grave (case {fret})',
    'blocks.chord.tuningStrings': "L'accordage a {tuning} cordes, les cases {frets}",
    'blocks.chord.soundsTitle': '{sounding} (forme {shape})',
    'blocks.chord.captionFormulaChord':
        'caption: formula demande un accord que la bibliothèque connaît : ajoutez son symbole (par ex. symbol: A)',
    'blocks.chord.captionFormulaSet':
        'caption: formula demande un accord ou une gamme que la bibliothèque connaît : ajoutez chord: ou scale:',
    'blocks.chord.soundsTitleNeedsChord':
        'sounds: title demande un accord que la bibliothèque connaît : ajoutez son symbole (par ex. symbol: A)',
    'blocks.chord.soundsNeedsCapo': 'sounds va avec un capodastre : ajoutez par ex. capo: 2',
    'blocks.chord.soundsYesNeedsChord':
        "sounds: yes demande un accord que la bibliothèque connaît : ajoutez son symbole (par ex. symbol: A), ou écrivez l'accord : sounds: B",
    'blocks.chord.soundsMismatch':
        'Avec un capodastre en {capo}, {shape} sonne {sounding}, pas {value} : écrivez sounds: {sounding} (ou sounds: yes)',
    'blocks.chord.unknownLabels':
        'labels "{text}" inconnu : utilisez fingers, intervals, notes ou none',
    'blocks.chord.labelsNeedChord': 'labels: {value} demande un accord que la bibliothèque connaît',
    'blocks.keyboard.autoBothAlone':
        'fingering: auto both dessine deux claviers : mettez-le dans un bloc à part, pas dans une rangée séparée par ---',
    'blocks.keyboard.fingersCount':
        'fingering donne {fingers} doigts : {title} en demande {needed}, un par note de la fondamentale à la fondamentale supérieure',
    'blocks.keyboard.fingersForNotes':
        "fingering donne {fingers} doigts pour {notes} notes : un doigt par note, dans l'ordre écrit",
    'blocks.keyboard.keyTwice': 'Une touche est citée deux fois : un doigt par touche',
    'blocks.keyboard.pastRange':
        "Les notes doigtées dépassent l'étendue : élargissez range: ou retirez-le",
    'blocks.keyboard.handTitleLeft': '{title}, main gauche',
    'blocks.keyboard.handTitleRight': '{title}, main droite',
    'blocks.fretboard.invalidFrets': 'Cases "{text}" invalides : utilisez par ex. 5-8',
    'blocks.fretboard.maxFret': "Les cases vont jusqu'à {max}",
    'blocks.fretboard.nutStartsAtCapo':
        'Avec frets-from: nut, les cases commencent au capodastre ({capo}) ou au-delà : par ex. frets: {capo}-{example}',
    'blocks.fretboard.numberingNeedsPosition':
        'numbering va avec une position : par ex. position: 1 ou positions: all',
    'blocks.fretboard.positionsNeedSet':
        'Les positions demandent une gamme ou un accord : par ex. scale: A minor ou arpeggio: Am7',
    'blocks.fretboard.arpeggioCaged':
        'Les arpèges utilisent les formes CAGED : position 1 à 5, ou shape: E, D, C, A ou G (pas 3nps)',
    'blocks.fretboard.positionCount':
        '{title} a {count} positions {named} : utilisez position 1 à {count}',
    'blocks.fretboard.positionNotFit':
        '{title}, la position {n} ne tient pas dans les cases {from}-{to} : élargissez frets: ou retirez-le',
    'blocks.fretboard.rhythmNeedsExercise': 'rhythm va avec exercise : par ex. exercise: up-down',
    'blocks.fretboard.exerciseNeedsPosition':
        'exercise joue une position : ajoutez position: 1 (ou shape: E)',
    'blocks.fretboard.invalidTempo':
        'Tempo "{text}" invalide : utilisez un nombre de temps par minute de 20 à 240, par ex. tempo: 80',
    'blocks.fretboard.arpeggioTitle': '{name} (arpège)',
    'blocks.fretboard.fromMinor': ' (depuis {minor}m)',
    'blocks.fretboard.shapeTitle': '{name}, forme {shape}',
    'blocks.fretboard.threeNpsTitle': '{name}, 3nps {n}{from}',
    'blocks.fretboard.boxTitle': '{name}, position {n}{from}',
    'blocks.scalesFor.both': 'Utilisez scales-for (accords) ou scales-for-notes, pas les deux',
    'blocks.scalesFor.findsItself': '{key} trouve la gamme seul : retirez "{what}"',
    'blocks.scalesFor.addChords': 'Ajoutez les accords : par ex. scales-for: G D Em C',
    'blocks.scalesFor.addNotes': 'Ajoutez les notes : par ex. scales-for-notes: C D E G A',
    'blocks.scalesFor.unreadChords':
        'Accords "{text}" non compris : utilisez des symboles d\'accord, par ex. scales-for: G D Em C',
    'blocks.scalesFor.unreadNotes':
        'Notes "{text}" non comprises : utilisez des noms de notes, par ex. scales-for-notes: C D E G A',
    'blocks.scalesFor.outside': ', {notes} en dehors',
    'blocks.scalesFor.bluesTitle':
        'Gamme blues de {tonic} pour {listed} (ou {pentatonic}, {mixolydian})',
    'blocks.scalesFor.title': '{name} pour {listed}{outside}',
    'chord.capo.fret': 'capo: utilisez une case de 1 à {max}, reçu "{text}"',
    'chord.capo.fretsFrom': 'frets-from: utilisez capo (par défaut) ou nut, reçu "{text}"',
    'theory.naming.write': 'naming: écrivez letters, solfege ou german',
    'theory.naming.writeDirective': 'naming: écrivez {letters}, {solfege} ou {german}',
    'chord.words.ordinalFirst': '1re',
    'chord.words.ordinalSt': '{n}e',
    'chord.words.ordinalNd': '{n}e',
    'chord.words.ordinalRd': '{n}e',
    'chord.words.ordinalTh': '{n}e',
    'chord.words.listAnd': '{head} et {last}',
    'chord.words.guitarIndex': 'Index',
    'chord.words.guitarMiddle': 'Majeur',
    'chord.words.guitarRing': 'Annulaire',
    'chord.words.guitarPinky': 'Auriculaire',
    'chord.words.guitarThumb': 'Pouce',
    'chord.words.guitarFinger': 'Doigt {finger}',
    'chord.words.pianoThumb': 'pouce',
    'chord.words.pianoIndex': 'index',
    'chord.words.pianoMiddle': 'majeur',
    'chord.words.pianoRing': 'annulaire',
    'chord.words.pianoLittle': 'auriculaire',
    'chord.words.pianoFinger': 'doigt {finger}',
    'chord.words.lowName': '{name} grave',
    'chord.words.highName': '{name} aiguë',
    'chord.words.stringNamed': 'la corde {name}',
    'chord.words.stringsNamed': 'les cordes {names}',
    'chord.words.stringNumberedNote': 'la {n} corde ({note})',
    'chord.words.stringNumbered': 'la {n} corde',
    'chord.words.capoFrom':
        'Capodastre sur la {fret} case : les cases se comptent à partir du capodastre.',
    'chord.words.capoNut': 'Capodastre sur la {fret} case.',
    'chord.words.allMuted': 'Toutes les cordes sont étouffées : aucune note ne sonne.',
    'chord.words.strumSix': 'Grattez les six cordes.',
    'chord.words.strumAll': 'Grattez toutes les cordes.',
    'chord.words.strumFrom': 'Grattez à partir de {from}.',
    'chord.words.strumFromTo': 'Grattez de {from} à {to}.',
    'chord.words.press': 'Appuyez sur {string}, à la {fret} case.',
    'chord.words.fingerOn': '{finger} sur {strings}, {fret} case.',
    'chord.words.fingerBars': '{finger} fait le barré à la {fret} case, cordes {from} à {to}.',
    'chord.words.fingerAlsoOn': '{finger} aussi sur {string}, {fret} case.',
    'chord.words.muteOne': "Étouffez {list} : laissez un doigt de l'accord l'effleurer.",
    'chord.words.mutePlural': "Étouffez {list} : laissez un doigt de l'accord les effleurer.",
    'chord.words.groupRingOpenOne': 'La corde {list} sonne à vide.',
    'chord.words.groupRingOpenPlural': 'Les cordes {list} sonnent à vide.',
    'chord.words.groupRingCapoOne': 'La corde {list} sonne au capodastre.',
    'chord.words.groupRingCapoPlural': 'Les cordes {list} sonnent au capodastre.',
    'chord.words.ringOpenOne': '{list} sonne à vide.',
    'chord.words.ringOpenPlural': '{list} sonnent à vide.',
    'chord.words.ringCapoOne': '{list} sonne au capodastre.',
    'chord.words.ringCapoPlural': '{list} sonnent au capodastre.',
    'chord.words.pianoFingerOn': '{finger} sur {key}',
    'chord.words.pianoAlsoPlay': '{fingered}, et jouez aussi {list}',
    'chord.words.sentence': '{text}.',
    'chord.words.play': 'Jouez {list}.',
    'chord.words.leftHand': 'Main gauche : {part}.',
    'chord.words.rightHand': 'Main droite : {part}.',
    'chord.transition.fingerIndex': "l'index",
    'chord.transition.fingerMiddle': 'le majeur',
    'chord.transition.fingerRing': "l'annulaire",
    'chord.transition.fingerPinky': "l'auriculaire",
    'chord.transition.fingerThumb': 'le pouce',
    'chord.transition.fingerOther': 'le doigt',
    'chord.transition.keep': 'Gardez {finger} sur la {fret} case de {string}.',
    'chord.transition.slide':
        'Faites glisser {finger} le long de {string}, de la case {from} à la case {to}.',
    'chord.transition.moveUp': 'Déplacez la main de {shift} cases vers le haut.',
    'chord.transition.moveDown': 'Déplacez la main de {shift} cases vers le bas.',
    'chord.transition.lift': "Levez tous les doigts ensemble et posez-les d'un bloc.",
    'chord.guitar.capoCaption': 'Capodastre {capo}',
    'chord.guitar.capoCaptionSounds': 'Capodastre {capo}, sonne {sounds}',
    'chord.guitar.diagram': "Diagramme d'accord",
    'chord.guitar.diagramTitled': "Diagramme de l'accord {title}",
    'chord.guitar.rootOnString': 'La fondamentale est sur la corde {list}.',
    'chord.guitar.rootOnStrings': 'La fondamentale est sur les cordes {list}.',
    'chord.triads.rootPosition': 'état fondamental',
    'chord.triads.firstInversion': '1er renversement',
    'chord.triads.secondInversion': '2e renversement',
    'theory.formula.chord': '{written} ({root} {words}{bass}) : {notes}.',
    'theory.formula.inTheBass': ', {bass} à la basse',
    'theory.formula.formula': 'Formule {formula}.',
    'theory.formula.alsoWritten': "S'écrit aussi {list}.",
    'theory.formula.scale': '{title} : {notes}.',
    'theory.formula.steps': 'Intervalles {steps}.',
    'chords.chart.chorus': 'Refrain',
    'chords.chart.bridge': 'Pont',
    'chords.chart.tab': 'Tablature',
    'chords.chart.grid': "Grille d'accords",
    'chords.chart.key': 'Tonalité {key}',
    'chords.chart.capo': 'Capodastre {capo}',
    'chords.chart.tempo': '{bpm} BPM',
    'chords.chart.transposed': 'Transposé de {amount}',
    'chords.chart.simplified': 'Accords simplifiés',
    'chords.chart.sounds': '{title} (sonne {sounding})',
    'chords.chart.moreNotDrawn': '{count} accords de plus non dessinés (au plus {max})',
    'chords.chart.missing': 'Pas de diagramme pour {names} : donnez la forme avec {how}',
    'chords.chart.howPiano':
        '{syntax} (demi-tons au-dessus de la fondamentale, par ex. keys 0 4 7)',
    'chords.chart.howGuitar': '{syntax} (une case par corde, x pour une corde étouffée)',
    'chords.define.needsName': "{syntax} demande un nom d'accord : par ex. {example}",
    'chords.define.baseFret':
        '{at} : base-fret prend un nombre entier de 1 à 24, par ex. base-fret 3',
    'chords.define.frets':
        '{at} : frets prend une valeur par corde (de 2 à {max}) : une case de 0 à 24, ou x pour une corde étouffée, par ex. frets x 0 2 2 1 0',
    'chords.define.keys':
        '{at} : keys prend des demi-tons au-dessus de la fondamentale, de 0 à {max}, par ex. keys 0 4 7',
    'chords.define.copy': "{at} : {word} prend le nom d'un seul accord, par ex. {word} Am",
    'chords.define.unknown':
        '{at} : "{word}" est inconnu : utilisez base-fret, frets, fingers, keys, copy, display ou diagram',
    'chords.define.fingersCount':
        '{at} : fingers a {fingers} valeurs pour {strings} cordes : donnez-en une par corde (0 pour aucune)',
    'chords.define.reaches': "{at} : la forme atteint la case {top} : les cases vont jusqu'à {max}",
    'chords.directive.diagrams': '{at} : utilisez on, off, top ou bottom',
    'chords.directive.simplify': '{at} : utilisez yes ou no',
    'chord.shape.open': 'Accord ouvert',
    'chord.shape.caged': 'forme {letter}',
    'chord.shape.cagedStrings': 'forme {letter} (cordes {strings})',
    'chord.shape.power': 'Power chord',
    'chord.shape.triad': 'Triade',
    'chord.shape.shell': 'Shell',
    'chord.shape.drop': 'Drop {n} (cordes {strings})',
    'chord.shape.hendrix': 'Accord Hendrix',
    'chord.shape.openBass': 'Basse à vide',
    'chord.shape.openStrings': 'Cordes à vide',
    'chord.shape.strings': 'Cordes {strings}',
    'blocks.function.tonic': 'tonique',
    'blocks.function.subdominant': 'sous-dominante',
    'blocks.function.dominant': 'dominante',
    'blocks.function.secondaryDominant': 'dominante secondaire',
    'blocks.function.neapolitan': 'napolitaine',
    'blocks.function.borrowed': 'emprunté',
    'blocks.function.chromatic': 'chromatique',
    'blocks.function.tonicization': 'tonicisation',
    'blocks.function.passing': 'de passage',
    'theory.marks.characteristic': ', notes caractéristiques : {notes}',
    'theory.marks.different': ', différentes de la gamme comparée : {notes}',
    'theory.marks.chordTones': ", notes de l'accord : {notes}"
} as const
