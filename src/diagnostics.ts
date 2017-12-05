import * as Path from 'path';
import * as ts from 'typescript';

import { parseTestFile } from './test-parser';

export const DIAGNOSTIC_SOURCE = 'tssert' as 'tssert';

export interface SemanticAssertionDiagnostics {
  file: ts.SourceFile | undefined;
  start: number | undefined;
  length: number | undefined;
  messageText: string;
  category: ts.DiagnosticCategory;
  code: number;
  source: typeof DIAGNOSTIC_SOURCE;
  description?: string;
  name: string;
  node: ts.Node;
}

export type Diagnostics = Array<ts.Diagnostic | SemanticAssertionDiagnostics>;

export interface GatherDiagnosticsResult {
  externalFiles?: ts.Diagnostic[];
  testFiles?: Map<ts.SourceFile, { fromTs: ts.Diagnostic[], internal: SemanticAssertionDiagnostics[] }>;
}

export function isAssertionDiagnostic(diagnostic: any): diagnostic is SemanticAssertionDiagnostics {
  return diagnostic != null && diagnostic.source === DIAGNOSTIC_SOURCE;
}

export function diagnosticsHasErrors(diagnostics: Diagnostics): boolean {
  return diagnostics.some(d => d.category === ts.DiagnosticCategory.Error);
}

export function defaultGatherDiagnostics(program: ts.Program): GatherDiagnosticsResult {
  const result: GatherDiagnosticsResult = {
    externalFiles: [],
    testFiles: new Map<ts.SourceFile, { fromTs: ts.Diagnostic[], internal: SemanticAssertionDiagnostics[] }>()
  };

  // Check parameter diagnostics
  result.externalFiles.push(...program.getOptionsDiagnostics());
  if (diagnosticsHasErrors(result.externalFiles)) {
    return result;
  }

  // Check syntactic diagnostics
  result.externalFiles.push(...program.getSyntacticDiagnostics());
  if (diagnosticsHasErrors(result.externalFiles)) {
    return result;
  }

  const semantics = getSemanticDiagnostics(program, program.getCurrentDirectory());
  if (Array.isArray(semantics)) {
    result.externalFiles.push(...semantics);
  } else {
    Array.from(semantics.entries()).forEach( ([sf, d]) => {
      result.testFiles.set(sf, parseTestFile(sf, d, program));
    });
  }
  return result;
}

/**
 * Goes over all source files in the program and checks for semantic errors.
 * Source files have 2 categories:
 *   - Root files
 *   - Non root files
 *
 * Root files are source code files that are directly loaded from the "tsconfig" configuration.
 * Non root files are source code files which are in-directly loaded due to imports in the code.
 *
 * Simply put, root files are are the test spec files to check to assetions.
 *
 * If a semantic error is found in a non-root file the response is an array of all of the semantic
 * errors found for all NON ROOT files only. Semantic erros for spec files are ignored.
 *
 * If there are not semantic errors for NON ROOT files, a map is returned where each key is a source
 * file and the value is an array of semantic errors found for it.
 *
 * @param program
 * @param basePath
 */
function getSemanticDiagnostics(program: ts.Program,
                                basePath: string): ts.Diagnostic[] | Map<ts.SourceFile, ts.Diagnostic[]> {
  const rootFiles = program.getRootFileNames().map( f => Path.resolve(basePath, f));
  const sourceFiles = program.getSourceFiles();
  const nonRootDiagnostics: ts.Diagnostic[] = [];
  const rootDiagnostics = new Map<ts.SourceFile, ts.Diagnostic[]>();

  for (let sf of sourceFiles) {
    const fileName = Path.isAbsolute(sf.fileName)
      ? sf.fileName
      : Path.resolve(basePath, sf.fileName)
    ;
    const idx = rootFiles.indexOf(fileName);
    const diagnostics = program.getSemanticDiagnostics(sf);
    if (idx === -1) {
      if (diagnostics.length > 0) {
        nonRootDiagnostics.push(...diagnostics);
      }
    } else {
      rootFiles.splice(idx, 1);
      rootDiagnostics.set(sf, diagnostics);
    }
  }

  return nonRootDiagnostics.length > 0 ? nonRootDiagnostics : rootDiagnostics;
}
