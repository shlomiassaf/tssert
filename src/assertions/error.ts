import * as ts from 'typescript';
import { BaseAssertion, AssertionMatchResult } from './base';
import { DIAGNOSTIC_SOURCE, SemanticAssertionDiagnostics } from '../diagnostics';

/**
 * Instructions, in the form of comment, for a TypeScript Error to expect from the expression the comment decorates.
 *
 * An error assertion describes the semantic error diagnosed by the compiler that is expected from the expression
 * that the comment decorates. The description specify the error number/id and the position and an optional
 * error message.
 *
 * Positioning is defined by the line and character which point to the exact location of the semantic error
 *
 * The line and character are always RELATIVE to their closest parent and not to the document.
 * The line and character are set in base 1 (IDE's visualize in base 1 as well as TS diagnostic messages)
 *
 * Position format: LINE:CHAR or CHAR
 * When line is 1 you can omit it and set the character only.
 *
 * ## Exapmles:
 *
 * #### Single line:
 *
 * /**
 *  * @tssert Should display error if number is set to a string
 *  * @tsError 2322
 *  * @loc 7
 *  * /
 *  const x: string = 15;
 *  ^^^^^^7
 *
 *
 * #### Single-Line & Multi-Error:
 * /**
 *  * @tssert extend action
 *  * @tsError 2322
 *  * @loc 7
 *  * /
 * /**
 *  * @tssert extend action
 *  * @tsError 2304
 *  * @loc 25
 *  * /
 * const x: string = (15 + notSet) as number;
 *
 * #### Multi-Line:
 *
 *  /**
 *  * @tssert
 *  * @tsError 2322
 *  * @loc 3:11
 *  * /
 *  const x: Promise<string> = Promise.resolve('str')
 *    .then( value => {
 *      const y: number = value;
 *      return value;
 *   });
 * Error is on the 3rd row of the multi-line expression, starting from row 1 (base 1)
 *
 *
 * #### Multi-Line & Multi-Error:
 *
 *  /**
 *  * @tssert
 *  * @tsError 2322
 *  * @loc 7
 *  * /
 *  /**
 *  * @tssert
 *  * @tsError 2322
 *  * @loc 3:11
 *  * /
 *  const x: Promise<string> = Promise.resolve('str')
 *    .then( value => {
 *      const y: number = value;
 *      return y;
 *   });
 */
export class SemanticErrorAssertion extends BaseAssertion {
  /**
   * The semantic error number (id) that typescript will throw
   */
  tsError: number;

  /**
   * An optional message, if set the library will try to match it to the TypeScript error.
   * A Full match is required.
   */
  tsErrorMsg?: string;

  match(node: ts.Node, diagnostics: ts.Diagnostic[], program: ts.Program, sf?: ts.SourceFile): AssertionMatchResult | undefined {
    if (!sf) {
      sf = node.getSourceFile();
    }
    const baseLine = ts.getLineAndCharacterOfPosition(sf, node.getStart()).line;
    const errLine = baseLine + this.line;
    let diagnosticIndex: number = -1;
    // diagnostics array is sorted by position so this should be O(1) unless not found.
    // we don't assume sorting hence for-loop.
    for (let dIdx = 0, dLen = diagnostics.length; dIdx < dLen; dIdx++) {
      const d = diagnostics[dIdx];
      const { line, character } = ts.getLineAndCharacterOfPosition(sf, d.start);
      if ( errLine === line
        && this.char === character
        && this.tsError === d.code
        && (!this.tsErrorMsg || this.tsErrorMsg === d.messageText)) {
        diagnosticIndex = dIdx;
        break;
      }
    }

    const error: SemanticAssertionDiagnostics = diagnosticIndex > -1 ? undefined : {
      name: 'SemanticErrorAssertion',
      file: sf,
      start: ts.getPositionOfLineAndCharacter(sf, errLine, this.char),
      length: undefined,
      messageText: `Expected error TS${this.tsError}`,
      source: DIAGNOSTIC_SOURCE,
      category: ts.DiagnosticCategory.Error,
      code: this.tsError,
      node
    };
    if (error) {
      if (this.tssert) {
        error.description = this.tssert;
      }
      if (this.tsErrorMsg) {
        error.messageText += ` with text message "${this.tsErrorMsg}"`;
      }
    }
    return { diagnosticIndex, error };
  }

  static keys = ['tsError', 'tsErrorMsg'];
  static create(obj: any): SemanticErrorAssertion | undefined {
    const tsError = Number(obj.tsError);
    if (tsError >= 0) {
      obj.tsError = tsError;
      const instance = new SemanticErrorAssertion();
      Object.assign(instance, obj);
      return instance;
    }
  }
}
BaseAssertion.registerFactory(SemanticErrorAssertion);
