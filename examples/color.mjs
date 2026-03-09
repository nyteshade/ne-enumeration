import Enumeration from "../src/enumeration.mjs";

/**
 * An enumeration designed to support the `alphaPosition` parameter of the
 * {@link Color#toHex} function. Colors are usually defined based on the
 * order of their channels. In this case it is important to see where the
 * alpha channel hex strings are generated.
 */
export class AlphaColorLocation extends Enumeration {
  static {
    /**
     * Defines the scenario where the alpha channel hexadecimal values should
     * be generated in front of RGB, thus ARGB.
     *
     * @type {AlphaColorLocation}
     */
    AlphaColorLocation.define('start')

    /**
     * Defines the scenario where the alpha channel hexadecimal values should
     * be generated at the end of the string, thus RGBA.
     */
    AlphaColorLocation.define('end')
  }
}

/**
 * Example Color enum from the class description for {@link Enumeration}. This
 * simple enum defines cases for `red`, `green`, `blue` and `rgb`. The latter
 * is expected to have associated values per instance, such as in the following
 * example
 *
 * @example
 * const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
 */
export class Color extends Enumeration {
  /**
   * A shared color value that all enum cases possess. Given a Color enum
   * case value, it converts its internal red, green, blue and optionally
   * alpha color values into hexadecimal and prefixes the entire string
   * with a hash mark. Allowing for direct string drop in assign for a CSS
   * color definition.
   *
   * @param {boolean} [includeAlpha=false] most hexadecimal color
   * representations do not include an alpha component, so this defaults
   * to `false`
   * @param {AlphaColorLocation} [alphaPosition=AlphaColorLocation.end] defines
   * the default location for an included alpha color component value. This
   * defaults to the end of the string so `#rrggbbaa`, whereas a value of
   * {@link AlphaColorLocation#start} would generate `#aarrggbb` instead.
   * @returns {string} a hexadecimal representation of the color in question,
   * usually in the form of `#rrggbb`.
   */
  toHex(includeAlpha = false, alphaPosition = AlphaColorLocation.end) {
    const { r, g, b, a } = this;
    const base = `#` + [r, g, b]
        .map(c => c.toString(16).padStart(2, '0')).join('');

    if (includeAlpha) {
      if (alphaPosition.key === AlphaColorLocation.start.key)
        return (a.toString(16) + base);
      else if (alphaPosition.key === AlphaColorLocation.end)
        return (base + a.toString(16));
    }

    return base;
  }

  static {
    /**
     * A fully opaque, red color enumeration case with red set to 255 and all
     * other color channels set to 0.
     *
     * @type {Color}
     */
    Color.define('red', { r: 255, g: 0, b: 0, a: 255 });

    /**
     * A fully opaque, green color enumeration case with green set to 255
     * and all other color channels set to 0.
     *
     * @type {Color}
     */
    Color.define('green', { r: 0, g: 255, b: 0, a: 255 });

    /**
     * A fully opaque, blue color enumeration case with blue set to 255 and all
     * other color channels set to 0.
     *
     * @type {Color}
     */
    Color.define('blue', { r: 0, g: 0, b: 255, a: 255 });

    /**
     * A, by default, opaque and fully black (all color channels set to 0)
     * color case that is designed to expect custom associated red, green,
     * blue and alpha channel values upon instantiation.
     *
     * @example
     * const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
     *
     * @type {Color}
     */
    Color.define('rgb', null, {
      get value() { return this.associations ?? { r: 0, g: 0, b: 0, a: 255 } }
    });
  }
}