import { describe, it, expect, vi } from 'vitest'
import Enumeration, { is, SubscriptProxy } from '../src/enumeration.mjs'

// ---------------------------------------------------------------------------
// Shared fixture classes (defined once, reused across suites)
// ---------------------------------------------------------------------------

class Direction extends Enumeration {
  static {
    Direction.define('north')
    Direction.define('south')
    Direction.define('east')
    Direction.define('west')
  }
}

class Status extends Enumeration {
  static {
    Status.define('ok',       200)
    Status.define('notFound', 404)
    Status.define('error',    500)
  }
}

class Color extends Enumeration {
  toHex() {
    const { r, g, b } = this
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
  }

  static {
    Color.define('red',   { r: 255, g: 0,   b: 0,   a: 255 })
    Color.define('green', { r: 0,   g: 255, b: 0,   a: 255 })
    Color.define('blue',  { r: 0,   g: 0,   b: 255, a: 255 })
    Color.define('rgb', null, {
      get value() { return this.associations ?? { r: 0, g: 0, b: 0, a: 255 } }
    })
  }
}

// ---------------------------------------------------------------------------
// is — internal type toolkit
// ---------------------------------------------------------------------------

describe('is toolkit', () => {
  describe('is.object', () => {
    it('returns true for plain objects', () => expect(is.object({})).toBe(true))
    it('returns true for arrays', () => expect(is.object([])).toBe(true))
    it('returns true for class instances', () => expect(is.object(new Date())).toBe(true))
    it('returns false for null', () => expect(is.object(null)).toBe(false))
    it('returns false for primitives', () => {
      expect(is.object(1)).toBe(false)
      expect(is.object('s')).toBe(false)
      expect(is.object(true)).toBe(false)
    })
  })

  describe('is.function', () => {
    it('returns true for function declarations', () => expect(is.function(function(){})).toBe(true))
    it('returns true for arrow functions', () => expect(is.function(() => {})).toBe(true))
    it('returns true for Function instances', () => expect(is.function(new Function())).toBe(true))
    it('returns false for non-functions', () => expect(is.function(42)).toBe(false))
  })

  describe('is.array', () => {
    it('returns true for arrays', () => expect(is.array([])).toBe(true))
    it('returns false for objects', () => expect(is.array({})).toBe(false))
    it('returns false for strings', () => expect(is.array('abc')).toBe(false))
  })

  describe('is.number', () => {
    it('returns true for number literals', () => expect(is.number(42)).toBe(true))
    it('returns true for Number objects', () => expect(is.number(new Number(1))).toBe(true))
    it('returns false for strings', () => expect(is.number('42')).toBe(false))
    it('returns true for NaN (typeof NaN === "number")', () => expect(is.number(NaN)).toBe(true))
  })

  describe('is.objectKey', () => {
    it('accepts strings', () => expect(is.objectKey('key')).toBe(true))
    it('accepts numbers', () => expect(is.objectKey(0)).toBe(true))
    it('accepts symbols', () => expect(is.objectKey(Symbol())).toBe(true))
    it('rejects objects', () => expect(is.objectKey({})).toBe(false))
    it('rejects booleans', () => expect(is.objectKey(true)).toBe(false))
  })

  describe('is.objectEntry', () => {
    it('returns true for [string, any]', () => expect(is.objectEntry(['key', 'val'])).toBe(true))
    it('returns true for [number, any]', () => expect(is.objectEntry([1, 'val'])).toBe(true))
    it('returns true for [symbol, any]', () => expect(is.objectEntry([Symbol(), 'val'])).toBe(true))
    it('returns false for single-element arrays', () => expect(is.objectEntry(['key'])).toBe(false))
    it('returns false for three-element arrays', () => expect(is.objectEntry(['k','v','extra'])).toBe(false))
    it('returns false for non-arrays', () => expect(is.objectEntry('key')).toBe(false))
    it('returns false when first element is not a key type', () => {
      expect(is.objectEntry([{}, 'val'])).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// Enumeration — constructor and core properties
// ---------------------------------------------------------------------------

describe('Enumeration constructor', () => {
  it('sets .key and .value on the instance', () => {
    const e = new Enumeration('foo', 'bar')
    expect(e.key).toBe('foo')
    expect(e.value).toBe('bar')
  })

  it('defaults .value to .key when value is omitted', () => {
    const e = new Enumeration('foo')
    expect(e.value).toBe('foo')
  })

  it('defaults .value to .key when value is undefined', () => {
    const e = new Enumeration('foo', undefined)
    expect(e.value).toBe('foo')
  })

  it('allows explicit undefined value via acceptUndefinedValue flag', () => {
    const e = new Enumeration('foo', undefined, true)
    expect(e.value).toBeUndefined()
  })

  it('sets .associations to null initially', () => {
    const e = new Enumeration('foo')
    expect(e.associations).toBeNull()
  })

  it('does not expose .associations as an enumerable property', () => {
    const e = new Enumeration('foo')
    expect(Object.keys(e)).not.toContain('associations')
  })
})

// ---------------------------------------------------------------------------
// Enumeration.define
// ---------------------------------------------------------------------------

describe('Enumeration.define', () => {
  it('registers a static getter on the subclass', () => {
    expect(Direction.north).toBeDefined()
    expect(Direction.north).toBeInstanceOf(Direction)
  })

  it('always returns the same instance (getter is stable)', () => {
    expect(Direction.north).toBe(Direction.north)
  })

  it('sets .key and .value from define arguments', () => {
    expect(Status.ok.key).toBe('ok')
    expect(Status.ok.value).toBe(200)
  })

  it('defaults .value to .key when no value supplied', () => {
    expect(Direction.north.value).toBe('north')
  })

  it('throws TypeError for invalid key types', () => {
    class Tmp extends Enumeration {}
    expect(() => Tmp.define({})).toThrow(TypeError)
    expect(() => Tmp.define(null)).toThrow(TypeError)
    expect(() => Tmp.define([])).toThrow(TypeError)
  })

  it('accepts symbol keys', () => {
    const sym = Symbol('myCase')
    class Sym extends Enumeration {
      static { Sym.define(sym, 'symValue') }
    }
    expect(Sym[sym].key).toBe(sym)
    expect(Sym[sym].value).toBe('symValue')
  })

  it('accepts an objectEntry [caseName, caseValue] as value arg', () => {
    class Tmp extends Enumeration {
      static { Tmp.define('prop', ['actualKey', 42]) }
    }
    // property on the class is still 'prop', but the case key is 'actualKey'
    expect(Tmp.prop.key).toBe('actualKey')
    expect(Tmp.prop.value).toBe(42)
  })

  it('accepts a plain object as customizeInstance (copies descriptors)', () => {
    class Tmp extends Enumeration {
      static {
        Tmp.define('item', 'base', {
          get extra() { return 'bonus' }
        })
      }
    }
    expect(Tmp.item.extra).toBe('bonus')
  })

  it('accepts a function as customizeInstance', () => {
    class Tmp extends Enumeration {
      static {
        Tmp.define('item', 'base', instance => {
          instance.custom = 'injected'
          return instance
        })
      }
    }
    expect(Tmp.item.custom).toBe('injected')
  })

  it('ignores customizeInstance function when it does not return a valid instance', () => {
    class Tmp extends Enumeration {
      static {
        Tmp.define('item', 'base', () => null) // returns null, not an instance
      }
    }
    expect(Tmp.item).toBeInstanceOf(Tmp)
    expect(Tmp.item.value).toBe('base')
  })
})

// ---------------------------------------------------------------------------
// Instance identity and comparison
// ---------------------------------------------------------------------------

describe('instance identity', () => {
  it('instances are instanceof their own class', () => {
    expect(Direction.north).toBeInstanceOf(Direction)
  })

  it('instances are instanceof Enumeration', () => {
    expect(Direction.north).toBeInstanceOf(Enumeration)
  })

  it('different cases of the same class are not ===', () => {
    expect(Direction.north).not.toBe(Direction.south)
  })

  it('.is() returns true for the same case', () => {
    expect(Direction.north.is(Direction.north)).toBe(true)
  })

  it('.is() returns false for different cases', () => {
    expect(Direction.north.is(Direction.south)).toBe(false)
  })

  it('.is() compares by key, so a variant with associations matches its base case', () => {
    const variant = Direction.north.associate({ extra: 1 })
    expect(variant.is(Direction.north)).toBe(true)
  })

  it('static Enumeration.is() works symmetrically', () => {
    expect(Enumeration.is(Direction.north, Direction.north)).toBe(true)
    expect(Enumeration.is(Direction.north, Direction.south)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SubscriptProxy — property lookup fallthrough
// ---------------------------------------------------------------------------

describe('SubscriptProxy', () => {
  it('surfaces value properties directly on the instance', () => {
    expect(Color.red.r).toBe(255)
    expect(Color.red.g).toBe(0)
    expect(Color.red.b).toBe(0)
  })

  it('allows destructuring from value', () => {
    const { r, g, b, a } = Color.red
    expect(r).toBe(255)
    expect(g).toBe(0)
    expect(b).toBe(0)
    expect(a).toBe(255)
  })

  it('does not override real instance properties like .key and .value', () => {
    expect(Color.red.key).toBe('red')
    expect(Color.red.value).toEqual({ r: 255, g: 0, b: 0, a: 255 })
  })

  it('surfaces association properties when associations are set', () => {
    const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
    expect(chestnut.r).toBe(200)
    expect(chestnut.g).toBe(76)
  })

  it('associations shadow value properties in the proxy', () => {
    // rgb has value = null; after association, associations.r should surface
    const variant = Color.rgb.associate({ r: 99, g: 0, b: 0, a: 255 })
    expect(variant.r).toBe(99)
  })

  it('can set an association property through the proxy', () => {
    const variant = Color.rgb.associate({ r: 10, g: 20, b: 30, a: 255 })
    variant.r = 99
    expect(variant.associations.r).toBe(99)
  })

  it('does not set a missing property into associations when there are none', () => {
    // Direction cases have no associations; setting an unknown property
    // should go through normal Reflect.set
    const north = Direction.north
    north.extra = 'data'
    expect(north.extra).toBe('data')
    expect(north.associations).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// associate()
// ---------------------------------------------------------------------------

describe('associate()', () => {
  it('returns a new object, not the original case', () => {
    const variant = Color.red.associate({ custom: true })
    expect(variant).not.toBe(Color.red)
  })

  it('the variant is still instanceof the original class', () => {
    const variant = Color.red.associate({ custom: true })
    expect(variant).toBeInstanceOf(Color)
  })

  it('the original static case is unmodified', () => {
    Color.red.associate({ custom: true })
    expect(Color.red.hasAssociatedValues).toBe(false)
    expect(Color.red.associations).toBeNull()
  })

  it('stores the associations object', () => {
    const variant = Color.red.associate({ r: 1, g: 2 })
    expect(variant.associations).toEqual({ r: 1, g: 2 })
  })

  it('accepts an objectEntry [key, value] argument', () => {
    const variant = Direction.north.associate(['label', 'NN'])
    expect(variant.associations.label).toBe('NN')
  })

  it('accepts a bare key argument (value equals key)', () => {
    const variant = Direction.north.associate('tag')
    expect(variant.associations.tag).toBe('tag')
  })

  it('accepts multiple arguments of mixed types', () => {
    const variant = Direction.north.associate(
      { a: 1 },
      ['b', 2],
      'c'
    )
    expect(variant.associations.a).toBe(1)
    expect(variant.associations.b).toBe(2)
    expect(variant.associations.c).toBe('c')
  })

  it('merges into existing associations when called on a variant', () => {
    const v1 = Color.red.associate({ x: 1 })
    const result = v1.associate({ y: 2 })
    expect(result).toBe(v1) // same object, not a new copy
    expect(v1.associations).toEqual({ x: 1, y: 2 })
  })

  it('.hasAssociatedValues is true after associating', () => {
    expect(Color.red.associate({ x: 1 }).hasAssociatedValues).toBe(true)
  })

  it('.hasAssociatedValues is false on a plain case', () => {
    expect(Color.red.hasAssociatedValues).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// associated()
// ---------------------------------------------------------------------------

describe('associated()', () => {
  it('retrieves a named association by key', () => {
    const v = Color.red.associate({ custom: 42 })
    expect(v.associated('custom')).toBe(42)
  })

  it('returns undefined when there are no associations (null?.key === undefined)', () => {
    expect(Direction.north.associated('anything')).toBeUndefined()
  })

  it('returns undefined for a missing key when associations exist', () => {
    const v = Color.red.associate({ x: 1 })
    expect(v.associated('missing')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Serialization / coercion
// ---------------------------------------------------------------------------

describe('serialization and coercion', () => {
  it('toString() returns the key as a string', () => {
    expect(Direction.north.toString()).toBe('north')
  })

  it('template literal uses toString()', () => {
    expect(`${Direction.north}`).toBe('north')
  })

  it('valueOf() returns .value', () => {
    expect(Status.ok.valueOf()).toBe(200)
  })

  it('Symbol.toPrimitive with number hint returns numeric value when value is a number', () => {
    expect(+Status.ok).toBe(200)
  })

  it('Symbol.toPrimitive with number hint returns NaN when value is not a number', () => {
    expect(+Direction.north).toBeNaN()
  })

  it('Symbol.toPrimitive with string hint returns key as string', () => {
    expect(`${Status.ok}`).toBe('ok')
  })

  it('Symbol.toStringTag returns the class name', () => {
    expect(Direction.north[Symbol.toStringTag]).toBe('Direction')
    expect(Color.red[Symbol.toStringTag]).toBe('Color')
  })

  it('.case returns "ClassName.key"', () => {
    expect(Direction.north.case).toBe('Direction.north')
    expect(Status.ok.case).toBe('Status.ok')
  })
})

// ---------------------------------------------------------------------------
// Iteration
// ---------------------------------------------------------------------------

describe('iteration', () => {
  it('Symbol.iterator yields [key, value] pairs', () => {
    const entries = [...Direction]
    expect(entries).toHaveLength(4)
    expect(entries[0]).toEqual(['north', Direction.north])
  })

  it('only yields entries that are instanceof the class', () => {
    for (const [, value] of Direction) {
      expect(value).toBeInstanceOf(Direction)
    }
  })

  it('cases() yields all keys', () => {
    expect([...Direction.cases()]).toEqual(['north', 'south', 'east', 'west'])
  })

  it('values() yields all case instances', () => {
    const vals = [...Direction.values()]
    expect(vals).toHaveLength(4)
    expect(vals[0]).toBe(Direction.north)
  })

  it('cases() and values() are consistent', () => {
    const cases = [...Direction.cases()]
    const values = [...Direction.values()]
    cases.forEach((key, i) => expect(values[i].key).toBe(key))
  })

  it('inherited Enumeration static methods are not yielded as cases', () => {
    const keys = [...Direction.cases()]
    expect(keys).not.toContain('define')
    expect(keys).not.toContain('match')
  })
})

// ---------------------------------------------------------------------------
// from()
// ---------------------------------------------------------------------------

describe('from()', () => {
  it('find case with basic value equality check', () => {
    expect(Direction.from('north')).toEqual(Direction.north)
  })

  it('find case with complex matcher function', () => {
    expect(Color.from(null, (_, caseValue) => {
      return caseValue.r >= 128 // color is reddish
    })).toEqual(Color.red)
  })
})

// ---------------------------------------------------------------------------
// match()
// ---------------------------------------------------------------------------

describe('match()', () => {
  it('returns true when instance is a known case and no present handler given', () => {
    expect(Color.match(Color.red)).toBe(true)
  })

  it('returns false when instance is null', () => {
    expect(Color.match(null)).toBe(false)
  })

  it('returns false when instance is a string', () => {
    expect(Color.match('red')).toBe(false)
  })

  it('returns false when instance is from a different enum class', () => {
    expect(Color.match(Direction.north)).toBe(false)
  })

  it('calls present handler with (instance, baseCase, associations)', () => {
    const handler = vi.fn(() => 'result')
    Color.match(Color.red, handler)
    expect(handler).toHaveBeenCalledWith(Color.red, Color.red, Color.red.value)
  })

  it('falls back to value when no associations and value is an object', () => {
    const result = Color.match(Color.red, (_, __, { r }) => r)
    expect(result).toBe(255)
  })

  it('passes {} when no associations and value is not an object', () => {
    const result = Direction.match(Direction.north, (_, __, obj) => obj)
    expect(result).toEqual({})
  })

  it('passes associations to present handler for a variant', () => {
    const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
    const result = Color.match(chestnut, (_, __, { r }) => r)
    expect(result).toBe(200)
  })

  it('returns plain present value when present is not a function', () => {
    expect(Color.match(Color.red, 'found')).toBe('found')
  })

  it('calls missing handler when not found', () => {
    const handler = vi.fn(() => 'nope')
    const result = Color.match(null, undefined, handler)
    expect(handler).toHaveBeenCalledWith(null)
    expect(result).toBe('nope')
  })

  it('returns plain missing value when missing is not a function', () => {
    expect(Color.match(null, undefined, 'absent')).toBe('absent')
  })

  it('returns false by default when missing and no handler given', () => {
    expect(Color.match(null, 'found')).toBe(false)
  })

  it('works for a variant case (identifies by key)', () => {
    const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
    expect(Color.match(chestnut)).toBe(true)
  })

  it('passes the variant instance (not the base case) as first arg to present', () => {
    const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
    Color.match(chestnut, instance => {
      expect(instance).toBe(chestnut)
    })
  })

  it('passes the base case (no associations) as second arg to present', () => {
    const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
    Color.match(chestnut, (_, baseCase) => {
      expect(baseCase).toBe(Color.rgb)
    })
  })
})

// ---------------------------------------------------------------------------
// asyncMatch()
// ---------------------------------------------------------------------------

describe('asyncMatch()', () => {
  it('returns a Promise', () => {
    expect(Color.asyncMatch(Color.red)).toBeInstanceOf(Promise)
  })

  it('resolves to true when instance is a known case', async () => {
    await expect(Color.asyncMatch(Color.red)).resolves.toBe(true)
  })

  it('resolves to false when instance is null', async () => {
    await expect(Color.asyncMatch(null)).resolves.toBe(false)
  })

  it('falls back to value when no associations and value is an object', async () => {
    const result = await Color.asyncMatch(Color.red, async (_, __, { r }) => r)
    expect(result).toBe(255)
  })

  it('passes {} when no associations and value is not an object', async () => {
    const result = await Direction.asyncMatch(Direction.north, async (_, __, obj) => obj)
    expect(result).toEqual({})
  })

  it('awaits an async missing handler', async () => {
    const result = await Color.asyncMatch(
      null,
      undefined,
      async () => 'async-missing'
    )
    expect(result).toBe('async-missing')
  })

  it('passes associations to present handler for a variant', async () => {
    const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
    const result = await Color.asyncMatch(chestnut, async (_, __, { r }) => r)
    expect(result).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Subclass methods
// ---------------------------------------------------------------------------

describe('subclass instance methods', () => {
  it('prototype methods are callable on static cases', () => {
    expect(Color.red.toHex()).toBe('#ff0000')
    expect(Color.green.toHex()).toBe('#00ff00')
    expect(Color.blue.toHex()).toBe('#0000ff')
  })

  it('prototype methods work on variants with associated values', () => {
    const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
    expect(chestnut.toHex()).toBe('#c84c31')
  })
})

// ---------------------------------------------------------------------------
// SubscriptProxy (unit tests for the exported function itself)
// ---------------------------------------------------------------------------

describe('SubscriptProxy (exported function)', () => {
  it('returns a Proxy', () => {
    const proxy = SubscriptProxy({})
    expect(proxy).toBeTypeOf('object')
  })

  it('passes through normal property access', () => {
    const obj = { existing: 42 }
    const proxy = SubscriptProxy(obj)
    expect(proxy.existing).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// Edge cases and integration
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('two separate subclasses do not share cases', () => {
    expect([...Direction.cases()]).not.toContain('red')
    expect([...Color.cases()]).not.toContain('north')
  })

  it('cases defined with numeric keys work correctly', () => {
    class HttpCode extends Enumeration {
      static {
        HttpCode.define(200, 'OK')
        HttpCode.define(404, 'Not Found')
      }
    }
    expect(HttpCode[200].key).toBe(200)
    expect(HttpCode[200].value).toBe('OK')
    expect([...HttpCode.cases()]).toContain('200') // Object.keys coerces to string
  })

  it('a case with null value uses custom getter via customizeInstance', () => {
    // Color.rgb uses a custom value getter; default value is the default obj
    expect(Color.rgb.value).toEqual({ r: 0, g: 0, b: 0, a: 255 })
    const variant = Color.rgb.associate({ r: 1, g: 2, b: 3, a: 255 })
    expect(variant.value).toEqual({ r: 1, g: 2, b: 3, a: 255 })
  })

  it('match() is scoped to its own class — does not match cases from another class', () => {
    expect(Direction.match(Color.red)).toBe(false)
    expect(Color.match(Direction.north)).toBe(false)
  })

  it('can define a new case on an existing enum after initial static block', () => {
    class Fruit extends Enumeration {
      static { Fruit.define('apple') }
    }
    Fruit.define('banana')
    expect(Fruit.banana).toBeInstanceOf(Fruit)
    expect([...Fruit.cases()]).toContain('banana')
  })

  it('associates do not affect each other when created from the same base case', () => {
    const v1 = Color.red.associate({ tag: 'first' })
    const v2 = Color.red.associate({ tag: 'second' })
    expect(v1.associations.tag).toBe('first')
    expect(v2.associations.tag).toBe('second')
  })
})
