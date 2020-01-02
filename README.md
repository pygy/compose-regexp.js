

# compose-regexp.js

Build and compose *maintainable* regular expressions in JavaScript. 

Regular expressions don't do justice to regular grammars.

- The regular grammar/language formalism is all about [expression composition](https://en.wikipedia.org/w/index.php?title=Regular_language&oldid=748009543#Formal_definition).
- Yet RegExps were designed as a [write-only syntax for command line tools](https://en.wikipedia.org/w/index.php?title=Regular_expression&oldid=762174774#History) like `ed` and `grep`.
- Building large expressions from smaller, abstracted patterns is not possible using RegExp literals.

This makes complex RegExps hard to read, debug and modify... 

`compose-regexp` to the rescue!

It doesn't make regular grammars more powerful, they are still [fundamentally limited](https://en.wikipedia.org/w/index.php?title=Chomsky_hierarchy&oldid=762040114#The_hierarchy), but since they are ubiquitous, we may as well have better tooling to implement them...

## Usage

```Shell
$ npm install --save compose-regexp
```

```JS
import {
    sequence, either, capture,
    ref, suffix, flags, avoid
} from "compose-regexp"; // can be required too

// the example that made me write this, in order to ~lex JS.
// It matches braces in source code, but skips comments and strings.

const string = either(
  sequence(
    '"',
    suffix('*?', // a non-greedy zero-or-more repetition
      either(
        /\\[\s\S]/,
        /./
      )
    ),
    '"'
  ),
  sequence(
    "'",
    suffix('*?',
      either(
        /\\[\s\S]/,
        /./
      )
    ),
    "'"
  ),
  sequence(
    "`",
    suffix('*?',
      either(
        /\\[\s\S]/,
        /[\s\S]/
      )
    ),
    "`"
  )
)

const multiLineComment = sequence(
  '/*',
  suffix('*?',
    /[\s\S]/
  ),
  '*/'
)
const singleLineComment = sequence('//', /[^\n]*\n/)

const comment = either(multiLineComment, singleLineComment)

const matcher = flags('gm',
    either(
        comment,
        string,
        capture(either(/[{}]/, '}}'))
    )
);

// matcher:

/\/\*[\s\S]*?\*\/|\/\/[^\n]*\n|"(?:\\[\s\S]|.)*?"|'(?:\\[\s\S]|.)*?'|`(?:\\[\s\S]|[\s\S])*?`|([{}]|\}\})/gm

// The most astute among you may have noticed that regexes in the subject string
// would still trip that parser. Not perfect, but still useful.
```

## API

### General (important) notes:

The `regexp` parameters of these functions can be either RegExps or strings.
Special characters in strings are escaped, so that `'.*'` is equivalent to `/\.\*/`.
Therefore:

```JS
> sequence('.', '*').source
'\\.\\*'
```

Except for the unicode `u` which is contagious, the flags of intermediate regexps are ignored, and always reset to false unless set by `flags()`.
You can explicitly set, unset and filter flags using the `flagOps.{add|remove|keep}()` functions.


#### either(regexps...) 

```JS
> either(/a/, /b/, /c/)
/a|b|c/
```

#### sequence(regexps...) 

```JS
> sequence(/a/, /b/, /c/)
/abc/
```

ComposeRegexp inserts non-capturing groups where needed:

```JS
> sequence(/a/, /b|c/)
/a(?:b|c)/
```

#### lookAhead(regexps...) 

```JS
> lookAhead(/a/, /b/, /c/)
/(?=abc)/
```

#### avoid(regexps...) 

Negative look ahead

```JS
> avoid(/a/, /b/, /c/)
/(?!abc)/
```

#### suffix(operator, regexprs...), suffix(operator)(regexprs...)

Valid operators: 

| greedy   | non-greedy |
|----------|------------|
| `?`      | `??`       |
| `*`      | `*?`       |
| `+`      | `+?`       |
| `{n}`    | `{n}?`     |
| `{n,}`   | `{n,}?`    |
| `{m, n}` | `{m, n}?`  |


```JS
> suffix("*", either(/a/, /b/, /c/))
/(?:a|b|c)*/
> maybe = suffix('?'); maybe('a')
/a?/
```

#### capture (regexprs...)

```JS
> capture(/a/, /b/, /c/)
/(abc)/
```

#### ref(n) 

```JS
> ref(1)
/\1/
```

*Caveat emptor*, references are absolute. Therefore, refs may be broken if you compose two regexps that use captures.

```JS

stringMatcher = sequence(
    capture(/['"`]/),
    greedy('*', // a greedy zero-or-more repetition
        either(
            sequence('\\', ref(1)),
            '\\\\',
            sequence(avoid(ref(1)), /[\s\S]/)
        )
    ),
    ref(1)
)

whooops = sequence(
    capture('foo'),
    stringMatcher
)
```

In `whoops`, the `ref(1)` in stringMatcher actually refers to `foo`, not the opening quote.

Fixing this would require an approach far more complex than what I'm doing now (concat the regexps source).

#### flags(opts, regexps...), flags(opts)(regexps...)

```JavaScript
> flags('gm', /a/)
/a/gm
> global = flags(g); global('a')
/a/g
```

## License MIT

The MIT License (MIT)

Copyright (c) 2016 Pierre-Yves Gérardy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

