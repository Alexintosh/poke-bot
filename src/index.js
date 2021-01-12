require('dotenv').config();

const chalk = require('chalk');
const emoji = require('node-emoji-new')
const cliProgress = require('cli-progress');
const runOvenCheck = require('./routines/ovenBake').run;
const { TokenSupplyCheck } = require('./checks/tokenSupply');
const { Scheduler, Every } = require('./cronjobs');

let isReady = false;

const pies = [
    '0xe4f726adc8e89c6a6017f01eada77865db22da14',
    '0x78f225869c08d478c34e5f645d07a87d3fe8eb78'
]

let repo = [];

const scheduler = new Scheduler();


/**
 * Setup function
 */
async function setup() {

    console.log(`${chalk.white.bgMagenta(emoji.get('robot') + ' Welcome to the PieDAO Bot ' + emoji.get('robot'))} \n\n`);
    if(process.env.RUN_SUPPLY_CHECKS) {
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
    
    if(process.env.RUN_OVEN_CHECKS) {
        console.log(chalk.magenta("Setting up OvenChecks..."))
        scheduler.add(Every.minutes15, runOvenCheck);
        console.log(chalk.white(`OvenChecks cronjob at: ${Every.minutes15} \n`));
    }

    isReady = true;    
    console.log(`${chalk.green(emoji.get('check_mark_button') + ' All gucci, bot is ready')} \n\n`);
}

setup();