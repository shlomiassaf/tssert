#!/usr/bin/env node

import * as Path from 'path';
import * as ts from 'typescript';

import { defaultGatherDiagnostics, GatherDiagnosticsResult } from './diagnostics';
import { parseCfgFromArgs, parseCfgFromFile, CompilerOptions } from './config';
import { Watcher, FileChangeEvent } from './watcher';
import { consoleReporter, Reporter } from './reporter';

export function run(
  rootNames: string[],
  options: ts.CompilerOptions,
  gatherDiagnostics: (program: ts.Program) => GatherDiagnosticsResult = defaultGatherDiagnostics,
  reporter: Reporter = consoleReporter
): number {
  const program = ts.createProgram(rootNames, options);
  return reporter.diagnostics(gatherDiagnostics(program));
}

/**
 * Run the tests in watch mode.
 * > The reporter is not used for the first compilation result, this is up to the caller using the returned value.
 * @param tsConfigPath
 * @param gatherDiagnostics
 * @param incrementalReporter
 * @param basePath
 * @param existingOptions
 * @returns an object with a close function and the diagnostic results of the first compilation
 */
export function runWatch(tsConfigPath: string,
                         gatherDiagnostics: (program: ts.Program) => GatherDiagnosticsResult = defaultGatherDiagnostics,
                         incrementalReporter: Reporter = consoleReporter,
                         basePath?: string,
                         existingOptions?: ts.CompilerOptions) {
  let program: ts.Program;
  let rootNames: string[];
  let options: CompilerOptions;
  let project: string;
  let timerHandleForRecompilation: any;  // Handle for 0.25s wait timer to trigger recompilation
  let watcher: Watcher;
  let fatal: boolean; // when true, compilation will not fire until fatal errors fixed (usually config stuff)

  const commands = {
    updateConfig(): ts.Diagnostic[] | undefined {
      if (!options) {
        const cfg = parseCfgFromFile(tsConfigPath, basePath, existingOptions);
        if (cfg.errors.length) {
          return cfg.errors;
        }
        rootNames = cfg.rootNames;
        options = cfg.options;
        project = cfg.project;
      }
    },
    compile() {
      const fatalDiagnostics = commands.updateConfig();
      if (fatalDiagnostics) {
        fatal = true;
        return { externalFiles: fatalDiagnostics };
      } else {
        fatal = false;
        program = ts.createProgram(rootNames, options, undefined, program);
        return gatherDiagnostics(program);
      }
    },
    recompile() {
      timerHandleForRecompilation = undefined;
      incrementalReporter.info('File change detected. Starting incremental compilation...');
      incrementalReporter.diagnostics(commands.compile());
      incrementalReporter.info('Compilation complete. Watching for file changes.');
    },

    /**
     * Upon detecting a file change, wait for 250ms and then perform a recompilation. This gives batch
     * operations (such as saving all modified files in an editor) a chance to complete before we kick
     * off a new compilation.
     */
    startTimerForRecompilation() {
      if (timerHandleForRecompilation) {
        commands.cleatTimeout(timerHandleForRecompilation);
      }
      timerHandleForRecompilation = commands.setTimeout(commands.recompile, 250);
    },
    close() {
      if (watcher) {
        watcher.close();
        if (timerHandleForRecompilation) {
          commands.cleatTimeout(timerHandleForRecompilation);
          timerHandleForRecompilation = undefined;
        }
      }
    },
    setTimeout: (ts.sys.clearTimeout && ts.sys.setTimeout) || setTimeout,
    cleatTimeout: (ts.sys.setTimeout && ts.sys.clearTimeout) || clearTimeout
  };

  const firstRunDiagnostics = commands.compile();

  watcher = Watcher.create(options.basePath, {
    // ignore .dotfiles, .js and .map files.
    // can't ignore other files as we e.g. want to recompile if an `.html` file changes as well.
    ignored: /((^[\/\\])\..)|(\.js$)|(\.map$)|(\.metadata\.json)/,
    ignoreInitial: true,
    persistent: true,
  }).watch()
    .listen(event => {
      if (options && event.type === FileChangeEvent.Change &&
        Path.normalize(event.path) === Path.normalize(project)) {
        // If the configuration file changes, forget everything and start the recompilation timer
        program = undefined;
        options = undefined;
      } else if (event.type === FileChangeEvent.Add || event.type === FileChangeEvent.Delete) {
        options = undefined;
      }

      if (event.type === FileChangeEvent.Add || event.type === FileChangeEvent.Change) {
        commands.startTimerForRecompilation();
      }
    });
  return { close: commands.close, firstRunDiagnostics };
}

export function main(args: string[]): Promise<number> {
  const { project, errors, rootNames, options, watch } = parseCfgFromArgs(args);
  if (errors.length > 0) {
    return Promise.resolve(consoleReporter.diagnostics({ externalFiles: errors }));
  }

  if (watch === true) {
    const { firstRunDiagnostics } = runWatch(project);
    consoleReporter.diagnostics(firstRunDiagnostics);
    return new Promise( (resolve, reject) => {} );
  } else {
    return Promise.resolve(run(rootNames, options));
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  main(args)
    .then( exitCode => process.exit() );
}
