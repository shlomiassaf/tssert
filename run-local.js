require('ts-node/register');
const main = require('./src/test-runner.ts').main;

main(process.argv.slice(2))
  .then( exitCode => process.exit() );
