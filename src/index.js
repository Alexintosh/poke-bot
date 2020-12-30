require('dotenv').config();

const runOvenCheck = require('./routines/ovenBake').run;
const { TokenSupplyCheck } = require('./checks/tokenSupply');

let isReady = false;

const pies = [
    '0xe4f726adc8e89c6a6017f01eada77865db22da14',
    '0x78f225869c08d478c34e5f645d07a87d3fe8eb78'
]

let repo = [];

async function main() {
    if(!isReady) {
        console.log('Bot not ready!');
        return;
    }

    repo.forEach( check => check.run() );
    //runOvenCheck();
}

async function setup() {
    for (const p of pies) {
        let instance = new TokenSupplyCheck(p);
        await instance.init();
        repo.push(instance);
    };
    isReady = true;
    
}
setInterval(function(){ main()}, 12000)
setup();