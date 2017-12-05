import * as ts from 'typescript';
import { SemanticAssertionDiagnostics } from '../diagnostics';

export interface AssertionFactory<T> {
  keys: string[];
  create(obj: any): T | undefined;
}

export interface AssertionMatchResult {
  diagnosticIndex: number;
  error: SemanticAssertionDiagnostics | undefined;
}

export class BaseAssertion {
  /**
   * A description to include with the assertion
   */
  tssert?: string;

  /**
   * The line offset/index the assertion points at, relative to the beginning of the expression.
   * The line and char values, converted into a position index relative to the file, should match the position
   * of the item this assertion inspects.
   * For example on a assertion checking for TS semantic diagnostic errors this should point to the same location the
   * errors is in.
   *
   * This value is optional and does not have any effect on a single-line expression.
   * If set, it must be followed by a char using the format LINE:CHAR.
   */
  line: number;

  /**
   * The character offset/index the assertion points at, relative to the beginning of the line.
   * The offset is always relative to the line it is defined on, this is also true on multi-line expressions.
   * Offset is set in base 1
   *
   * The line and char values, converted into a position index relative to the file, should match the position
   * of the item this assertion inspects.
   * For example on a assertion checking for TS semantic diagnostic errors this should point to the same location the
   * errors is in.
   *
   * The char offset is mandatory.
   * This logic is easier to reason about. Position of errors are relative to each comment / line and not to the whole
   * file, which might change... it is also easier to understand.
   */
  char: number;

  private static factories: Array<AssertionFactory<BaseAssertion>> = [];

  match(node: ts.Node, diagnostics: ts.Diagnostic[], program: ts.Program, sf?: ts.SourceFile): AssertionMatchResult | undefined {
    throw new Error('Not Implemented');
  }

  static registerFactory(factory: AssertionFactory<any>): void {
    BaseAssertion.factories.push(factory);
  }

  static fromJSDoc(jsDoc: ts.JSDoc): BaseAssertion[] {
    if (!jsDoc.tags || jsDoc.tags.length === 0) {
      return [];
    }

    const obj: any = {};
    for (let t of jsDoc.tags) {
      obj[t.tagName.text] = t.comment.trim();
    }
    if (!obj.hasOwnProperty('tssert') || !obj.hasOwnProperty('loc')) {
      return [];
    }

    const lineAndChar = obj.loc.split(':');
    const char = Number(lineAndChar.pop()) - 1; // transform to base 0
    const line = Number(lineAndChar.pop() || 1) - 1; // we already at line 1 so go back to 0

    const result = [];
    for (let f of BaseAssertion.factories) {
      const raw: Partial<BaseAssertion> = f.keys.reduce( (o, k) => {
        if (obj.hasOwnProperty([k])) {
          o[k] = obj[k];
        }
        return o;
      }, { char, line });
      if (obj.tssert) {
        raw.tssert = obj.tssert;
      }
      const instance = f.create(raw);
      if (instance) {
        result.push(instance);
      }
    }
    return result;
  }
}
