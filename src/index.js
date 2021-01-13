require('dotenv').config();

const chalk = require('chalk');
const emoji = require('node-emoji-new')
const cliProgress = require('cli-progress');
const runOvenCheck = require('./routines/ovenBake').run;
const ovenState = require('./routines/ovenBake').ovenState;
const { TokenSupplyCheck } = require('./checks/tokenSupply');
const { Scheduler, Every } = require('./cronjobs');
const vorpal = require('vorpal')();


/**
 * Config
 */
let isReady = false;
let repo = [];
const scheduler = new Scheduler();
const pies = [
    '0xe4f726adc8e89c6a6017f01eada77865db22da14',
    '0x78f225869c08d478c34e5f645d07a87d3fe8eb78'
]

/**
 * CLI Commands definition
 */
vorpal
  .command('oven-state', 'Outputs state of the ovens.')
  .action(function(args, callback) {
    ovenState();
    scheduler.status('RUN_OVEN_CHECKS')
    callback();
  });


vorpal
  .command('oven-stop-checks', 'Stops checking the oven.')
  .action(function(args, callback) {
    scheduler.stop('RUN_OVEN_CHECKS')
    callback();
  });

vorpal
  .command('oven-start-checks', 'Start checking the oven.')
  .action(function(args, callback) {
    if(!scheduler.jobs['RUN_OVEN_CHECKS']) {
        setupOvenChecks();
    }
    scheduler.start('RUN_OVEN_CHECKS')
    callback();
  });

vorpal
  .command('oven-run-checks', 'Runs checks on the oven now.')
  .option('-no, --notx', 'Runs checks on the oven without exectuting the tx')
  .action(function(args, callback) {
    runOvenCheck(args.options.notx ? false : true);
    callback();
  });

vorpal
  .delimiter('KitchenBot$\n')
  .show();


/**
 * Setup function
 */
async function setup() {
    console.log(`${chalk.white.bgMagenta(emoji.get('robot') + ' Welcome to the Kitchen Bot ' + emoji.get('robot'))} \n\n`);

    if(process.env.RUN_SUPPLY_CHECKS === "true") {
        await setupSupplyChecks();
    }
    
    if(process.env.RUN_OVEN_CHECKS  === "true") {
        setupOvenChecks();
    }

    isReady = true;    
    console.log(`${chalk.green(emoji.get('check_mark_button') + ' All gucci, bot is ready')}`);
    console.log('Type `help` to see command list \n\n')

    if(process.env.RUN_OVEN_CHECKS  === "true") {
        runOvenCheck();
    }
    
}

function setupOvenChecks() {
    console.log(chalk.magenta("Setting up OvenChecks..."))
    scheduler.add(Every.minutes15, runOvenCheck, 'RUN_OVEN_CHECKS');
    console.log(chalk.white(`OvenChecks cronjob at: ${Every.minutes15} \n`));
}

async function setupSupplyChecks() {
    console.log(chalk.magenta("Setting up TokenSupplyCheck..."))
    const bar1 = new cliProgress.SingleBar({
        format: '|' + chalk.yellow('{bar}') + '| {percentage}% || {value}/{total} Pies',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });
    bar1.start(pies.length, 0);

    for (const [i, p] of pies.entries()) {
        let instance = new TokenSupplyCheck(p);
        await instance.init();
        bar1.update(i+1);
        repo.push(instance);
    };

    scheduler.add(Every.minute, () => repo.forEach( check => check.run() ));
    bar1.stop();

    console.log(chalk.white(`TokenSupplyCheck cronjob at: ${Every.minute} \n`));
}

setup();