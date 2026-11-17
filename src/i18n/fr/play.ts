/** French texts: the play bars, the copy and full screen controls, tabs and scores. */
export const frPlay = {
    // playback/block-bar.ts: the bar of a block's diagrams
    'playback.bar': 'Lecture',
    'playback.diagram': 'Diagramme',
    'playback.place': '({n} sur {total})',
    'playback.playItem': 'Lire : {name}',
    'playback.playAll': 'Tout lire à la suite',
    'playback.play': 'Lecture',
    'playback.stop': 'Arrêter',
    'playback.loop': 'Boucle',
    'playback.countIn': 'Décompte',
    'playback.click': 'Clic',
    'playback.sound': 'Son',
    'playback.guitar': 'Guitare',
    'playback.guitar.steel': 'Guitare (folk)',
    'playback.guitar.nylon': 'Guitare (classique)',
    'playback.guitar.clean': 'Guitare (son clair)',
    'playback.guitar.overdrive': 'Guitare (son saturé)',
    'playback.piano': 'Piano',
    'playback.tempo': 'Tempo (BPM)',
    'playback.unit.bpm': 'BPM',
    'playback.unit.ms': 'ms',
    'playback.strum': 'Grattage (ms entre les cordes)',
    'playback.dotted': 'compte des noires pointées',

    // playback/strum-bar.ts, picking-bar.ts, progression-bar.ts: the bars in time
    'playback.strumPattern.bar': 'Lire le motif de grattage',
    'playback.picking.bar': 'Lire le motif de picking',
    'playback.progression.bar': 'Lire les accords en rythme',
    'playback.progression.play': 'Lire en rythme',
    'playback.strumChoice': 'Grattage',
    'playback.strum.beats': 'À chaque temps',
    'playback.strum.bar': 'Une fois par mesure',
    'playback.strum.arpeggio': 'Arpège',
    'playback.strum.pattern': 'Motif',

    // playback/copy-image.ts
    'playback.copy.button': 'Copier comme image',
    'playback.copy.hint': 'Maj+clic copie tout le bloc',
    'playback.copy.bar': 'Image',
    'playback.copy.copied': 'Copié',
    'playback.copy.refused': "Autorisez l'accès au presse-papiers pour cette page, puis réessayez.",
    'playback.copy.unsupported':
        "Ce navigateur ne peut pas copier d'images : utilisez une version récente de Chrome, Edge, Safari ou Firefox.",
    'playback.copy.failed': "L'image n'a pas pu être créée.",

    // playback/full-screen.ts
    'playback.full.enter': 'Plein écran',
    'playback.full.exit': 'Quitter le plein écran',

    // playback/controls.ts: a diagram redrawn for the other instrument
    'playback.redraw.sounds': '{heading} (sonne {chord})',
    'playback.redraw.guitar': '{name}, dessiné pour la guitare',
    'playback.redraw.piano': '{name}, dessiné pour le piano',

    // playback/engine.ts, tab/index.ts: the `engine:` line
    'playback.engine.invalid': 'engine: utilisez generaluser, sonivox ou light, reçu « {value} »',
    'playback.guitar.invalid':
        'guitar: utilisez steel, nylon, clean ou overdrive, reçu « {value} »',

    // tab/index.ts: the lines at the top of a tab or score block
    'tab.source.staves': 'staves: utilisez tab, score ou both, reçu « {value} »',
    'tab.source.layout': 'layout: utilisez page ou line, reçu « {value} »',
    'tab.source.names': 'names: utilisez on ou off, reçu « {value} »',
    'tab.source.tracks': 'tracks: utilisez des numéros de piste à partir de 1, reçu « {value} »',
    'tab.source.empty': 'Écrivez la musique en alphaTex, ou indiquez un fichier : {example}',

    // tab/index.ts: messages
    'tab.sound.loadFailed': 'Impossible de charger la banque de sons ({url})',
    'tab.error.at': 'ligne {line}, colonne {column} : ',
    'tab.error.textTab': 'Impossible de dessiner cette tablature en texte : {message}',
    'tab.error.fileRead': 'Impossible de lire « {file} » : {message}',
    'tab.error.fileMissing': 'Fichier « {file} » introuvable',
    'tab.error.fileUnknown':
        "Impossible de lire « {file} » : ce n'est pas un fichier de partition connu d'alphaTab",

    // tab/index.ts: the player bar
    'tab.player.cantPlay': 'Lecture impossible : {message}',
    'tab.player.metronome': 'Métronome',
    'tab.player.pause': 'Pause',
    'tab.names': 'Noms des notes',
    'tab.follow': 'Suivre la musique',
    'tab.followPaused':
        'Suivre la musique (en pause pendant que vous faites défiler : lancez la lecture ou cliquez pour suivre de nouveau)',

    // tab/index.ts: the view switch
    'tab.view.group': 'Vue',
    'tab.view.tab': 'Tablature',
    'tab.view.score': 'Partition',
    'tab.view.both': 'Les deux',
    'tab.view.whatTab': 'tablature',
    'tab.view.whatScore': 'notation standard',
    'tab.view.whatBoth': 'notation standard et tablature',
    'tab.view.drawAs': 'Afficher en {what}',
    'tab.view.drawAsWritten': 'Afficher en {what} (la ligne staves: du bloc)',
    'tab.view.drawAsDefault':
        "Afficher en {what} (valeur par défaut : le bloc n'a pas de ligne staves:)",
    'tab.view.keep': 'Conserver cette vue',
    'tab.view.keepTitle': 'Écrire staves: {staves} en haut du bloc',

    // tab/tempo.ts
    'tab.tempo.group': 'Tempo',
    'tab.tempo.slower': 'Plus lent',
    'tab.tempo.faster': 'Plus rapide',
    'tab.tempo.toPercent': 'Afficher la vitesse en pourcentage',
    'tab.tempo.toBpm': 'Afficher la vitesse en BPM',
    'tab.tempo.reset': 'Revenir à 100 %',
    'tab.tempo.inBpm': 'Tempo en BPM',
    'tab.tempo.inPercent': 'Vitesse en pourcentage',
    'tab.tempo.title': 'Tempo : {bpm} BPM, {percent} % de {tempo} BPM',
    'tab.tempo.speedTitle': 'Vitesse : {percent} %'
} as const
