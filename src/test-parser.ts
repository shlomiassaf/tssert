import * as ts from 'typescript';
import * as utils from 'tsutils';
import { SemanticAssertionDiagnostics } from './diagnostics';
import { BaseAssertion } from './assertions';

function flattenDMC(root: ts.Diagnostic, dmc: ts.DiagnosticMessageChain): ts.Diagnostic[] {
  const result: ts.Diagnostic[] = [];
  while (dmc) {
    result.push(Object.assign(Object.create(root), dmc));
    dmc = dmc.next;
  }
  return result;
}

function normalizeDiagnostics(diagnostics: ts.Diagnostic[]): ts.Diagnostic[] {
  return diagnostics.reduce( (agg, d) => {
    if (typeof d.messageText === 'string') {
      agg.push(d);
    } else {
      agg.push(...flattenDMC(d, d.messageText.next));
    }
    return agg;
  }, []);
}

function getRootToken(token: ts.Node): ts.Node {
  while (token.parent && token.parent.pos === token.pos && token.parent.kind !== ts.SyntaxKind.SourceFile) {
    token = token.parent;
  }
  return token;
}

function collectComments(sf: ts.SourceFile) {
  const store = new Map<ts.Node, { token: ts.Node; jsDoc: ts.JSDoc[]; singleLine: string[] }>();
  utils.forEachComment(sf, (fullText: string, comment: ts.CommentRange) => {
    const token = getRootToken(utils.getTokenAtPosition(sf, comment.pos, sf));
    if (!store.has(token)) {
      store.set(token, { token, jsDoc: utils.getJsDoc(token, sf), singleLine: [] });
    }

    if (comment.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
      const text = fullText.substr(comment.pos, comment.end - comment.pos);
      if (text.startsWith('//')) {
        store.get(token).singleLine.push(text);
      }
    }
  }, sf);
  return Array.from(store.values())
    .filter( c => c.singleLine.length + c.jsDoc.length > 0);
}

function parseJsDoc(jsDoc: ts.JSDoc[]): BaseAssertion[] {
  const assertions: BaseAssertion[] = [];
  if (jsDoc && jsDoc.length > 0) {
    for (let jd of jsDoc) {
      assertions.push(...BaseAssertion.fromJSDoc(jd));
    }
  }
  return assertions;
}

/**
 * Parse a source code and get all semantic matchers from comments.
 * It will cross-match all matchers with the diagnostics
 *
 * All diagnostics and definitions that does not have a match are returned.
 * @param sf The source file
 * @param diagnostics Diagnostics found for the source file.
 * @param program
 */
export function parseTestFile(sf: ts.SourceFile,
                              diagnostics: ts.Diagnostic[],
                              program: ts.Program): { fromTs: ts.Diagnostic[], internal: SemanticAssertionDiagnostics[] } {
  diagnostics = normalizeDiagnostics(diagnostics);
  const result = {
    fromTs: diagnostics,
    internal: [] as SemanticAssertionDiagnostics[]
  };

  const comments = collectComments(sf);
  for (let c of comments) {
    const assertions = [...parseJsDoc(c.jsDoc) ];
    assertions.forEach(assertion => {
      const match = assertion.match(c.token, diagnostics, program);
      if (match) {
        if (match.diagnosticIndex > -1) {
          diagnostics.splice(match.diagnosticIndex, 1);
        }
        if (match.error) {
          result.internal.push(match.error);
        }
      }
    });
  }
  return result;
}
