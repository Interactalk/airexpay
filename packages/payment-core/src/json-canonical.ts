/**
 * Number-preserving JSON canonical form for NOWPayments IPN signatures.
 *
 * `JSON.parse` turns numeric tokens into IEEE-754 doubles, so `0.10000000`
 * becomes `0.1` and integers above 2^53 lose digits. Re-serializing that
 * value changes the HMAC input. This tokenizer keeps each raw number token
 * as text, sorts object keys, and writes those tokens back unchanged.
 * Strings that merely look like numbers stay quoted.
 */

const MAX_DEPTH = 64;

export class JsonNumber {
  readonly literal: string;

  constructor(literal: string) {
    this.literal = literal;
  }
}

export function parseJsonPreservingNumbers(input: string): unknown {
  const parser = new JsonParser(input);
  const value = parser.parseValue();
  parser.skipWhitespace();
  if (!parser.done()) {
    throw new SyntaxError('Unexpected trailing JSON');
  }
  return value;
}

export function materializeJsonNumbers(value: unknown): unknown {
  if (value instanceof JsonNumber) return value.literal;
  if (Array.isArray(value)) return value.map((entry) => materializeJsonNumbers(entry));
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      copy[key] = materializeJsonNumbers(source[key]);
    }
    return copy;
  }
  return value;
}

export function sortJsonValue(value: unknown): unknown {
  if (value instanceof JsonNumber) return value;
  if (Array.isArray(value)) return value.map((entry) => sortJsonValue(entry));
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortJsonValue(source[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return serializeCanonical(sortJsonValue(value));
}

function serializeCanonical(value: unknown): string {
  if (value instanceof JsonNumber) return value.literal;
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Non-finite numbers are not JSON');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    return `[${value.map((entry) => serializeCanonical(entry ?? null)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${serializeCanonical(source[key])}`);
    }
    return `{${parts.join(',')}}`;
  }
  throw new TypeError('Unsupported JSON value');
}

class JsonParser {
  private index = 0;

  constructor(private readonly input: string) {}

  done(): boolean {
    return this.index >= this.input.length;
  }

  parseValue(depth = 0): unknown {
    if (depth > MAX_DEPTH) {
      throw new SyntaxError('JSON nesting is too deep');
    }
    this.skipWhitespace();
    const character = this.peek();
    if (character === '{') return this.parseObject(depth);
    if (character === '[') return this.parseArray(depth);
    if (character === '"') return this.parseString();
    if (character === 't') return this.consumeLiteral('true', true);
    if (character === 'f') return this.consumeLiteral('false', false);
    if (character === 'n') return this.consumeLiteral('null', null);
    if (character === '-' || this.isDigit(character)) return this.parseNumber();
    throw new SyntaxError('Invalid JSON value');
  }

  private parseObject(depth: number): Record<string, unknown> {
    this.expect('{');
    const object: Record<string, unknown> = {};
    this.skipWhitespace();
    if (this.peek() === '}') {
      this.index += 1;
      return object;
    }
    for (;;) {
      this.skipWhitespace();
      if (this.peek() !== '"') throw new SyntaxError('Expected object key');
      const key = this.parseString();
      this.skipWhitespace();
      this.expect(':');
      object[key] = this.parseValue(depth + 1);
      this.skipWhitespace();
      if (this.peek() === ',') {
        this.index += 1;
        continue;
      }
      this.expect('}');
      break;
    }
    return object;
  }

  private parseArray(depth: number): unknown[] {
    this.expect('[');
    const values: unknown[] = [];
    this.skipWhitespace();
    if (this.peek() === ']') {
      this.index += 1;
      return values;
    }
    for (;;) {
      values.push(this.parseValue(depth + 1));
      this.skipWhitespace();
      if (this.peek() === ',') {
        this.index += 1;
        continue;
      }
      this.expect(']');
      break;
    }
    return values;
  }

  private parseString(): string {
    this.expect('"');
    let value = '';
    while (!this.done()) {
      const character = this.input[this.index] ?? '';
      if (character === '"') {
        this.index += 1;
        return value;
      }
      if (character === '\\') {
        value += this.parseEscape();
        continue;
      }
      const code = character.charCodeAt(0);
      if (code < 0x20) throw new SyntaxError('Unescaped control character in string');
      value += character;
      this.index += 1;
    }
    throw new SyntaxError('Unterminated string');
  }

  private parseEscape(): string {
    this.expect('\\');
    const character = this.input[this.index] ?? '';
    this.index += 1;
    switch (character) {
      case '"':
      case '\\':
      case '/':
        return character;
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case 'u': {
        const hex = this.input.slice(this.index, this.index + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new SyntaxError('Invalid unicode escape');
        this.index += 4;
        return String.fromCharCode(Number.parseInt(hex, 16));
      }
      default:
        throw new SyntaxError('Invalid escape');
    }
  }

  private parseNumber(): JsonNumber {
    const start = this.index;
    if (this.peek() === '-') this.index += 1;
    if (this.peek() === '0') {
      this.index += 1;
      if (this.isDigit(this.peek())) throw new SyntaxError('Leading zero in JSON number');
    } else if (this.isDigit(this.peek())) {
      while (this.isDigit(this.peek())) this.index += 1;
    } else {
      throw new SyntaxError('Invalid JSON number');
    }
    if (this.peek() === '.') {
      this.index += 1;
      if (!this.isDigit(this.peek())) throw new SyntaxError('Invalid JSON fraction');
      while (this.isDigit(this.peek())) this.index += 1;
    }
    if (this.peek() === 'e' || this.peek() === 'E') {
      this.index += 1;
      if (this.peek() === '+' || this.peek() === '-') this.index += 1;
      if (!this.isDigit(this.peek())) throw new SyntaxError('Invalid JSON exponent');
      while (this.isDigit(this.peek())) this.index += 1;
    }
    return new JsonNumber(this.input.slice(start, this.index));
  }

  private consumeLiteral(literal: string, value: unknown): unknown {
    if (this.input.slice(this.index, this.index + literal.length) !== literal) {
      throw new SyntaxError('Invalid JSON literal');
    }
    this.index += literal.length;
    return value;
  }

  skipWhitespace(): void {
    while (
      this.peek() === ' ' ||
      this.peek() === '\n' ||
      this.peek() === '\r' ||
      this.peek() === '\t'
    ) {
      this.index += 1;
    }
  }

  private expect(character: string): void {
    if (this.peek() !== character) throw new SyntaxError(`Expected ${character}`);
    this.index += 1;
  }

  private peek(): string {
    return this.input[this.index] ?? '';
  }

  private isDigit(character: string): boolean {
    return character >= '0' && character <= '9';
  }
}
