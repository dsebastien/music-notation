/** French texts: exactly the keys of the English file. */
export const frDiagrams = {
    // render/layout
    'render.layout.orientation':
        'Orientation inconnue « {text} » : utilisez vertical ou horizontal',
    'render.layout.hand': 'Main inconnue « {text} » : utilisez left ou right',
    // render/root-mark
    'render.rootMark.invalid': 'root-mark : écrivez color ou shape, reçu « {text} »',
    // render/render-block: shared
    'render.rootListsOnly':
        "root ne s'applique qu'aux listes de notes sur les manches et les claviers (notes: C E G avec root: C) : un accord a sa propre fondamentale",
    'render.unknownChord': "« {written} » n'est pas reconnu : essayez {suggestions}",
    'render.tuning': 'Accordage inconnu « {text} »',
    'render.yesNo': '{key} doit valoir yes ou no, reçu « {text} »',
    'render.hand.left': 'main gauche',
    'render.hand.right': 'main droite',
    // render/render-block: positions
    'render.positions.exerciseOne':
        'exercise joue une seule position : écrivez position: 1 (et non positions:)',
    'render.positions.needsSet':
        'positions demande une gamme ou un accord : par exemple A minor pentatonic ou arpeggio: Am7',
    'render.positions.arpeggioCaged':
        'Les arpèges utilisent les formes CAGED, pas 3nps : retirez shape',
    'render.positions.range':
        'positions : utilisez all, ou des nombres de 1 à {count} pour {title}',
    'render.positions.fromMinor': ' (depuis {root}m)',
    'render.positions.arpeggioTitle': 'Arpège de {title}',
    'render.positions.shapeTitle': '{name}, forme {shape}',
    'render.positions.npsTitle': '{name}, 3nps {n}{from}',
    'render.positions.boxTitle': '{name}, position {n}{from}',
    // render/render-block: fingering and hands
    'render.fingering.handTitle': '{title}, {hand}',
    // render/render-block: voicings
    'render.voicings.notBoth': 'Utilisez triads ou voicings, pas les deux',
    'render.voicings.fretted': 'voicings sert à la guitare et aux autres instruments à frettes',
    'render.voicings.noFrets': 'voicings trouve seul les cases : retirez « {value} »',
    'render.voicings.needsChord': 'voicings demande un accord : par exemple A Major',
    'render.voicings.instrument':
        'Instrument inconnu « {instrument} » : utilisez guitar, ou donnez un accordage',
    'render.voicings.maxStrings': "voicings fonctionne jusqu'à {max} cordes",
    'render.voicings.count': 'voicings : utilisez all, ou un nombre de 1 à {max}',
    'render.voicings.area':
        "area : utilisez open, ou des cases comme 5-9 (jusqu'à 24), reçu « {area} »",
    'render.voicings.rootString':
        'root-string : utilisez un numéro de corde de 1 (la plus aiguë) à {count}',
    'render.voicings.inversion':
        'inversion : utilisez 0 (fondamentale), 1, 2, 3 ou any, reçu « {inversion} »',
    'render.voicings.manyStringsAny':
        'Sur {count} cordes, inversion: any demande six cordes ou moins : ajoutez par exemple strings: 1-6',
    'render.voicings.wideArea': 'une zone large',
    'render.voicings.oneWidening':
        'Sur {count} cordes, utilisez un seul élargissement à la fois parmi {list}',
    // render/render-block: no voicing
    'render.noVoicing.gaps': 'Les cordes {strings} ne sont pas côte à côte : ajoutez gaps: yes',
    'render.noVoicing.rootString': 'root-string {string} ne fait pas partie des cordes {strings}',
    'render.noVoicing.inversion': "{symbol} a {notes} notes : inversion va jusqu'à {max}",
    'render.noVoicing.bass':
        "Aucun voicing de {chord} n'a sa basse sur la corde {string} : essayez une autre root-string",
    'render.noVoicing.none':
        'Aucun voicing jouable de {chord} ne convient : élargissez la zone, autorisez les cordes à vide ou ajoutez stretch: yes',
    // render/render-block: triads
    'render.triads.noFrets': 'triads trouve seul les cases : retirez « {value} »',
    'render.triads.fretted':
        'triads sert à la guitare et aux autres instruments à frettes : donnez un accordage',
    'render.triads.strings': 'triads : donnez trois cordes côte à côte, par exemple 1-3 ou 2-4',
    'render.triads.inversion':
        'inversion : utilisez 0 (position fondamentale), 1, 2 ou any, reçu « {inversion} »',
    'render.triads.keyInversion': 'Avec une tonalité, choisissez un seul renversement : 0, 1 ou 2',
    'render.triads.key':
        'Tonalité inconnue « {text} » : utilisez par exemple key: G major ou key: E minor',
    'render.triads.needsChord':
        'triads demande un accord (par exemple G) ou une tonalité (key: G major)',
    'render.triads.notTriad': "{symbol} n'est pas une triade (trois notes) : essayez voicings: all",
    'render.triads.none':
        'Aucune triade ne tient sur ces cordes : essayez un autre groupe de cordes',
    // render/render-block: transitions
    'render.transitions.needsFrom':
        "Ajoutez l'accord que vous tenez : from: C (avec ses cases : from: C x32010)",
    'render.transitions.fretted':
        'Les transitions servent à la guitare et aux autres instruments à frettes : donnez un accordage',
    'render.transitions.notBoth': 'Utilisez from et to, ou progression, pas les deux',
    'render.transitions.refused': "« {key} » ne peut pas s'utiliser avec {with}",
    'render.transitions.maxStrings': "Les transitions fonctionnent jusqu'à {max} cordes",
    'render.transitions.twoChords':
        'progression : donnez au moins deux accords, par exemple G D Em C',
    'render.transitions.maxChords': 'progression : {max} accords au plus',
    'render.transitions.noVoicings': 'Aucun voicing jouable pour cette progression',
    'render.transitions.needsTo': "Ajoutez l'accord suivant : to: D",
    'render.transitions.noHeld': 'Aucun voicing jouable de {chord} : ajoutez ses cases',
    'render.transitions.stringCount': "« {frets} » compte {have} cordes, l'accordage {count}",
    'render.transitions.count': 'count : utilisez un nombre de 1 à {max}',
    'render.transitions.noTarget': 'Aucun voicing jouable de {chord}',
    // render/render-block: modes
    'render.modes.none': "« {value} » n'a pas de modes : utilisez par exemple modes: C major",
    'render.modes.refused': "« {key} » ne peut pas s'utiliser avec modes : seulement {allowed}",
    // render/render-block: rows
    'render.row.notShared':
        '« {key} » ne peut pas être partagé : déplacez-le dans un diagramme. Réglages partagés : {allowed}',
    'render.row.columns': 'columns doit être un nombre entier de 1 à 12, reçu « {text} »',
    'render.row.needsDiagram':
        'Ajoutez un diagramme après les réglages partagés : une ligne « --- », puis le diagramme',
    'render.row.max': '{max} diagrammes au plus par bloc, {found} trouvés',
    'render.row.columnsShared':
        '« columns » va dans les réglages partagés, avant le premier « --- »',
    'render.row.ownRow': '« {key} » dessine sa propre rangée : utilisez-le dans un bloc à part',
    'render.row.exercise':
        'exercise dessine une tablature sous un seul diagramme : utilisez-le dans un bloc à part',
    'render.row.diagram': 'diagramme {n} : {message}',
    'render.row.sharedHint':
        ' (les réglages partagés avant le premier « --- » ne peuvent contenir que : {allowed})',
    // fretboard/fretboard
    'fretboard.capo': 'Capodastre {fret}',
    'fretboard.title': 'Manche : {title}',
    'fretboard.note.open': '{note} à vide',
    'fretboard.note.fret': '{note} case {fret}',
    'fretboard.note.root': ' (fondamentale)',
    'fretboard.string': 'Corde {n} ({name}) : {notes}.',
    'fretboard.pick.open': 'Corde {string}, à vide',
    'fretboard.pick.fret': 'Corde {string}, case {fret}',
    // fretboard/exercise
    'fretboard.exercise.direction': 'exercise : utilisez up, down ou up-down, reçu « {text} »',
    'fretboard.exercise.rhythm': 'rhythm : utilisez 8ths, triplets ou 16ths, reçu « {text} »',
    'fretboard.exercise.scale': 'Gamme inconnue « {text} »',
    'fretboard.exercise.chord': 'Accord inconnu « {text} »',
    'fretboard.exercise.needsSet':
        'Un exercice demande une gamme ou un arpège : par exemple scale: A minor ou arpeggio: Am7',
    'fretboard.exercise.arpeggioCaged':
        'Les arpèges utilisent les formes CAGED : position 1 à 5, ou shape: E, D, C, A ou G (pas 3nps)',
    'fretboard.exercise.positions':
        '{title} a {count} positions {system} : utilisez position 1 à {count}',
    'fretboard.exercise.tuning': 'Accordage inconnu « {text} »',
    'fretboard.exercise.capo': 'capo : utilisez une case de 1 à 12 (0 pour aucun), reçu {text}',
    // fretboard/positions
    'fretboard.positions.numbering':
        'numbering : utilisez minor (positions depuis le relatif mineur), reçu « {text} »',
    'fretboard.positions.numberingPentatonic':
        'numbering: minor sert aux positions de la pentatonique majeure (par exemple A major pentatonic), pas à {title}',
    'fretboard.positions.numberingCaged':
        'numbering: minor numérote les positions en boîtes et 3nps, pas les formes CAGED',
    'fretboard.positions.position':
        'position doit être un nombre entier à partir de 1, reçu « {text} »',
    'fretboard.positions.shape': 'Forme inconnue « {text} » : utilisez C, A, G, E, D ou 3nps',
    // keyboard/scale-fingering
    'keyboard.fingering.finger':
        'fingering : les doigts vont de 1 (pouce) à 5 (auriculaire), reçu « {text} »',
    'keyboard.fingering.autoNeedsScale':
        'fingering: auto va avec une gamme majeure ou mineure (scale: G major) : écrivez un doigt par note, par exemple fingering: 1 2 3 4 5',
    'keyboard.fingering.autoUnknown':
        'fingering: auto connaît les gammes majeures, mineures naturelles, mineures harmoniques et mineures mélodiques : écrivez les doigts pour {scale}, de la fondamentale à la fondamentale, par exemple fingering: 1 2 3 1 2 3 4 5',
    // keyboard/piano-chord
    'keyboard.piano.shell':
        "Les voicings shell demandent une tierce et une septième ou une sixte (C7, Cmaj7, Cm7, C6) : {symbol} n'en a pas",
    'keyboard.piano.rootless':
        'Les voicings rootless servent aux accords de septième ou de sixte majeurs, mineurs, de dominante (sus4 aussi) et demi-diminués, et aux triades majeures ou mineures (Cmaj7, Cm7, C7, C7sus4, Cm7b5, C6, C, Cm) : pas à {symbol}',
    'keyboard.piano.octave': 'octave : utilisez un nombre de 0 à 8, reçu « {text} »',
    'keyboard.piano.inversion':
        'inversion : utilisez 0 (position fondamentale), 1, 2 ou 3, reçu « {text} »',
    'keyboard.piano.slashInversion': '{symbol} indique déjà sa basse : retirez inversion',
    'keyboard.piano.inversionStyle': 'inversion va avec les voicings close ou open, pas {style}',
    'keyboard.piano.inversionMax': "{symbol} a {notes} notes : inversion va jusqu'à {max}",
    'keyboard.piano.open':
        'Les voicings open demandent trois notes ou plus : {symbol} en a {notes}',
    'keyboard.piano.offKeys':
        'octave {octave} place {symbol} hors du clavier du piano : essayez octave 3 ou 4',
    'keyboard.piano.inversionWord':
        'inversion : utilisez root, first, second, third (ou 0 à 3), reçu « {text} »',
    'keyboard.piano.octaveMiddle':
        'octave : utilisez un nombre de 0 à 8 (4 est celle du do central), reçu « {text} »',
    'keyboard.piano.voicing':
        'voicing : utilisez close, open, shell, shell R-7, rootless A ou rootless B, reçu « {text} »',
    'keyboard.piano.key':
        'Tonalité inconnue « {text} » : utilisez par exemple key: C minor ou key: Eb',
    'keyboard.piano.resolvesTo':
        'resolves-to : écrivez un accord, par exemple resolves-to: Cm, reçu « {text} »',
    'keyboard.piano.hands': 'hands : utilisez left+right, left ou right, reçu « {text} »',
    // keyboard/keyboard
    'keyboard.title': 'Clavier : {title}',
    'keyboard.hand': '{hand} : {keys}',
    'keyboard.handMark.left': 'MG',
    'keyboard.handMark.right': 'MD',
    'keyboard.whiteKey': 'Touche blanche {n}',
    'keyboard.blackKey': 'Touche noire {n}',
    'keyboard.lit.root': 'fondamentale',
    'keyboard.lit.finger': 'doigt {finger}',
    'keyboard.lit.keys': 'Touches : {keys}.',
    // circle
    'circle.label': 'Cycle des quintes, {key} : {signature}{accidentals} ; accords : {chords}',
    'circle.or': 'ou',
    'circle.mode.major': 'majeur',
    'circle.mode.minor': 'mineur',
    'circle.mode.ionian': 'ionien',
    'circle.mode.dorian': 'dorien',
    'circle.mode.phrygian': 'phrygien',
    'circle.mode.lydian': 'lydien',
    'circle.mode.mixolydian': 'mixolydien',
    'circle.mode.aeolian': 'éolien',
    'circle.mode.locrian': 'locrien',
    'circle.key':
        'Tonalité inconnue « {text} » : utilisez par exemple key: G, key: Em ou key: D dorian',
    'circle.mode':
        'Mode inconnu « {text} » : utilisez major, minor, dorian, phrygian, lydian, mixolydian ou locrian',
    'circle.modeTwice':
        'key: {key} indique déjà {mode} : retirez mode ou écrivez seulement la note de la tonalité',
    'circle.chords': 'chords : utilisez triads ou sevenths, reçu « {text} »',
    'circle.dominant':
        'dominant : utilisez major (V, issu du mineur harmonique) ou minor (v), reçu « {text} »',
    'keyboard.piano.unknownChord': 'Accord inconnu « {symbol} »'
} as const
