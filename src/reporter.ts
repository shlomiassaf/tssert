import * as ts from 'typescript';
import chalk from 'chalk';
import { Diagnostics, GatherDiagnosticsResult, isAssertionDiagnostic } from './diagnostics';
import { reportErrorsAndGetExitCode, isTsDiagnostic } from './util';
import { CompilerOptions } from './config';

const { green, red, cyan } = chalk;

export interface Reporter {
  /**
   * A reporter accepts a test diagnostic result and transforms it into  readable report.
   */
  diagnostics(results: GatherDiagnosticsResult, ...args: any[]): number;
  info(message: string): void;
  error(message: string): void;
}

const defaultFormatHost: ts.FormatDiagnosticsHost = {
  getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
  getCanonicalFileName: fileName => fileName,
  getNewLine: () => ts.sys.newLine
};

export function formatSemanticFileDiagnostics(diags: Diagnostics,
                                              tsFormatHost: ts.FormatDiagnosticsHost = defaultFormatHost): string {
  const prefix = '    - ';
  if (diags && diags.length) {
    return diags
      .map(d => {
        const { line, character } = ts.getLineAndCharacterOfPosition(d.file, d.start);
        if (isAssertionDiagnostic(d)) {
          const desc = d.description ? cyan(`      ${d.description}\n`) : '';
          return `${desc}${prefix}${d.name} @ (${line + 1}, ${character + 1}): ${d.messageText}`;
        } else {
          return `${prefix}Error TS${d.code} @ (${line + 1}, ${character + 1}): ${d.messageText}`;
        }
      })
      .join('\n');
  } else {
    return '';
  }
}

export function semanticFileDiagnostics(allDiagnostics: Diagnostics, options?: CompilerOptions): number {
  if (allDiagnostics.length) {
    let currentDir = options ? options.basePath : undefined;
    const formatHost: ts.FormatDiagnosticsHost = {
      getCurrentDirectory: () => currentDir || ts.sys.getCurrentDirectory(),
      getCanonicalFileName: fileName => fileName,
      getNewLine: () => ts.sys.newLine
    };
    consoleReporter.error(formatSemanticFileDiagnostics(allDiagnostics, formatHost));
  }
  return 1;
}

const styles = {
  pass: green.inverse,
  fail: red.inverse
};

/**
 * A Reporter that logs to the console.
 */
export const consoleReporter: Reporter = {
  diagnostics(results: GatherDiagnosticsResult, options?: CompilerOptions): number {
    const { externalFiles, testFiles } = results;
    if (externalFiles && externalFiles.length > 0) {
      consoleReporter.info(`Could not test, TS Errors found in non-test files.`);
      return reportErrorsAndGetExitCode(externalFiles, options, consoleReporter.error);
    } else if (testFiles && testFiles.size > 0) {
      let exitCode = 0;
      Array.from(testFiles).forEach( ([sf, result]) => {
        const { fromTs, internal } = result;
        const passed  = (!fromTs || !fromTs.length) && (!internal || !internal.length);
        consoleReporter.info(
          (passed ? styles.pass(' PASS ') : styles.fail(' FAILED ')) + ' ' + sf.fileName);
        if (fromTs && fromTs.length) {
          consoleReporter.info(`\n * TS Semantic error without assertions:\n`);
          exitCode = Math.max(exitCode, semanticFileDiagnostics(fromTs, options));
        }
        if (internal && internal.length) {
          consoleReporter.info(`\n * Assertions without a TS semantic error match:\n`);
          exitCode = Math.max(exitCode, semanticFileDiagnostics(internal, options));
        }

        consoleReporter.info('\n');
      });
      return exitCode;
    }
  },
  info: console.info,
  error: message => consoleReporter.info(red(message))
};
