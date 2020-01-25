# Composing Regular Expressions

...in JavaScript, but you may enjoy the ride even if you don't use JS... Except if you're a Ruby user, that language has good, native support for RegExp composition.

## Let there be RegExen

Regular Expressions were intrtoduced to practical computing in 1968 by Ken Thompson, literally for write-only programming. They were intended as a command line DSL for text searching, at a time when users typed blindly at the terminal and read the output that was coming out of a noisy teleprinter. Terminals with a Visual Display Unit were being invented at that very time, but they weren't on the market yet.

[Worse-is-bettter][wib] made RegExps graduate from the UNIX CLI to become the de-facto language for light-weight parsing ^1, and they are nowadays natively supported by many languages. Their syntax has seldom evolved, though, and it is wholly inadequate for writing maintainable, testable and/or composable parsers. Multi-line RegExp syntax in Python help a bit with readability, but not with the other aspects.

It is all the more ironic because the [regular language formalism][formalism] (^*), their inspiration, is all about composition. Steven Cole Kleene (of the star fame) invented regular expressions in 1951 as a way to represent a certain kind of formal language. Computer Science is math, and math are all about abstraction. RegExps were used to succintly describe the composition of other patterns represented as variables.

RegExps implementations, however, have rarely bothered to comply with their formal roots. Thomson's original engine only supported postfix operators on single characters (or character sets), not on longer patterns. They were thus underpowered. OTOH, many modern RegExp engines are more powerful than regular parsers.

TODO: concision in both original usages made sense, it 

Regardless, the syntax has barely evolved and many implementations won't let one create a new expression by composing smaller ones that have been stored in variables and that's annoying.

/Adada rewrite

## The pitfals of source strings concatenation

The de-facto solution to the syntactic rigidity in JavaScript is RegExp source string concatenation, but it comes with its own set of problems:

- If escape sequences are annoying when writing RegExps, they are doubly so when using source strings. `/\\/` becomes '\\\\', etc.
- You can't blindly concatenate subexpressions or add suffix operators:
  - For sequential compositions (`/a/` + `/b/` => `/ab/`) you must be mindful of the choice operator (the pipe): `RegExp('a' + 'b|c')` matches either `'a'` or `'bc'`, unlike `/a(?:b|c)/` which matches either `'ab'` or `'ac'`.
  - Suffix operators only apply to the last sub-expression. `/^ab+$/` matches `'abbb'` but not `'abab'`. It is also true with source strings, but the problem may not be obvious if you are adding the suffix to an expression stored in a variable. `RegExp(myVar, '+')` may be fine when you first write it (because you know that `myVar` is atomic), but then it will break when later on, you turn `myVar` into a more complex expression but forget how it is used.
  - This is compounded by the fact that the [atomicity of astral plane characters][matthias-bynens] depends on whether you plan to use the `u` flag on your regexp.
- The last three issues can be solved by liberally sprinkling non-capturing groups, but it adds to the eyesore caused by escape sequences, and the fact that you can't logically indent the parser DSL without adding even more visual noise.

You end up with [heroic efforts][node-semver] with pages of code that look like this:

```JS
```

There are libraries like [XRegExp][xregexp] that help deal with the pain, but 

Imagine you could instead write this:

```JS
x.xRangePlain = sequence(
    /[v=\s]*/,
    capture(x.xRangeIdentifier),
    '.', capture(x.xRangeIdentifier),
    '.', capture(x.xRangeIdentifier),
    maybe(x.preRelease),
    maybe(x.build)
)
```

The above code isn't whishful thinking, [you can see it working live here][crx-flems]. The next sections will expand on the `compose-regexp` library that is used to achieve it.

## `compose-regexp`

`compose-regexp` takes a page from [parser combinators], and applies it to regular expressions. While it doesn't make RegExps more powerful from a parsing theory standpoint (you won't match a context-free language with JS RegExps), it lets one avoid the aforementioned issues:

- Escaping is handled automatically. `sequence(/\[a-z]/, /(.*))/` becomes `/[a](.*)/` which will capture anything that comes after a lower case letter, but if you replace the regexps with strings, `sequence('[a-z]', '(.*)')` becomes `/\[a-z]\(\.\*\)/`, which matches the literal `"[a-z](.*)"` string.
- Composition is king. The combinators detect when a non-capturing group is needed to presevre the expected semantics. Thus:
  - `sequence('a', /b/)` retruns `/ab/`, but `sequence('a', /bc|de/)` becomes `/a(?:bc|de)/`
  - `suffix('*', /[A-Za-z]/)` returns `/[A-Za-z]*/` whereas `suffix('*', /ab/)` returns `/(?:ab)*/`.
  - when the `u` flag is used, the library treats astral plane characters as atomic. Otherwise, they are treated as sequences and wrapped in non-capturing groups if needed.
- You can use indentation to reflect the parser structure and nesting levels.

The whole library is very small 

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --

^1 ...unless you need to climb the Chomsky hierarchy. The RegExp engines of some languages are extended to support context-free languages, but it isn't the case for JavaScript, where rules can't be self- or mutually recursive.

^* as defined by Kleene of the star fame.

[crx-flems]()
[formalism](wikipedia/regular grammars)
[matthias-bynens](JS has a unicode problem)
[node-semver]()
[wib](https://en.wikipedia.org/wiki/Worse_is_better)
[xregexp]


## Appendix: The regexr challenge

Given

```JS
int = /\d+/
ints = int.source
```

Write a RegExp that matches cash amounts like `"$5"` or `"$3.25"`.


### in JS

#### Concatenate JS strings with `+`

```JS
cash = new RegExp('\\$' + ints + "(?:\\." + ints + ")?")
```

#### `new RegExp` with a template string

```JS
cash = new RegExp(`\\$${ints}(?:\\.${ints})?`)
```

#### [`regexr`]()

```JS
cash = regexr`\$${int}(?:\.${int})?`
```

#### [`compose-regexp`](), on one line:

```JS
maybe = suffix('?')
cash = sequence('$', int, maybe('.', int))
```

#### [`compose-regexp`](), on multiple lines:

```JS
cash = sequence(
    '$', int,
    maybe('.', int)
)
```

### in ruby

The Ruby regexp engine lets one compose sub-expressions natively through interpolation.

It beats compose-regexp on the semantics side, because it preserves the flags of sub-expressions, something we can't do in JS since the flags only apply to the whole expression. On the syntax side, I still find the result noisy on one line, but I like the multi-line examples.

#### A plain Regexp literal

```ruby
cash = /\$#{int}(?:\.#{int})?/
```

#### An extended Regexp literal with escape sequences on one line

```ruby
cash = / \$ #{int} (?: \. #{int} )?/x
```

#### An extended Regexp literal with a char sets on one line

```ruby
cash = /[$] #{int} (?: [.] #{int} )?/x
```

#### An extended Regexp literal with escape sequences multiple lines

```ruby
cash = /
  [$] #{int} 
  (?: [.] #{int} )?
/x
```

#### An extended Regexp literal with char sets on one line

```ruby
cash = /
  \$ #{int} 
  (?: \. #{int} )?
/x
```
