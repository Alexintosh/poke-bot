require('dotenv').config();
const ethers = require('ethers');
const pieABI = require('./abis/pie.json');
const gasNow = require('./apis/gasnow');  

const provider = ethers.getDefaultProvider('mainnet', {
    infura: process.env.INFURA_KEY,
});

const pie = process.env.PIE.toLowerCase();

async function run() {
    console.log('Running');
    let pool = new ethers.Contract(pie, pieABI, provider);
    let bPool = await pool.getBPool();

    // Get Gas Now
    let gasPrices = await gasNow.fetchGasPrice();

    console.log('Rapid Gas is:', gasPrices.rapid);
    let hash = await pool.methods.pokeWeights().send({gasLimit: '100000000000', gasPrice: gasPrices.rapid});
    console.los('Poke tx hash:', hash);
}

setInterval(function(){ run()}, process.env.INTERVAL || 60000)
run();