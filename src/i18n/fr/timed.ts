/** French texts: strumming and picking patterns, image export (exactly the keys of the English file). */
export const frTimed = {
    // --- strum/pattern.ts: reading a pattern -------------------------------------------------
    'strum.time.invalid':
        'Chiffrage « {text} » invalide : écrivez par exemple time: 4/4, 3/4 ou 6/8',
    'strum.swing.invalid':
        'Swing « {text} » invalide : écrivez swing: yes (un swing ternaire, un shuffle), no, ou un pourcentage de 50 (droit) à 75, par exemple swing: 60%',
    'strum.subdivision.invalid':
        'Subdivision « {text} » invalide : utilisez 8ths, 16ths ou triplets',
    'strum.triplets.quarterBeat68':
        'Les triolets demandent un temps à la noire (time: 4/4, 3/4…) ; pour une pulsation en 6/8, écrivez time: 6/8 avec 8ths',
    'strum.triplets.quarterBeat':
        'Les triolets demandent un temps à la noire (time: 4/4, 3/4…) ; pour ce chiffrage, utilisez 8ths ou 16ths',
    'strum.subdivision.tooLong':
        'Les croches sont plus longues qu’un temps de x/{unit} : écrivez subdivision: 16ths',
    'strum.chord.notRecognizedTry': 'Accord « {chord} » non reconnu : essayez {suggestions}',
    'strum.chord.empty':
        'Accord vide « [] » : écrivez l’accord entre les crochets, par exemple [G]',
    'strum.chord.notRecognized': 'Accord « {chord} » non reconnu',
    'strum.line.bracketMissing': '« ] » manquant après « {text} » : écrivez par exemple [G]',
    'strum.line.barInGhost':
        'Une barre de mesure à l’intérieur de ( ) : fermez d’abord les coups fantômes',
    'strum.line.accentAndGhost': 'Un coup est soit accentué (D>), soit fantôme ((D)), pas les deux',
    'strum.line.ghostNested':
        'Les coups fantômes ne peuvent pas être imbriqués : écrivez (U), pas ((U))',
    'strum.line.parenUnopened': '« ) » sans « ( » : écrivez un coup fantôme ainsi : (U)',
    'strum.help':
        'écrivez D ou ↓ (vers le bas), U ou ↑ (vers le haut), X (étouffé), - (pas de coup), > après un coup pour un accent, (U) pour un coup fantôme, [G] pour un changement d’accord',
    'strum.line.notUnderstood': '« {char} » non compris dans « {line} » : {help}',
    'strum.line.accentNeedsStrum': 'Un accent demande un coup : écrivez D> ou U>',
    'strum.line.ghostNoRests': 'Écrivez les coups fantômes (D) ou (U), sans silence à l’intérieur',
    'strum.line.parenUnclosed':
        '« ) » manquant dans « {line} » : écrivez un coup fantôme ainsi : (U)',
    'strum.line.chordEndsPattern':
        'L’accord [{chord}] termine le rythme : placez-le avant un coup ou un -',
    'strum.pattern.chordLineAlone':
        'Une ligne d’accords demande une ligne de rythme dessous, par exemple D - D U - U D U',
    'strum.pattern.missing':
        'Écrivez un rythme de strumming, par exemple D - D U - U D U (ou D DU UDU)',
    'strum.key.unknown':
        'Clé « {key} » inconnue : utilisez time, subdivision, swing, chord, tempo, tuning, title ou pattern',
    'strum.swing.withTriplets':
        'Les triolets et le swing sont deux façons d’écrire un shuffle : gardez subdivision: triplets (D - U sur chaque temps), ou écrivez 8ths avec swing: yes',
    'strum.swing.compound':
        '{time} a déjà trois {unit} par temps : retirez swing: (il swingue les 8ths ou les 16ths en 4/4, 3/4, 2/4…)',
    'strum.swing.oneSlot':
        'Le swing joue des paires de positions dans un temps, et un temps de {time} en {subdivision} n’a qu’une position : écrivez subdivision: 16ths, ou time: 4/4',
    'strum.tempo.invalid':
        'Tempo « {text} » invalide : utilisez un nombre de temps par minute de {min} à {max}, par exemple tempo: 90',
    'strum.bars.tooMany': '{max} mesures au plus dans un rythme : découpez-le en plusieurs blocs',
    'strum.chord.pastEnd':
        'L’accord {chord} dépasse la fin de sa ligne de rythme : déplacez-le au-dessus d’un coup',
    // How many bars and slots a line takes ("1 bar and 2 slots").
    'strum.count.bar.one': '{n} mesure',
    'strum.count.bar.other': '{n} mesures',
    'strum.count.slot.one': '{n} position',
    'strum.count.slot.other': '{n} positions',
    'strum.count.barsAndSlots': '{bars} et {slots}',
    'strum.count.spill':
        '{time} en {subdivision} compte {perBar} positions par mesure, mais « {written} » en prend {slots} ({count}) : mettez un | à la fin de chaque mesure{orTime}',
    'strum.count.spillOrTime': ', ou écrivez {time}',
    'strum.count.mismatch':
        '{time} en {subdivision} compte {perBar} positions par mesure, mais « {written} » en a {n} : remplissez chaque mesure avec - (pas de coup){alternatives}',
    'strum.count.alternative.first': ' ou écrivez {item}',
    'strum.count.alternative.next': ', {item}',
    'strum.count.alternative.last': ' ou {item}',
    'strum.note.one':
        'Lu comme {read}, puis {n} temps sans coup : écrivez un symbole pour chaque position (- pour pas de coup) afin de placer vous-même les coups.',
    'strum.note.other':
        'Lu comme {read}, puis {n} temps sans coup : écrivez un symbole pour chaque position (- pour pas de coup) afin de placer vous-même les coups.',

    // --- strum/render.ts, strum/play.ts --------------------------------------------------------
    'strum.feel.swing': 'Swing',
    'strum.feel.swingPercent': 'Swing {percent} %',
    'strum.feel.swing16': 'Swing en doubles croches',
    'strum.feel.swing16Percent': 'Swing en doubles croches {percent} %',
    'strum.name': 'Rythme de strumming {written}, {time}, {subdivision}{feel}',
    'strum.name.titled': '{title} : rythme de strumming {written}, {time}, {subdivision}{feel}',
    'strum.name.feel': ', {feel}',
    'strum.tuning.unknown':
        'Accordage « {tuning} » inconnu : utilisez par exemple tuning: standard, drop d, ukulele ou E2 A2 D3 G3 B3 E4',
    'strum.tuning.tooManyStrings': '12 cordes au plus',
    'strum.tuning.unknownGiven': 'Accordage « {tuning} » inconnu',

    // --- picking/pattern.ts, render.ts, voicing.ts ------------------------------------------
    'picking.help':
        'écrivez p (le pouce sur la basse), p’ (la basse alternée), i, m, a (cordes 3, 2, 1), un numéro de corde à partir de 1 (la plus aiguë), - pour un silence, + entre des notes jouées ensemble (p+a)',
    'picking.token.notUnderstood': '« {token} » non compris : {help}',
    'picking.string.missing':
        'La corde {n} n’existe pas : les cordes vont de 1 (la plus aiguë) à {strings}',
    'picking.bar.slots':
        'Une mesure de {time} en {subdivision} compte {perBar} positions, {found} trouvées{between} : ajoutez des notes ou des silences (-) pour que chaque mesure en ait {perBar}, ou changez time:',
    'picking.bar.betweenBarLines': ' entre les barres de mesure',
    'picking.key.unknown':
        'Clé « {key} » inconnue : utilisez time, subdivision, swing, chord, chords, tempo, tuning, title ou pattern',
    'picking.swing.pairs':
        'Le swing joue des paires de 8ths ou de 16ths dans un temps : retirez swing:, ou écrivez time: 4/4 avec 8ths',
    'picking.tempo.invalid':
        'Tempo « {text} » invalide : utilisez un nombre de temps par minute de {min} à {max}, par exemple tempo: 80',
    'picking.pattern.twice':
        'Écrivez le motif une seule fois : avec pattern: ou avec des lignes de motif, pas les deux',
    'picking.pattern.missing':
        'Écrivez un motif : une ligne comme p i m a p i m a, ou pattern: travis, alternate bass ou 1-2-3-4',
    'picking.chords.tooMany': '{max} accords au plus, {found} trouvés',
    'picking.tuning.unknown':
        'Accordage « {tuning} » inconnu : utilisez par exemple tuning: standard, drop d, open g ou E2 A2 D3 G3 B3 E4',
    'picking.name': 'Motif de picking {written}, {time}, {subdivision}{over}',
    'picking.name.titled': '{title} : motif de picking {written}, {time}, {subdivision}{over}',
    'picking.name.over': ', sur {chords}',
    'picking.voicing.none': 'Aucun doigté jouable de {chord} pour cet accordage',

    // --- export/image.ts -------------------------------------------------------------------------
    'export.image.title': 'Notation musicale'
} as const
