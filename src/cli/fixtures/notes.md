---
chord_symbol: Am
tags:
    - type/music/chord
---

# Fixture for music-notation check

A good chord:

```chord
Am x02210 x02310
```

A chord the library doesn't read:

```chord
Hm7
```

A fretboard in a tilde fence:

~~~fretboard
A minor pentatonic
position: 1
labels: intervals
title: Box 1
~~~

> [!tip] A keyboard in a callout
>
> ````keyboard
> scale: C major
> range: C4-C5
> ````

- A list item with a chord row:

    ```chord
    C x32010
    ---
    G 3200x3 x
    ```

An empty block draws from the note's properties:

```chord
```

A chord chart:

```chords
{title: Song}
[G]Hello [D]world
```

A tab, whose settings are checked:

```tab
staves: guitar
:4 0.6 2.6
```

A Markdown example, not a block:

````markdown
```chord
Hm7
```
````

```javascript
const notABlock = true
```
