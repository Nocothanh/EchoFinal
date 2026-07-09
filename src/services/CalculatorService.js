/**
 * CalculatorService.js
 * Math calculations, unit conversion, and currency conversion
 */

class CalculatorService {
  constructor() {
    this.isInitialized = false;
    this.unitConversions = {
      length: {
        'm': 1, 'km': 1000, 'cm': 0.01, 'mm': 0.001,
        'mi': 1609.344, 'yd': 0.9144, 'ft': 0.3048, 'in': 0.0254,
        'nm': 1852
      },
      weight: {
        'kg': 1, 'g': 0.001, 'mg': 0.000001, 't': 1000,
        'lb': 0.453592, 'oz': 0.0283495, 'st': 6.35029
      },
      volume: {
        'l': 1, 'ml': 0.001, 'cl': 0.01, 'dl': 0.1,
        'gal': 3.78541, 'qt': 0.946353, 'pt': 0.473176, 'cup': 0.236588,
        'tbsp': 0.0147868, 'tsp': 0.00492892, 'fl_oz': 0.0295735
      },
      temperature: {
        'c': 'celsius', 'f': 'fahrenheit', 'k': 'kelvin'
      },
      speed: {
        'kmh': 1, 'mph': 1.60934, 'ms': 3.6, 'kn': 1.852
      },
      time: {
        's': 1, 'min': 60, 'h': 3600, 'd': 86400, 'w': 604800
      },
      data: {
        'b': 1, 'kb': 1024, 'mb': 1048576, 'gb': 1073741824, 'tb': 1099511627776
      }
    };
  }

  init() {
    this.isInitialized = true;
    return true;
  }

  calculate(expression) {
    try {
      const sanitized = expression
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/\^/g, '**')
        .replace(/(\d+)\s*%/g, '($1/100)')
        .replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
        .replace(/sin\(([^)]+)\)/g, 'Math.sin($1)')
        .replace(/cos\(([^)]+)\)/g, 'Math.cos($1)')
        .replace(/tan\(([^)]+)\)/g, 'Math.tan($1)')
        .replace(/log\(([^)]+)\)/g, 'Math.log10($1)')
        .replace(/ln\(([^)]+)\)/g, 'Math.log($1)')
        .replace(/pi/gi, 'Math.PI')
        .replace(/e(?![a-z])/gi, 'Math.E')
        .replace(/abs\(([^)]+)\)/g, 'Math.abs($1)')
        .replace(/pow\(([^,]+),([^)]+)\)/g, 'Math.pow($1,$2)');

      if (!/^[\d\s\+\-\*\/\.\(\)%eMath.,sqrtintanologabspow]+$/.test(sanitized)) {
        return { success: false, error: 'Invalid expression' };
      }

      const result = new Function(`return (${sanitized})`)();
      if (typeof result !== 'number' || !isFinite(result)) {
        return { success: false, error: 'Invalid result' };
      }

      return { success: true, result, expression };
    } catch (error) {
      return { success: false, error: 'Cannot calculate: ' + error.message };
    }
  }

  convertUnit(value, fromUnit, toUnit, category) {
    if (category === 'temperature') {
      return this.convertTemperature(value, fromUnit, toUnit);
    }

    const cat = this.unitConversions[category];
    if (!cat) return { success: false, error: `Unknown category: ${category}` };

    const fromKey = fromUnit.toLowerCase();
    const toKey = toUnit.toLowerCase();

    if (!cat[fromKey] || !cat[toKey]) {
      return { success: false, error: `Unknown unit: ${fromUnit} or ${toUnit}` };
    }

    const baseValue = value * cat[fromKey];
    const result = baseValue / cat[toKey];

    return {
      success: true,
      result: Math.round(result * 10000) / 10000,
      from: `${value} ${fromUnit}`,
      to: `${Math.round(result * 10000) / 10000} ${toUnit}`
    };
  }

  convertTemperature(value, from, to) {
    const f = from.toLowerCase();
    const t = to.toLowerCase();

    let celsius;
    if (f === 'c') celsius = value;
    else if (f === 'f') celsius = (value - 32) * 5 / 9;
    else if (f === 'k') celsius = value - 273.15;
    else return { success: false, error: `Unknown unit: ${from}` };

    let result;
    if (t === 'c') result = celsius;
    else if (t === 'f') result = celsius * 9 / 5 + 32;
    else if (t === 'k') result = celsius + 273.15;
    else return { success: false, error: `Unknown unit: ${to}` };

    return {
      success: true,
      result: Math.round(result * 100) / 100,
      from: `${value}°${from.toUpperCase()}`,
      to: `${Math.round(result * 100) / 100}°${to.toUpperCase()}`
    };
  }

  parseAndConvert(text) {
    const lower = text.toLowerCase();

    const mathMatch = lower.match(/(?:calcola|calculate|quanto fa|what is|quanto è)\s+(.+)/i);
    if (mathMatch) return this.calculate(mathMatch[1]);

    const convertMatch = lower.match(/(\d+(?:\.\d+)?)\s*(\w+)\s+(?:in|to|a|en)\s+(\w+)/i);
    if (convertMatch) {
      const value = parseFloat(convertMatch[1]);
      const from = convertMatch[2];
      const to = convertMatch[3];

      for (const [category, units] of Object.entries(this.unitConversions)) {
        if (units[from.toLowerCase()] && units[to.toLowerCase()]) {
          return this.convertUnit(value, from, to, category);
        }
      }
      return { success: false, error: `Cannot convert between ${from} and ${to}` };
    }

    const tempMatch = lower.match(/(\d+)\s*°?\s*(c|f|celsius|fahrenheit)\s+(?:in|to|a)\s*(c|f|celsius|fahrenheit)/i);
    if (tempMatch) {
      const from = tempMatch[2].charAt(0).toLowerCase();
      const to = tempMatch[3].charAt(0).toLowerCase();
      return this.convertTemperature(parseFloat(tempMatch[1]), from, to);
    }

    return this.calculate(text);
  }

  getCommonConversions() {
    return [
      { from: 'km', to: 'mi', category: 'length', label: 'Chilometri → Miglia' },
      { from: '°C', to: '°F', category: 'temperature', label: 'Celsius → Fahrenheit' },
      { from: 'kg', to: 'lb', category: 'weight', label: 'Chili → Libbre' },
      { from: 'l', to: 'gal', category: 'volume', label: 'Litri → Galloni' },
      { from: 'km/h', to: 'mph', category: 'speed', label: 'km/h → mph' },
      { from: 'gb', to: 'mb', category: 'data', label: 'GB → MB' }
    ];
  }

  cleanup() {}
}

export const calculatorService = new CalculatorService();
export default CalculatorService;
