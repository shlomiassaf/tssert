import * as ts from 'typescript';
import { BaseAssertion, AssertionMatchResult } from './base';
import { TsExt } from '../util';
import { DIAGNOSTIC_SOURCE, SemanticAssertionDiagnostics } from '../diagnostics';

/**
 * Instructions, in the form of comment, for a TypeScript type to expect from the expression the comment decorates.
 *
 * An type assertion describes the type diagnosed by the compiler that is expected from the expression
 * that the comment decorates. The description specify the string representation of the type and the position.
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
 *  * @tssert
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
export class SemanticTypeAssertion extends BaseAssertion {
  /**
   * A string representation of the type at the position specified in line/char.
   */
  tsType: string;

  match(node: ts.Node, diagnostics: ts.Diagnostic[], program: ts.Program, sf?: ts.SourceFile): AssertionMatchResult | undefined {
    if (!sf) {
      sf = node.getSourceFile();
    }
    const line = ts.getLineAndCharacterOfPosition(sf, node.getStart()).line;
    const typeLine = line + this.line;
    const pos = ts.getPositionOfLineAndCharacter(sf, typeLine, this.char);
    const checker = program.getTypeChecker();
    const typeCandidates = TsExt.getExpressionOrIdentifierNodesAtPosition(node, pos, true, sf);

    // try matching a type from the last type in the list, which is the deepest
    for (let child of typeCandidates.reverse()) {
      const typeStr = checker.typeToString(checker.getTypeAtLocation(child));
      if (typeStr === this.tsType) {
        return;          
      }
    }

    // if we are here it means no match, return an error
    // we return the last type in the error, again since it most specific and what user intended
    // if nothing found we return different error.
    const last = typeCandidates.pop();
    let error: SemanticAssertionDiagnostics;
    if (last) {
      const typeStr = checker.typeToString(checker.getTypeAtLocation(last));
      error = {
        name: 'SemanticTypeAssertion',
        file: sf,
        start: pos,
        length: last.getWidth(sf),
        messageText: `Expected type "${this.tsType}" but found "${typeStr}"`,
        source: DIAGNOSTIC_SOURCE,
        category: ts.DiagnosticCategory.Error,
        code: 9000,
        node
      };
      if (this.tssert) {
        error.description = this.tssert;
      }
    } else {
      error = {
        name: 'SemanticTypeAssertion',
        file: sf,
        start: ts.getPositionOfLineAndCharacter(sf, typeLine, this.char),
        length: 1,
        messageText: `Expected type "${this.tsType}" but position did not have a type.`,
        source: DIAGNOSTIC_SOURCE,
        category: ts.DiagnosticCategory.Error,
        code: 9000,
        node
      };
    }
    return { diagnosticIndex: -1, error };
  }

  static keys = ['tsType'];
  static create(obj: any): SemanticTypeAssertion | undefined {
    if (obj.tsType) {
      const instance = new SemanticTypeAssertion();
      Object.assign(instance, obj);
      return instance;
    }
  }
}
BaseAssertion.registerFactory(SemanticTypeAssertion);
